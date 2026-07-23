import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SERVERS = ['69.197.145.4', '204.12.237.78'];
const DEFAULT_SPEAKER = 'abhilash';

async function callProxy(action: string, payload: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/video-generation-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const text = await res.text();
  let json: any = {};
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json };
}

// Recompute run counters from actual queue items — avoids stale read-then-write
// races where two concurrent worker ticks both increment from the same base value.
async function recomputeRun(supabase: any, runId: string) {
  const { data: run } = await supabase
    .from('kannada_queue_runs').select('total').eq('id', runId).maybeSingle();
  if (!run) return;
  const { data: items } = await supabase
    .from('kannada_queue_items').select('status').eq('run_id', runId);
  const rows = items ?? [];
  const completed = rows.filter((r: any) => r.status === 'completed').length;
  const failed = rows.filter((r: any) => r.status === 'failed').length;
  const cancelled = rows.filter((r: any) => r.status === 'cancelled').length;
  const finalized = completed + failed + cancelled;
  await supabase.from('kannada_queue_runs').update({
    completed, failed,
    status: finalized >= run.total ? 'done' : 'running',
  }).eq('id', runId);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const results: Record<string, unknown>[] = [];

  for (const server of SERVERS) {
    // .78 = Cloud Job API (FTP-backed, emits `interrupted`, 404 = truly gone).
    // .4  = Normal server (local GPU disk, legacy status API, no `interrupted`,
    //        transient 404s can happen while the job spins up).
    const isCloud = server === '204.12.237.78';

    // Skip server if it already has a processing item
    const { count: processingCount } = await supabase
      .from('kannada_queue_items')
      .select('id', { count: 'exact', head: true })
      .eq('server_ip', server)
      .eq('status', 'processing');

    if ((processingCount ?? 0) > 0) {
      // Check status of in-flight item
      const { data: inFlight } = await supabase
        .from('kannada_queue_items')
        .select('*')
        .eq('server_ip', server)
        .eq('status', 'processing')
        .limit(1)
        .maybeSingle();

      if (inFlight) {
        // NORMAL SERVER (.4): the Cloud Job API on port 5005 isn't reliable here
        // (returns 404 "Job status not found or expired"). Mirror the multilanguage
        // admin page — read live presentation.json via the `review` action and check
        // every section's avatar_languages for a completed Kannada entry.
        if (!isCloud) {
          const review = await callProxy('review', {
            job_id: inFlight.external_job_id,
            server_ip: server,
          });
          const rawSections: any[] = review.json?.sections ?? [];
          const narrationSections = rawSections.filter((s: any) =>
            s?.narration?.full_text ||
            (s?.narration?.segments?.length ?? 0) > 0 ||
            s?.explanation_plan?.visual_beats?.some((b: any) => b?.segments?.length > 0)
          );
          if (review.ok && narrationSections.length > 0) {
            const allKannadaDone = narrationSections.every((s: any) =>
              (s.avatar_languages ?? []).some(
                (a: any) => String(a.language).toLowerCase() === 'kannada' && a.status === 'completed'
              )
            );
            if (allKannadaDone) {
              await supabase.from('kannada_queue_items').update({
                status: 'completed',
                finished_at: new Date().toISOString(),
                last_error: null,
              }).eq('id', inFlight.id);
              if (inFlight.run_id) await recomputeRun(supabase, inFlight.run_id);
              results.push({ server, item: inFlight.id, path: 'normal', finalized: 'completed_via_review', sections: narrationSections.length });
              continue;
            }
            results.push({ server, item: inFlight.id, path: 'normal', still_processing: true, via: 'review', sections: narrationSections.length });
            continue;
          }
          // review failed — fall through to legacy status probe below
        }


        const status = await callProxy('multilang_avatar_status', {
          job_id: inFlight.external_job_id,
          server_ip: server,
        });

        const st = String(status.json?.state ?? status.json?.status ?? '').toLowerCase();
        const total = Number(status.json?.total ?? 0) || 0;
        const done = Number(status.json?.completed ?? 0) || 0;
        const errField = status.json?.error;
        const msg = String(errField ?? status.json?.message ?? '').toLowerCase();

        const startedAt = inFlight.started_at ? new Date(inFlight.started_at).getTime() : 0;
        const processingMs = startedAt ? Date.now() - startedAt : 0;
        const GRACE_MS = 5 * 60 * 1000;
        const notFoundSignal =
          status.status === 404 ||
          st === 'not_found' ||
          msg.includes('job not found') ||
          msg.includes('not found');

        // CLOUD-ONLY: "interrupted" = GPU container restarted mid-job.
        // Auto re-submit generate_avatar to resume. The normal .4 server
        // never emits this state — ignore it there.
        if (isCloud && st === 'interrupted') {
          const resume = await callProxy('multilang_generate_avatar', {
            job_id: inFlight.external_job_id,
            languages: ['kannada'],
            speaker: DEFAULT_SPEAKER,
            server_ip: server,
            force_regenerate: false,
          });
          const resumeOk = resume.ok ||
            String(resume.json?.status ?? '').toLowerCase() === 'queued';
          await supabase.from('kannada_queue_items').update({
            started_at: new Date().toISOString(),
            last_error: resumeOk
              ? 'interrupted — resumed after GPU restart'
              : `interrupted — resume failed: ${JSON.stringify(resume.json).slice(0, 300)}`,
          }).eq('id', inFlight.id);
          results.push({ server, item: inFlight.id, resumed: resumeOk });
          continue;
        }

        // 404 semantics differ per server:
        // - Cloud (.78): after GRACE_MS a 404 means job truly gone → mark failed.
        // - Normal (.4): 404 can be transient; only escalate after the 45-min stall window.
        const jobLost = isCloud && notFoundSignal && processingMs > GRACE_MS;
        const stalled = !status.ok && processingMs > 45 * 60 * 1000;

        // Completion inference:
        // - Cloud: state==='completed' OR sections_done>=sections_total (schema is reliable).
        // - Normal: rely on state==='completed' only; legacy API doesn't populate totals reliably.
        const completedByProgress = isCloud && total > 0 && done >= total;

        const terminal =
          st === 'completed' ||
          st === 'failed' ||
          completedByProgress ||
          status.json?.terminal ||
          jobLost ||
          stalled;

        if (terminal) {
          const success = st === 'completed' || completedByProgress;
          const errorMsg = success
            ? null
            : st === 'failed'
              ? `avatar generation failed: ${errField || msg || 'unknown error'}`
              : jobLost
                ? `job lost on cloud server (${status.status}): ${msg || st || 'not found'} — FTP job expired`
                : stalled
                  ? `stalled >45min with no valid status (last http ${status.status})`
                  : (errField || status.json?.message || `failed (${st || 'unknown'})`);

          await supabase
            .from('kannada_queue_items')
            .update({
              status: success ? 'completed' : 'failed',
              finished_at: new Date().toISOString(),
              last_error: errorMsg,
            })
            .eq('id', inFlight.id);

          if (inFlight.run_id) {
            await recomputeRun(supabase, inFlight.run_id);
          }
          results.push({ server, item: inFlight.id, path: isCloud ? 'cloud' : 'normal', finalized: st || (jobLost ? 'job_lost' : 'stalled') });
        } else {
          results.push({ server, item: inFlight.id, path: isCloud ? 'cloud' : 'normal', still_processing: true, progress: `${done}/${total}`, http: status.status, state: st });
        }
        continue;
      }

    }

    // Purge any queued items on this server whose jobs are already fully
    // Kannada-covered — mark them cancelled so they never run and don't
    // inflate the completed counter.
    const { data: coverageAll } = await supabase
      .rpc('get_kannada_coverage_scan', { p_subject_name: null });
    const fullJobIds = new Set<string>(
      (coverageAll ?? [])
        .filter((r: any) => r.coverage_status === 'full' && r.external_job_id)
        .map((r: any) => r.external_job_id as string),
    );

    if (fullJobIds.size > 0) {
      const { data: staleQueued } = await supabase
        .from('kannada_queue_items')
        .select('id, run_id')
        .eq('server_ip', server)
        .eq('status', 'queued')
        .in('external_job_id', Array.from(fullJobIds));
      const stale = staleQueued ?? [];
      if (stale.length > 0) {
        await supabase
          .from('kannada_queue_items')
          .update({
            status: 'cancelled',
            finished_at: new Date().toISOString(),
            last_error: 'skipped — already fully Kannada-covered',
          })
          .in('id', stale.map((s: any) => s.id));
        const runIds = Array.from(new Set(stale.map((s: any) => s.run_id).filter(Boolean)));
        for (const rid of runIds) await recomputeRun(supabase, rid as string);
        results.push({ server, purged_full_covered: stale.length });
      }
    }

    // Pick next queued
    const { data: nextItem } = await supabase
      .from('kannada_queue_items')
      .select('*')
      .eq('server_ip', server)
      .eq('status', 'queued')
      .order('enqueued_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!nextItem) {
      results.push({ server, idle: true });
      continue;
    }

    // Atomically claim the queued row BEFORE calling the GPU/cloud server.
    // Without this, two concurrent worker invocations can both read the same
    // queued item and both submit multilang_generate_avatar for one job.
    const claimStartedAt = new Date().toISOString();
    const { data: claimedRows, error: claimError } = await supabase
      .from('kannada_queue_items')
      .update({
        status: 'processing',
        attempts: nextItem.attempts + 1,
        started_at: claimStartedAt,
        last_error: 'claimed — submitting to server',
      })
      .eq('id', nextItem.id)
      .eq('status', 'queued')
      .select('id');

    if (claimError || !claimedRows?.length) {
      results.push({
        server,
        item: nextItem.id,
        skipped_claim_lost: true,
        error: claimError?.message,
      });
      continue;
    }

    // If old duplicate queue rows already exist for the same external job, two
    // concurrent ticks could claim different rows. Keep exactly one processing
    // row (deterministic earliest) and cancel the rest before any server call.
    const { data: duplicateProcessing } = await supabase
      .from('kannada_queue_items')
      .select('id')
      .eq('server_ip', server)
      .eq('external_job_id', nextItem.external_job_id)
      .eq('status', 'processing')
      .order('started_at', { ascending: true })
      .order('id', { ascending: true });

    const winnerId = duplicateProcessing?.[0]?.id;
    if (winnerId && winnerId !== nextItem.id) {
      await supabase.from('kannada_queue_items').update({
        status: 'cancelled',
        finished_at: new Date().toISOString(),
        last_error: 'duplicate suppressed — another queue row is already processing this job',
      }).eq('id', nextItem.id);
      if (nextItem.run_id) await recomputeRun(supabase, nextItem.run_id);
      results.push({ server, item: nextItem.id, duplicate_suppressed: true, winner: winnerId });
      continue;
    }

    // Safety: mark as CANCELLED (not completed) — it wasn't actually processed,
    // so it must not inflate the completed counter.
    if (fullJobIds.has(nextItem.external_job_id)) {
      await supabase.from('kannada_queue_items').update({
        status: 'cancelled',
        finished_at: new Date().toISOString(),
        last_error: 'skipped — already fully Kannada-covered',
      }).eq('id', nextItem.id);
      if (nextItem.run_id) await recomputeRun(supabase, nextItem.run_id);
      results.push({ server, item: nextItem.id, skipped_full: true });
      continue;
    }

    // Kick off generation
    const gen = await callProxy('multilang_generate_avatar', {
      job_id: nextItem.external_job_id,
      languages: ['kannada'],
      speaker: DEFAULT_SPEAKER,
      server_ip: server,
      force_regenerate: false,
    });

    // Treat "already_running" (HTTP 409) as an in-flight job, not a failure —
    // the GPU server already has this job_id generating in memory.
    const rawStatus = String(gen.json?.status ?? '').toLowerCase();
    const rawMsg = String(gen.json?.message ?? gen.json?.error ?? '').toLowerCase();
    const alreadyRunning =
      gen.status === 409 ||
      rawStatus === 'already_running' ||
      rawMsg.includes('already in progress') ||
      rawMsg.includes('already running');

    if (!gen.ok && !alreadyRunning) {
      await supabase.from('kannada_queue_items').update({
        status: 'failed',
        last_error: `submit failed: ${JSON.stringify(gen.json).slice(0, 500)}`,
        finished_at: new Date().toISOString(),
      }).eq('id', nextItem.id);
      if (nextItem.run_id) await recomputeRun(supabase, nextItem.run_id);
      results.push({ server, item: nextItem.id, submit_failed: true });
    } else {
      await supabase.from('kannada_queue_items').update({
        status: 'processing',
        last_error: alreadyRunning ? 'already_running (attached to in-flight job)' : null,
      }).eq('id', nextItem.id);
      results.push({ server, item: nextItem.id, submitted: true, attached: alreadyRunning });
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
