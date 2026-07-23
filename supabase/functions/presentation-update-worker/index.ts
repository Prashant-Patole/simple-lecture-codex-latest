// Presentation Update Worker - Server-side worker for bulk presentation_json refresh
// Called by pg_cron every minute
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SOFT_LOCK_SECONDS = 50;

interface JobQueueItem {
  video_job_id: string;
  external_job_id: string;
  server_ip: string;
  status: 'pending' | 'completed' | 'failed' | 'skipped';
  error_message: string | null;
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
      .from('presentation_update_runs')
      .select('*')
      .eq('status', 'processing')
      .order('created_at', { ascending: true })
      .limit(3);

    if (fetchError) {
      console.error('[PRES_UPDATE] Error fetching runs:', fetchError.message);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!runs || runs.length === 0) {
      return new Response(JSON.stringify({ message: 'No active runs' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[PRES_UPDATE] Found ${runs.length} active run(s)`);

    for (const run of runs) {
      // Soft-lock check
      const updatedAt = new Date(run.updated_at).getTime();
      const now = Date.now();
      if (now - updatedAt < SOFT_LOCK_SECONDS * 1000) {
        console.log(`[PRES_UPDATE] Run ${run.id} soft-locked (updated ${Math.round((now - updatedAt) / 1000)}s ago), skipping`);
        continue;
      }

      // Touch updated_at to claim this run
      await supabase
        .from('presentation_update_runs')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', run.id);

      await processRun(supabase, run);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[PRES_UPDATE] Unhandled error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processRun(supabase: any, run: any) {
  const jobs: JobQueueItem[] = run.job_queue || [];
  if (jobs.length === 0) {
    console.log(`[PRES_UPDATE] Run ${run.id} has no jobs, marking completed`);
    await updateRun(supabase, run.id, { status: 'completed' });
    return;
  }

  // Re-check run status (might have been cancelled)
  const { data: freshRun } = await supabase
    .from('presentation_update_runs')
    .select('status')
    .eq('id', run.id)
    .single();

  if (freshRun?.status === 'cancelled') {
    console.log(`[PRES_UPDATE] Run ${run.id} was cancelled, stopping`);
    return;
  }

  let idx = run.current_job_index;
  let completed = run.completed_jobs;
  let failed = run.failed_jobs;
  let skipped = run.skipped_jobs;

  // Process multiple jobs per invocation (up to 10) to speed things up
  const MAX_PER_INVOCATION = 10;
  let processed = 0;

  while (idx < jobs.length && processed < MAX_PER_INVOCATION) {
    const job = jobs[idx];
    const jobNum = idx + 1;
    const total = jobs.length;

    console.log(`[PRES_UPDATE] Run ${run.id} | Job ${jobNum}/${total} | ${job.external_job_id} on ${job.server_ip}`);

    try {
      // Fetch presentation.json via video-generation-proxy
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

      const resp = await fetch(`${supabaseUrl}/functions/v1/video-generation-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          action: 'review',
          job_id: job.external_job_id,
          server_ip: job.server_ip,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        if (errText.includes('No route to host') || errText.includes('Connection refused') || errText.includes('tcp connect error')) {
          console.warn(`[PRES_UPDATE] Job ${jobNum}/${total}: ${job.external_job_id} -- SKIPPED: server unreachable`);
          job.status = 'skipped';
          job.error_message = 'Server unreachable';
          skipped++;
        } else {
          console.error(`[PRES_UPDATE] Job ${jobNum}/${total}: ${job.external_job_id} -- FAILED: ${errText}`);
          job.status = 'failed';
          job.error_message = errText.substring(0, 500);
          failed++;
        }
        idx++;
        processed++;
        continue;
      }

      const reviewData = await resp.json();
      console.log(`[PRES_UPDATE] Job ${jobNum}/${total}: ${job.external_job_id} -- fetched OK, updating DB...`);

      // Update presentation_json in video_generation_jobs
      const { error: updateError } = await supabase
        .from('video_generation_jobs')
        .update({ presentation_json: reviewData })
        .eq('id', job.video_job_id);

      if (updateError) {
        console.error(`[PRES_UPDATE] Job ${jobNum}/${total}: ${job.external_job_id} -- DB update FAILED: ${updateError.message}`);
        job.status = 'failed';
        job.error_message = updateError.message;
        failed++;
      } else {
        console.log(`[PRES_UPDATE] Job ${jobNum}/${total}: ${job.external_job_id} -- DB updated successfully`);
        job.status = 'completed';
        completed++;
      }
    } catch (err: any) {
      const errStr = err?.message || String(err);
      if (errStr.includes('No route to host') || errStr.includes('Connection refused') || errStr.includes('tcp connect error')) {
        console.warn(`[PRES_UPDATE] Job ${jobNum}/${total}: ${job.external_job_id} -- SKIPPED: server unreachable`);
        job.status = 'skipped';
        job.error_message = 'Server unreachable';
        skipped++;
      } else {
        console.error(`[PRES_UPDATE] Job ${jobNum}/${total}: ${job.external_job_id} -- FAILED: ${errStr}`);
        job.status = 'failed';
        job.error_message = errStr.substring(0, 500);
        failed++;
      }
    }

    idx++;
    processed++;
  }

  // Check if all done
  const newStatus = idx >= jobs.length ? 'completed' : 'processing';
  if (newStatus === 'completed') {
    console.log(`[PRES_UPDATE] Run ${run.id} Complete: ${completed} updated, ${failed} failed, ${skipped} skipped`);
  }

  await updateRun(supabase, run.id, {
    status: newStatus,
    job_queue: jobs,
    current_job_index: idx,
    completed_jobs: completed,
    failed_jobs: failed,
    skipped_jobs: skipped,
  });
}

async function updateRun(supabase: any, runId: string, updates: Record<string, any>) {
  const { error } = await supabase
    .from('presentation_update_runs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', runId);

  if (error) {
    console.error(`[PRES_UPDATE] Failed to update run ${runId}:`, error.message);
  }
}
