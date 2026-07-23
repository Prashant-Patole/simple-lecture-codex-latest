// Language Generation Worker - Server-side orchestrator for bulk multi-language avatar generation
// Called by pg_cron every minute
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SOFT_LOCK_SECONDS = 50; // Skip if another instance ran less than 50s ago

interface JobQueueItem {
  video_job_id: string;
  external_job_id: string;
  server_ip: string;
  chapter_title: string;
  document_name: string | null;
  languages: string[]; // languages to generate for this topic
  status: 'pending' | 'submitted' | 'processing' | 'completed' | 'failed' | 'skipped';
  error_message: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  stall_detected_at: string | null;
  last_progress_count: number | null;
}

interface LangRun {
  id: string;
  subject_id: string;
  subject_name: string;
  status: string;
  languages: string[];
  speaker: string;
  server_ip: string;
  job_queue: JobQueueItem[];
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  skipped_jobs: number;
  current_job_index: number;
  created_by: string | null;
  updated_at: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    // Fetch active runs
    const { data: runs, error: fetchError } = await supabase
      .from('language_generation_runs')
      .select('*')
      .eq('status', 'processing')
      .order('created_at', { ascending: true })
      .limit(3);

    if (fetchError) {
      console.error('[LangWorker] Error fetching runs:', fetchError.message);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!runs || runs.length === 0) {
      return new Response(JSON.stringify({ message: 'No active runs' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[LangWorker] Found ${runs.length} active run(s)`);

    for (const rawRun of runs) {
      const run = rawRun as unknown as LangRun;

      // Soft-lock: skip if updated less than 50s ago (another instance may be running)
      const updatedAt = new Date(run.updated_at).getTime();
      const now = Date.now();
      if (now - updatedAt < SOFT_LOCK_SECONDS * 1000) {
        console.log(`[LangWorker] Run ${run.id} soft-locked (updated ${Math.round((now - updatedAt) / 1000)}s ago), skipping`);
        continue;
      }

      // Touch updated_at to claim this run
      await supabase
        .from('language_generation_runs')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', run.id);

      await processRun(supabase, run);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[LangWorker] Unhandled error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processRun(supabase: any, run: LangRun) {
  const jobs = run.job_queue;
  if (!jobs || jobs.length === 0) {
    console.log(`[LangWorker] Run ${run.id} has no jobs, marking completed`);
    await updateRun(supabase, run.id, { status: 'completed', job_queue: jobs });
    return;
  }

  // Re-check run status (might have been cancelled)
  const { data: freshRun } = await supabase
    .from('language_generation_runs')
    .select('status')
    .eq('id', run.id)
    .single();

  if (freshRun?.status === 'cancelled') {
    console.log(`[LangWorker] Run ${run.id} was cancelled, stopping`);
    return;
  }

  let idx = run.current_job_index;
  if (idx >= jobs.length) {
    console.log(`[LangWorker] Run ${run.id} all jobs done, marking completed`);
    await updateRun(supabase, run.id, { status: 'completed' });
    return;
  }

  const job = jobs[idx];
  console.log(`[LangWorker] Run ${run.id} | Processing job ${idx + 1}/${jobs.length} | jobId=${job.video_job_id} | status=${job.status}`);

  if (job.status === 'pending') {
    // Check if all languages are already completed for this job
    const skipResult = await checkIfAlreadyDone(job, run.languages);
    if (skipResult) {
      console.log(`[LangWorker] Job ${job.video_job_id} already has all languages done, skipping`);
      job.status = 'skipped';
      job.completed_at = new Date().toISOString();
      run.skipped_jobs++;
      advanceToNext(run, jobs, idx);
      await syncRun(supabase, run);
      return;
    }

    // Filter out already-completed languages
    const langsToGenerate = await getLanguagesToGenerate(job, run.languages);
    if (langsToGenerate.length === 0) {
      console.log(`[LangWorker] Job ${job.video_job_id} no new languages needed, skipping`);
      job.status = 'skipped';
      job.completed_at = new Date().toISOString();
      run.skipped_jobs++;
      advanceToNext(run, jobs, idx);
      await syncRun(supabase, run);
      return;
    }

    job.languages = langsToGenerate;

    // Submit the job
    console.log(`[LangWorker] Submitting job ${job.video_job_id} for languages [${langsToGenerate.join(',')}] speaker=${run.speaker} server=${job.server_ip}`);
    const submitResult = await submitLanguageGeneration(supabase, job, run);

    if (submitResult === 'success' || submitResult === 'already_running') {
      job.status = 'processing';
      job.submitted_at = new Date().toISOString();
    } else {
      job.status = 'failed';
      job.error_message = 'Failed to submit generation request';
      job.completed_at = new Date().toISOString();
      run.failed_jobs++;
      advanceToNext(run, jobs, idx);
    }
    await syncRun(supabase, run);

  } else if (job.status === 'submitted' || job.status === 'processing') {
    // Poll status
    const pollResult = await pollLanguageStatus(supabase, job, run);

    if (pollResult === 'completed') {
      console.log(`[LangWorker] Job ${job.video_job_id} completed successfully`);
      job.status = 'completed';
      job.completed_at = new Date().toISOString();
      run.completed_jobs++;
      advanceToNext(run, jobs, idx);
    } else if (pollResult === 'failed') {
      console.log(`[LangWorker] Job ${job.video_job_id} failed`);
      job.status = 'failed';
      job.completed_at = new Date().toISOString();
      run.failed_jobs++;
      advanceToNext(run, jobs, idx);
    }
    // else still processing, will be checked next invocation
    await syncRun(supabase, run);
  }
}

function advanceToNext(run: LangRun, jobs: JobQueueItem[], currentIdx: number) {
  const nextIdx = currentIdx + 1;
  run.current_job_index = nextIdx;
  if (nextIdx >= jobs.length) {
    run.status = 'completed';
    console.log(`[LangWorker] Run ${run.id} all jobs processed, marking completed`);
  }
}

async function syncRun(supabase: any, run: LangRun) {
  await updateRun(supabase, run.id, {
    status: run.status,
    job_queue: run.job_queue,
    current_job_index: run.current_job_index,
    completed_jobs: run.completed_jobs,
    failed_jobs: run.failed_jobs,
    skipped_jobs: run.skipped_jobs,
  });
}

async function updateRun(supabase: any, runId: string, updates: Record<string, any>) {
  const { error } = await supabase
    .from('language_generation_runs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', runId);

  if (error) {
    console.error(`[LangWorker] Failed to update run ${runId}:`, error.message);
  }
}

async function fetchNarratedSections(externalJobId: string, serverIp: string): Promise<any[]> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/video-generation-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        action: 'review',
        job_id: externalJobId,
        server_ip: serverIp,
      }),
    });

    if (!resp.ok) {
      console.error(`[LangWorker] fetchNarratedSections: review API error for ${externalJobId}: ${resp.status}`);
      return [];
    }

    const data = await resp.json();
    const sections = data?.sections || [];

    return sections.filter((s: any) =>
      s.narration?.full_text ||
      (s.narration?.segments && s.narration.segments.length > 0) ||
      (s.explanation_plan?.visual_beats && s.explanation_plan.visual_beats.some((b: any) => b.segments && b.segments.length > 0))
    );
  } catch (err) {
    console.error(`[LangWorker] fetchNarratedSections error for ${externalJobId}:`, err);
    return [];
  }
}

async function checkIfAlreadyDone(job: JobQueueItem, languages: string[]): Promise<boolean> {
  const narratedSections = await fetchNarratedSections(job.external_job_id, job.server_ip);
  if (narratedSections.length === 0) return false;

  for (const lang of languages) {
    for (const section of narratedSections) {
      const avatar = (section.avatar_languages || []).find((a: any) => a.language === lang);
      if (!avatar || avatar.status !== 'completed') return false;
    }
  }
  return true;
}

async function getLanguagesToGenerate(job: JobQueueItem, languages: string[]): Promise<string[]> {
  const narratedSections = await fetchNarratedSections(job.external_job_id, job.server_ip);
  if (narratedSections.length === 0) return languages; // can't determine, generate all

  return languages.filter(lang => {
    const allDone = narratedSections.every((s: any) =>
      (s.avatar_languages || []).find((a: any) => a.language === lang)?.status === 'completed'
    );
    return !allDone;
  });
}

async function submitLanguageGeneration(supabase: any, job: JobQueueItem, run: LangRun): Promise<string> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Create tracking records in language_avatar_jobs for each language
    for (const lang of job.languages) {
      const { error: insertError } = await supabase
        .from('language_avatar_jobs')
        .insert({
          video_job_id: job.video_job_id,
          external_job_id: job.external_job_id,
          section_id: 0,
          section_title: `All Sections (${lang.toUpperCase()})`,
          language: lang,
          speaker: run.speaker,
          server_ip: job.server_ip,
          status: 'processing',
          progress: 0,
        });

      if (insertError) {
        console.error(`[LangWorker] Failed to create tracking record for ${lang}:`, insertError.message);
      }
    }

    // Call video-generation-proxy with multilang_generate_avatar action
    const payload = {
      action: 'multilang_generate_avatar',
      job_id: job.external_job_id,
      languages: job.languages,
      speaker: run.speaker,
      server_ip: job.server_ip,
    };

    console.log(`[LangWorker] Calling video-generation-proxy:`, JSON.stringify(payload));

    const resp = await fetch(`${supabaseUrl}/functions/v1/video-generation-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();
    console.log(`[LangWorker] Proxy response:`, JSON.stringify(data));

    // Handle 409 already_running
    if (data?.error?.includes?.('already_running') || data?.message?.includes?.('already_running')) {
      console.log(`[LangWorker] Job ${job.external_job_id} already running, will track`);
      // Update tracking records with task IDs
      for (const lang of job.languages) {
        const taskId = `v2_${job.external_job_id}_${lang}`;
        await supabase
          .from('language_avatar_jobs')
          .update({ task_id: taskId, status: 'processing' })
          .eq('video_job_id', job.video_job_id)
          .eq('language', lang)
          .eq('status', 'processing');
      }
      return 'already_running';
    }

    if (!resp.ok) {
      console.error(`[LangWorker] Proxy error: ${resp.status}`, data);
      return 'failed';
    }

    // Update tracking records with task IDs
    const taskBase = data?.job_id || data?.task_id || job.external_job_id;
    for (const lang of job.languages) {
      const taskId = `v2_${taskBase}_${lang}`;
      await supabase
        .from('language_avatar_jobs')
        .update({ task_id: taskId, status: 'processing' })
        .eq('video_job_id', job.video_job_id)
        .eq('language', lang)
        .eq('status', 'processing');
    }

    return 'success';
  } catch (err) {
    console.error(`[LangWorker] Submit error:`, err);
    return 'failed';
  }
}

async function pollLanguageStatus(supabase: any, job: JobQueueItem, run: LangRun): Promise<string> {
  try {
    const narratedSections = await fetchNarratedSections(job.external_job_id, job.server_ip);

    if (narratedSections.length === 0) {
      console.log(`[LangWorker] No narrated sections found for ${job.external_job_id}, still processing`);
      return 'processing';
    }

    console.log(`[LangWorker] ${job.external_job_id}: ${narratedSections.length} narrated sections, checking ${job.languages.length} languages`);

    let allCompleted = true;
    let anyFailed = false;
    let totalCompleted = 0;
    const totalExpected = narratedSections.length * job.languages.length;

    for (const lang of job.languages) {
      let langCompleted = 0;
      const langTotal = narratedSections.length;
      let langFailed = 0;

      for (const section of narratedSections) {
        const avatarLangs = section.avatar_languages || [];
        const avatar = avatarLangs.find((a: any) => a.language === lang);
        if (avatar?.status === 'completed') {
          langCompleted++;
        } else if (avatar?.status === 'failed') {
          langFailed++;
          anyFailed = true;
        }
      }

      totalCompleted += langCompleted;
      const progress = langTotal > 0 ? Math.round((langCompleted / langTotal) * 100) : 0;

      if (langCompleted === langTotal) {
        await supabase
          .from('language_avatar_jobs')
          .update({ status: 'completed', progress: 100, updated_at: new Date().toISOString() })
          .eq('video_job_id', job.video_job_id)
          .eq('language', lang);
        console.log(`[LangWorker] ${job.external_job_id} lang=${lang}: COMPLETED (${langCompleted}/${langTotal})`);
      } else if (langFailed === langTotal) {
        await supabase
          .from('language_avatar_jobs')
          .update({ status: 'failed', progress, error_message: 'All sections failed', updated_at: new Date().toISOString() })
          .eq('video_job_id', job.video_job_id)
          .eq('language', lang);
        console.log(`[LangWorker] ${job.external_job_id} lang=${lang}: FAILED (${langFailed}/${langTotal})`);
      } else {
        allCompleted = false;
        await supabase
          .from('language_avatar_jobs')
          .update({ status: 'processing', progress, updated_at: new Date().toISOString() })
          .eq('video_job_id', job.video_job_id)
          .eq('language', lang);
        console.log(`[LangWorker] ${job.external_job_id} lang=${lang}: processing (${langCompleted}/${langTotal}, ${progress}%)`);
      }
    }

    if (allCompleted) return 'completed';

    // --- Stall detection: 30-minute timeout for stuck jobs ---
    const STALL_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

    if (job.last_progress_count !== null && job.last_progress_count === totalCompleted) {
      // No progress since last poll
      if (!job.stall_detected_at) {
        job.stall_detected_at = new Date().toISOString();
        console.log(`[LangWorker] Stall detected for ${job.video_job_id}: ${totalCompleted}/${totalExpected} sections completed, starting 30-min timer`);
      } else {
        const stallStart = new Date(job.stall_detected_at).getTime();
        if (Date.now() - stallStart > STALL_TIMEOUT_MS) {
          console.log(`[LangWorker] Stall timeout for ${job.video_job_id}: stuck at ${totalCompleted}/${totalExpected} for 30+ mins, forcing completion`);
          // Mark incomplete language_avatar_jobs as completed (partial)
          for (const lang of job.languages) {
            const langDone = narratedSections.every((s: any) =>
              (s.avatar_languages || []).find((a: any) => a.language === lang)?.status === 'completed'
            );
            if (!langDone) {
              const langCompleted = narratedSections.filter((s: any) =>
                (s.avatar_languages || []).find((a: any) => a.language === lang)?.status === 'completed'
              ).length;
              const progress = Math.round((langCompleted / narratedSections.length) * 100);
              await supabase
                .from('language_avatar_jobs')
                .update({
                  status: 'completed',
                  progress,
                  error_message: `Partial: ${langCompleted}/${narratedSections.length} sections completed (stall timeout)`,
                  updated_at: new Date().toISOString(),
                })
                .eq('video_job_id', job.video_job_id)
                .eq('language', lang);
              console.log(`[LangWorker] Force-completed ${lang} at ${langCompleted}/${narratedSections.length} (stall timeout)`);
            }
          }
          job.stall_detected_at = null;
          job.last_progress_count = null;
          return 'completed';
        }
      }
    } else {
      // Progress was made, reset stall timer
      if (job.stall_detected_at) {
        console.log(`[LangWorker] Stall cleared for ${job.video_job_id}: progress advanced to ${totalCompleted}/${totalExpected}`);
      }
      job.stall_detected_at = null;
      job.last_progress_count = totalCompleted;
    }

    // Check for stale job (submitted > 2 hours ago with no progress)
    if (job.submitted_at) {
      const submittedAt = new Date(job.submitted_at).getTime();
      if (Date.now() - submittedAt > 2 * 60 * 60 * 1000) {
        console.log(`[LangWorker] Job ${job.video_job_id} stale (>2h), marking failed`);
        job.error_message = 'Stale: no completion after 2 hours';
        return 'failed';
      }
    }

    return 'processing';
  } catch (err) {
    console.error(`[LangWorker] Poll error for ${job.video_job_id}:`, err);
    return 'processing';
  }
}
