// Auto Pipeline Worker - Server-side orchestrator for video generation pipeline
// Called by pg_cron every minute + on-demand after user approval
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_RETRIES = 3;
const MAX_JOBS_PER_IP = 2;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 min max per invocation
const STALE_PROCESSING_HOURS = 2;
const REPAIR_POLL_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes between sanity polls during repair
const REPAIR_RETRY_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes before auto-retrying a stalled repair

// --- Recovery: Rebuild job_queue from chapters_data ---
function tryRecoverQueueFromChaptersData(chaptersData: any): JobQueueItem[] | null {
  if (!chaptersData || !Array.isArray(chaptersData)) return null;
  
  const recovered: JobQueueItem[] = [];
  for (const chapter of chaptersData) {
    if (!chapter.jobs || !Array.isArray(chapter.jobs)) continue;
    for (const job of chapter.jobs) {
      const statusMap: Record<string, string> = {
        'already_done': 'skipped',
        'done_good': 'done_good',
        'done_bad': 'done_bad',
        'processing': 'queued',
        'submitting': 'queued',
        'sanity_checking': 'queued',
        'retrying': 'queued',
        'needs_repair': 'queued',
        'queued': 'queued',
      };
      
      recovered.push({
        topicId: job.topicId,
        topicName: job.topicName,
        topicNumber: job.topicNumber,
        chapterId: job.chapterId,
        chapterName: job.chapterName,
        chapterNumber: job.chapterNumber,
        documentId: job.documentId,
        documentName: job.documentName,
        sourceUrl: job.sourceUrl,
        sourceType: job.sourceType,
        fileName: job.fileName,
        category: job.category || 'needs_new_job',
        status: (statusMap[job.status] || 'queued') as JobQueueItem['status'],
        externalJobId: job.externalJobId,
        serverIp: job.serverIp,
        retryCount: job.retryCount || 0,
        retryDetails: job.retryDetails || [],
        errorMessage: job.errorMessage,
        failedPhases: job.failedPhases || [],
        submittedAt: job.submittedAt,
        completedAt: job.completedAt,
        lastPolledAt: null,
        repairStartedAt: null,
      });
    }
  }
  return recovered.length > 0 ? recovered : null;
}

interface JobQueueItem {
  topicId: string;
  topicName: string;
  topicNumber: number;
  chapterId: string;
  chapterName: string;
  chapterNumber: number;
  documentId: string | null;
  documentName: string | null;
  sourceUrl: string | null;
  sourceType: string | null;
  fileName: string | null;
  category: 'needs_repair' | 'needs_new_job' | 'healthy';
  status: 'queued' | 'submitting' | 'processing' | 'sanity_checking' | 'retrying' | 'done_good' | 'done_bad' | 'skipped';
  externalJobId: string | null;
  serverIp: string | null;
  retryCount: number;
  retryDetails: Array<{ phase: string; attempt: number; error: string; timestamp: string }>;
  errorMessage: string | null;
  failedPhases: string[];
  submittedAt: string | null;
  completedAt: string | null;
  lastPolledAt: string | null;
  repairStartedAt: string | null;
}

interface PipelineRun {
  id: string;
  subject_id: string;
  subject_name: string;
  status: string;
  selected_ips: string[];
  job_queue: JobQueueItem[];
  pipeline_config: { max_retries: number; poll_interval_seconds: number; max_jobs_per_ip: number };
  current_chapter_index: number;
  total_jobs: number;
  completed_jobs: number;
  good_jobs: number;
  bad_jobs: number;
  created_by: string | null;
}

function getExternalApiBase(serverIp: string): string {
  return `http://${serverIp}:5005`;
}

// --- Helper: Generate job prefix ---
function generateJobPrefix(subjectName: string): string {
  const sanitized = subjectName.replace(/\s+/g, '');
  const now = new Date();
  const ts = now.getFullYear().toString()
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0')
    + String(now.getHours()).padStart(2, '0')
    + String(now.getMinutes()).padStart(2, '0')
    + String(now.getSeconds()).padStart(2, '0')
    + String(now.getMilliseconds()).padStart(3, '0');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return `${sanitized}_${ts}_${code}`;
}

// --- Verify a single stale job with the generation server before mutating it ---
async function reconcileStaleJob(supabase: any, serverIp: string, row: { id: string; external_job_id: string | null }) {
  if (!row.external_job_id) return;
  try {
    const resp = await fetch(`http://${serverIp}:5006/job/${row.external_job_id}/status`);
    if (!resp.ok) return; // unreachable / not found -> leave alone
    const data = await resp.json();

    if (data?.status === 'completed') {
      await supabase
        .from('video_generation_jobs')
        .update({
          status: 'completed',
          progress: 100,
          video_url: data.player_url || data.video_url || `http://${serverIp}:5005/player_v2/?job=${row.external_job_id}`,
          completed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq('id', row.id);
    } else if (data?.status === 'failed') {
      await supabase
        .from('video_generation_jobs')
        .update({
          status: 'failed',
          error_message: data?.error || 'Job failed on server',
        })
        .eq('id', row.id);
    }
    // processing / pending / anything else -> leave row untouched
  } catch (_e) {
    // network error -> leave row untouched, retry next cycle
  }
}

// --- Count active jobs per IP (verifies stale rows with the server before flipping them) ---
async function countActiveJobsOnIp(supabase: any, serverIp: string): Promise<number> {
  const cutoff3h = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

  const { data: stalePending } = await supabase
    .from('video_generation_jobs')
    .select('id, external_job_id')
    .eq('server_ip', serverIp)
    .eq('status', 'pending')
    .lt('created_at', cutoff3h);

  const { data: staleProcessing } = await supabase
    .from('video_generation_jobs')
    .select('id, external_job_id')
    .eq('server_ip', serverIp)
    .eq('status', 'processing')
    .lt('created_at', cutoff3h);

  const stale = [...(stalePending || []), ...(staleProcessing || [])];
  if (stale.length > 0) {
    await Promise.all(stale.map((r: any) => reconcileStaleJob(supabase, serverIp, r)));
  }

  // Only count jobs within the recent window for slot capacity.
  // Older rows still in 'processing' on the server won't block new submissions
  // but are no longer destroyed either.
  const { count: pendingCount } = await supabase
    .from('video_generation_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('server_ip', serverIp)
    .eq('status', 'pending')
    .gt('created_at', cutoff3h);

  const { count: processingCount } = await supabase
    .from('video_generation_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('server_ip', serverIp)
    .eq('status', 'processing')
    .gt('created_at', cutoff3h);

  return (pendingCount || 0) + (processingCount || 0);
}

// --- Submit a new job to the external server via proxy ---
async function submitJob(
  supabase: any,
  job: JobQueueItem,
  serverIp: string,
  subjectName: string,
  subjectId: string,
  createdBy: string | null,
): Promise<{ externalJobId: string; dbJobId: string } | 'dedup_skip' | null> {
  try {
    // === DEDUP CHECK: Skip if topic already has a completed/processing job ===
    if (job.documentId) {
      // Get topic_id for this document
      const { data: docRow } = await supabase
        .from('ai_assistant_documents')
        .select('topic_id')
        .eq('id', job.documentId)
        .single();
      
      if (docRow?.topic_id) {
        // Get ALL document IDs for this topic
        const { data: allDocsForTopic } = await supabase
          .from('ai_assistant_documents')
          .select('id')
          .eq('topic_id', docRow.topic_id)
          .not('source_url', 'is', null);
        
        const allDocIds = (allDocsForTopic || []).map((d: any) => d.id);
        
        if (allDocIds.length > 0) {
          const { data: existingJobs } = await supabase
            .from('video_generation_jobs')
            .select('id, status')
            .in('document_id', allDocIds)
            .in('status', ['completed', 'completed_with_errors', 'processing', 'pending'])
            .limit(1);
          
          if (existingJobs && existingJobs.length > 0) {
            console.log(`[Worker] DEDUP_SKIP | topic="${job.topicName}" | existingJob=${existingJobs[0].id} | status=${existingJobs[0].status}`);
            return 'dedup_skip';
          }
        }
      }
    }
    // === END DEDUP CHECK ===

    const jobPrefix = generateJobPrefix(subjectName);

    // We call the video-generation-proxy edge function internally
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const payload: Record<string, any> = {
      action: 'submit',
      subject: subjectName,
      job_prefix: jobPrefix,
      tts_provider: 'our_tts',
      pipeline_version: 'v15_v2_director',
      target_port: 5005,
      server_ip: serverIp,
    };

    if (job.sourceUrl) {
      payload.document_url = job.sourceUrl;
      payload.file_name = job.fileName;
      payload.source_type = job.sourceType;
    }

    console.log(`[Worker] SUBMIT | topic="${job.topicName}" | ip=${serverIp} | docId=${job.documentId}`);

    const resp = await fetch(`${supabaseUrl}/functions/v1/video-generation-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();

    if (!data?.job_id) {
      console.error(`[Worker] SUBMIT_FAIL | topic="${job.topicName}" | error=${data?.message || 'No job ID'}`);
      return null;
    }

    const uniqueId = Math.floor(100000000 + Math.random() * 900000000).toString();

    await supabase.from('video_generation_jobs').insert([{
      id: uniqueId,
      external_job_id: data.job_id,
      document_id: job.documentId,
      subject_id: subjectId,
      document_name: job.documentName,
      status: 'processing',
      created_by: createdBy,
      server_ip: serverIp,
    }]);

    console.log(`[Worker] SUBMIT_OK | topic="${job.topicName}" | extJobId=${data.job_id} | dbJobId=${uniqueId}`);
    return { externalJobId: data.job_id, dbJobId: uniqueId };
  } catch (err) {
    console.error(`[Worker] SUBMIT_ERROR | topic="${job.topicName}" | error=${err}`);
    return null;
  }
}

// --- Poll job status directly ---
async function pollJobStatus(externalJobId: string, serverIp: string): Promise<string> {
  try {
    const apiBase = getExternalApiBase(serverIp);
    const resp = await fetch(`${apiBase}/job/${externalJobId}/status`);
    if (!resp.ok) return 'processing';
    const data = await resp.json();
    return data.status || 'processing';
  } catch {
    return 'processing';
  }
}

// --- Sanity check ---
async function runSanityCheck(externalJobId: string, serverIp: string): Promise<any | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const resp = await fetch(`${supabaseUrl}/functions/v1/video-generation-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ action: 'sanity_check', job_id: externalJobId, server_ip: serverIp }),
    });

    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

// --- Get missing phases from sanity data ---
function getMissingPhases(sanity: any): string[] {
  const missing: string[] = [];
  if (!sanity?.summary) return missing;

  if (sanity.summary.avatar_healthy < sanity.summary.avatar_total) {
    missing.push('avatar_generation');
  }
  if (sanity.summary.topic_healthy < sanity.summary.topic_total) {
    const hasManim = sanity.sections?.some((s: any) => s.renderer === 'manim' && s.topic_video?.status !== 200);
    const hasWan = sanity.sections?.some((s: any) => s.renderer !== 'manim' && s.topic_video?.status !== 200);
    if (hasManim) missing.push('manim_render');
    if (hasWan) missing.push('wan_render');
  }
  return missing;
}

// --- Retry a phase ---
async function retryPhase(externalJobId: string, phase: string, serverIp: string): Promise<boolean> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const resp = await fetch(`${supabaseUrl}/functions/v1/video-generation-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ action: 'retry_phase', job_id: externalJobId, phase, server_ip: serverIp }),
    });

    const data = await resp.json();
    return data?.status !== 'error';
  } catch {
    return false;
  }
}

// --- Check regen status ---
async function checkRegenStatus(externalJobId: string, serverIp: string): Promise<string> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const resp = await fetch(`${supabaseUrl}/functions/v1/video-generation-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ action: 'regen_job_status', job_id: externalJobId, server_ip: serverIp }),
    });

    const data = await resp.json();
    return data?.status || 'idle';
  } catch {
    return 'idle';
  }
}

// --- Create pipeline report ---
async function createReport(
  supabase: any,
  job: JobQueueItem,
  subjectId: string,
  subjectName: string,
  category: 'good' | 'bad',
  status: string,
  createdBy: string | null,
) {
  const duration = job.submittedAt && job.completedAt
    ? Math.round((new Date(job.completedAt).getTime() - new Date(job.submittedAt).getTime()) / 1000)
    : null;

  await supabase.from('auto_pipeline_reports').insert([{
    subject_id: subjectId,
    subject_name: subjectName,
    chapter_id: job.chapterId,
    chapter_name: job.chapterName,
    chapter_number: job.chapterNumber,
    topic_id: job.topicId,
    topic_name: job.topicName,
    topic_number: job.topicNumber,
    document_id: job.documentId,
    external_job_id: job.externalJobId,
    server_ip: job.serverIp,
    category,
    status,
    submitted_at: job.submittedAt,
    completed_at: job.completedAt,
    duration_seconds: duration,
    error_message: job.errorMessage,
    problem_description: job.failedPhases.length > 0
      ? `Missing phases: ${job.failedPhases.join(', ')}`
      : null,
    retry_count: job.retryCount,
    retry_details: job.retryDetails.length > 0 ? job.retryDetails : null,
    failed_phases: job.failedPhases.length > 0 ? job.failedPhases : null,
    created_by: createdBy,
  }]);
}

// --- Find next available IP (with exclude support for failover) ---
function getNextAvailableIp(
  selectedIps: string[],
  slots: Record<string, number>,
  maxPerIp: number,
  excludeIps?: Set<string>,
): string | null {
  for (const ip of selectedIps) {
    if (excludeIps?.has(ip)) continue;
    if ((slots[ip] || 0) < maxPerIp) return ip;
  }
  return null;
}

// --- Sync run stats ---
async function syncRunStats(supabase: any, run: PipelineRun) {
  const doneStatuses = ['done_good', 'done_bad', 'skipped'];
  const jobs = run.job_queue;
  const completedJobs = jobs.filter(j => doneStatuses.includes(j.status)).length;
  const goodJobs = jobs.filter(j => j.status === 'done_good').length;
  const badJobs = jobs.filter(j => j.status === 'done_bad').length;

  const { error } = await supabase
    .from('auto_pipeline_runs')
    .update({
      job_queue: jobs,
      completed_jobs: completedJobs,
      good_jobs: goodJobs,
      bad_jobs: badJobs,
      status: run.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', run.id);

  if (error) {
    console.error(`[Worker] CRITICAL: Failed to sync run ${run.id}: ${error.message}`);
  }
}

// ==================== MAIN WORKER LOGIC ====================

async function processRun(supabase: any, run: PipelineRun) {
  const jobs = run.job_queue;
  if (!jobs || jobs.length === 0) {
    console.log(`[Worker] Run ${run.id} has no jobs, marking completed`);
    run.status = 'completed';
    await syncRunStats(supabase, run);
    return;
  }

  const selectedIps = run.selected_ips || [];
  if (selectedIps.length === 0) {
    console.error(`[Worker] Run ${run.id} has NO selected_ips! Cannot submit jobs. Cancelling run.`);
    await supabase.from('auto_pipeline_runs')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', run.id);
    return;
  }
  const maxPerIp = run.pipeline_config?.max_jobs_per_ip || MAX_JOBS_PER_IP;
  const maxRetries = run.pipeline_config?.max_retries || MAX_RETRIES;
  let changed = false;

  // Track IPs that fail during this worker cycle so we don't retry them
  const failedIpsThisCycle = new Set<string>();

  // === Track which IPs have an active repair in progress ===
  const ipsWithActiveRepair = new Set<string>();
  for (const j of jobs) {
    if (j.serverIp && (j.status === 'retrying' || (j.status === 'sanity_checking' && j.failedPhases && j.failedPhases.length > 0))) {
      ipsWithActiveRepair.add(j.serverIp);
    }
  }

  if (ipsWithActiveRepair.size > 0) {
    console.log(`[Worker] IPs with active repairs: ${[...ipsWithActiveRepair].join(', ')}`);
  }

  // 1. Count current IP slots from DB (actual active jobs)
  const ipSlots: Record<string, number> = {};
  for (const ip of selectedIps) {
    ipSlots[ip] = await countActiveJobsOnIp(supabase, ip);
  }

  // 2. Process each job based on its current status
  for (const job of jobs) {
    // --- QUEUED: Submit new job with IP failover ---
    if (job.status === 'queued') {
      let submitted = false;
      const triedIps = new Set<string>();

      while (!submitted) {
        const ip = getNextAvailableIp(selectedIps, ipSlots, maxPerIp,
          new Set([...failedIpsThisCycle, ...triedIps]));
        if (!ip) {
          if (triedIps.size === 0) {
            console.log(`[Worker] No IP slots available for topic="${job.topicName}", will retry next cycle`);
          }
          break;
        }

        triedIps.add(ip);
        job.status = 'submitting';
        job.serverIp = ip;
        job.submittedAt = new Date().toISOString();
        ipSlots[ip] = (ipSlots[ip] || 0) + 1;

        const result = await submitJob(supabase, job, ip, run.subject_name, run.subject_id, run.created_by);
        if (result === 'dedup_skip') {
          // Topic already has a completed job from another document - skip it
          ipSlots[ip] = Math.max(0, (ipSlots[ip] || 0) - 1);
          job.status = 'skipped';
          job.completedAt = new Date().toISOString();
          job.errorMessage = 'Skipped: topic already has a completed job';
          submitted = true;
          console.log(`[Worker] DEDUP_SKIP | topic="${job.topicName}" already has completed job, skipping`);
        } else if (result) {
          job.externalJobId = result.externalJobId;
          job.status = 'processing';
          job.lastPolledAt = new Date().toISOString();
          submitted = true;
          console.log(`[Worker] Job submitted to IP ${ip} for topic="${job.topicName}"`);
        } else {
          ipSlots[ip] = Math.max(0, (ipSlots[ip] || 0) - 1);
          failedIpsThisCycle.add(ip);
          console.log(`[Worker] IP ${ip} failed for topic="${job.topicName}", trying next IP...`);
        }
      }

      if (!submitted && triedIps.size > 0) {
        job.status = 'done_bad';
        job.errorMessage = `All IPs failed: ${[...triedIps].join(', ')}`;
        job.completedAt = new Date().toISOString();
        await createReport(supabase, job, run.subject_id, run.subject_name, 'bad', 'failed', run.created_by);
      }
      changed = true;
      continue;
    }

    // --- SUBMITTING: Should not stay in this state, treat as processing ---
    if (job.status === 'submitting') {
      if (job.externalJobId) {
        job.status = 'processing';
        changed = true;
      }
      continue;
    }

    // --- PROCESSING: Poll status ---
    if (job.status === 'processing') {
      if (!job.externalJobId || !job.serverIp) {
        job.status = 'done_bad';
        job.errorMessage = 'Missing external job ID or server IP';
        job.completedAt = new Date().toISOString();
        await createReport(supabase, job, run.subject_id, run.subject_name, 'bad', 'failed', run.created_by);
        changed = true;
        continue;
      }

      // Check if stale
      const submittedTime = job.submittedAt ? new Date(job.submittedAt).getTime() : 0;
      if (Date.now() - submittedTime > STALE_PROCESSING_HOURS * 60 * 60 * 1000) {
        job.status = 'done_bad';
        job.errorMessage = `Job stale: processing for over ${STALE_PROCESSING_HOURS} hours`;
        job.completedAt = new Date().toISOString();
        await createReport(supabase, job, run.subject_id, run.subject_name, 'bad', 'timeout', run.created_by);
        changed = true;
        continue;
      }

      const status = await pollJobStatus(job.externalJobId, job.serverIp);
      job.lastPolledAt = new Date().toISOString();
      changed = true;

      if (status === 'completed' || status === 'completed_with_errors') {
        job.status = 'sanity_checking';
        console.log(`[Worker] Job completed for topic="${job.topicName}", moving to sanity check`);
      } else if (status === 'failed') {
        job.status = 'done_bad';
        job.errorMessage = 'Job failed during processing';
        job.completedAt = new Date().toISOString();
        await createReport(supabase, job, run.subject_id, run.subject_name, 'bad', 'failed', run.created_by);
      }
      // else still processing, will check next cycle
      continue;
    }

    // --- SANITY_CHECKING: Run sanity check ---
    if (job.status === 'sanity_checking') {
      if (!job.externalJobId || !job.serverIp) continue;

      // For repair jobs (has failed phases), enforce 3-min poll interval
      if (job.failedPhases && job.failedPhases.length > 0 && job.lastPolledAt) {
        const elapsedSincePoll = Date.now() - new Date(job.lastPolledAt).getTime();
        if (elapsedSincePoll < REPAIR_POLL_INTERVAL_MS) {
          continue; // Too soon, wait for next 3-min cycle
        }
      }

      // Gate - only 1 repair sanity check per IP (skip if another job on same IP was RECENTLY polled/retried)
      if (job.failedPhases && job.failedPhases.length > 0) {
        const otherActiveRepairOnSameIp = jobs.some(j => j !== job && j.serverIp === job.serverIp &&
          (j.status === 'retrying' || 
           (j.status === 'sanity_checking' && j.failedPhases && j.failedPhases.length > 0 && j.lastPolledAt &&
            (Date.now() - new Date(j.lastPolledAt).getTime()) < REPAIR_POLL_INTERVAL_MS)));
        if (otherActiveRepairOnSameIp) {
          continue;
        }
      }

      const sanity = await runSanityCheck(job.externalJobId, job.serverIp);
      job.lastPolledAt = new Date().toISOString();
      changed = true;

      if (!sanity) {
        job.status = 'done_bad';
        job.errorMessage = 'Sanity check request failed';
        job.completedAt = new Date().toISOString();
        await createReport(supabase, job, run.subject_id, run.subject_name, 'bad', 'failed', run.created_by);
        continue;
      }

      const missing = getMissingPhases(sanity);
      if (missing.length === 0) {
        // All repaired! Move on.
        job.status = 'done_good';
        job.completedAt = new Date().toISOString();
        job.failedPhases = [];
        job.repairStartedAt = null;
        const videoUrl = `http://${job.serverIp}:5005/player_v2/?job=${job.externalJobId}`;
        await supabase.from('subject_topics').update({ ai_generated_video_url: videoUrl }).eq('id', job.topicId);
        await createReport(supabase, job, run.subject_id, run.subject_name, 'good', 'completed', run.created_by);
        console.log(`[Worker] Repair SUCCESS for topic="${job.topicName}" on IP ${job.serverIp}`);
      } else {
        job.failedPhases = missing;

        // Check if 30 minutes have passed since repair started → auto-retry
        const repairElapsed = job.repairStartedAt ? Date.now() - new Date(job.repairStartedAt).getTime() : 0;

        if (repairElapsed >= REPAIR_RETRY_THRESHOLD_MS) {
          // 30 min threshold exceeded → trigger fresh retry
          if (job.retryCount < maxRetries) {
            job.status = 'retrying';
            console.log(`[Worker] Repair stalled 30min+ for topic="${job.topicName}", auto-retrying (attempt ${job.retryCount + 1}/${maxRetries})`);
          } else {
            job.status = 'done_bad';
            job.completedAt = new Date().toISOString();
            job.errorMessage = `Failed after ${maxRetries} retries. Missing: ${missing.join(', ')}`;
            job.repairStartedAt = null;
            await createReport(supabase, job, run.subject_id, run.subject_name, 'bad', 'partial', run.created_by);
          }
        } else {
          // Still within 30-min window, just log and wait for next 3-min poll
          console.log(`[Worker] Repair polling for topic="${job.topicName}": still missing [${missing.join(', ')}], ${Math.round(repairElapsed / 60000)}min elapsed`);
        }
      }
      continue;
    }

    // --- RETRYING: Retry missing phases ---
    if (job.status === 'retrying') {
      if (!job.externalJobId || !job.serverIp) continue;

      // 3-min interval between retry attempts
      if (job.lastPolledAt) {
        const elapsed = Date.now() - new Date(job.lastPolledAt).getTime();
        if (elapsed < REPAIR_POLL_INTERVAL_MS) {
          continue; // Too soon, wait
        }
      }

      // Gate - only 1 repair per IP (only block if another is actively being processed recently)
      const otherActiveRepairOnSameIp = jobs.some(j => j !== job && j.serverIp === job.serverIp &&
        (j.status === 'retrying' || 
         (j.status === 'sanity_checking' && j.failedPhases && j.failedPhases.length > 0 && j.lastPolledAt &&
          (Date.now() - new Date(j.lastPolledAt).getTime()) < REPAIR_POLL_INTERVAL_MS)));
      if (otherActiveRepairOnSameIp) {
        continue;
      }

      job.retryCount++;
      changed = true;
      console.log(`[Worker] RETRY attempt ${job.retryCount}/${maxRetries} for topic="${job.topicName}" | phases=[${job.failedPhases.join(', ')}]`);

      // First check current regen status - if already running, skip this cycle
      const regenStatus = await checkRegenStatus(job.externalJobId, job.serverIp);
      if (regenStatus === 'processing' || regenStatus === 'running') {
        console.log(`[Worker] Regen already running for topic="${job.topicName}", waiting...`);
        job.retryCount--; // Don't count this as an attempt
        job.lastPolledAt = new Date().toISOString();
        continue;
      }

      // Retry each missing phase
      for (const phase of job.failedPhases) {
        const result = await retryPhase(job.externalJobId, phase, job.serverIp);
        job.retryDetails.push({
          phase,
          attempt: job.retryCount,
          error: result ? '' : 'retry_phase failed',
          timestamp: new Date().toISOString(),
        });
      }

      // New repair cycle begins — reset repairStartedAt and move to sanity_checking
      job.status = 'sanity_checking';
      job.repairStartedAt = new Date().toISOString(); // Fresh 30-min window
      job.lastPolledAt = new Date().toISOString(); // Start 3-min poll cycle
      console.log(`[Worker] Retry submitted for topic="${job.topicName}", polling every 3min (30min threshold)`);
      continue;
    }

    // --- NEEDS_REPAIR: Start repair cycle ---
    if (job.status === 'needs_repair' as string) {
      if (!job.externalJobId || !job.serverIp) {
        job.status = 'done_bad';
        job.errorMessage = 'Cannot repair: missing external job ID or server IP';
        job.completedAt = new Date().toISOString();
        await createReport(supabase, job, run.subject_id, run.subject_name, 'bad', 'failed', run.created_by);
        changed = true;
        continue;
      }

      // Gate - only 1 repair per IP at a time (only block if another was recently polled)
      const otherActiveRepairOnSameIp = jobs.some(j => j !== job && j.serverIp === job.serverIp &&
        (j.status === 'retrying' || 
         (j.status === 'sanity_checking' && j.failedPhases && j.failedPhases.length > 0 && j.lastPolledAt &&
          (Date.now() - new Date(j.lastPolledAt).getTime()) < REPAIR_POLL_INTERVAL_MS)));
      if (otherActiveRepairOnSameIp) {
        console.log(`[Worker] IP ${job.serverIp} busy with another repair, skipping needs_repair for topic="${job.topicName}"`);
        continue;
      }

      // Fresh sanity check to get current missing phases
      const sanity = await runSanityCheck(job.externalJobId, job.serverIp);
      changed = true;

      if (!sanity) {
        job.retryDetails.push({ phase: 'sanity_check', attempt: 0, error: 'Sanity check failed', timestamp: new Date().toISOString() });
        continue;
      }

      const missing = getMissingPhases(sanity);
      if (missing.length === 0) {
        job.status = 'done_good';
        job.completedAt = new Date().toISOString();
        job.failedPhases = [];
        const videoUrl = `http://${job.serverIp}:5005/player_v2/?job=${job.externalJobId}`;
        await supabase.from('subject_topics').update({ ai_generated_video_url: videoUrl }).eq('id', job.topicId);
        await createReport(supabase, job, run.subject_id, run.subject_name, 'good', 'repaired', run.created_by);
      } else {
        job.failedPhases = missing;
        job.status = 'retrying';
        job.repairStartedAt = new Date().toISOString(); // Track when repair cycle started (30-min window)
        job.lastPolledAt = new Date().toISOString(); // Start 3-min poll interval
        console.log(`[Worker] Repair needed for topic="${job.topicName}", phases=[${missing.join(', ')}], 3-min polling started`);
      }
      continue;
    }
  }

  // 3. Check if all jobs are done
  const doneStatuses = ['done_good', 'done_bad', 'skipped'];
  const allDone = jobs.every(j => doneStatuses.includes(j.status));

  if (allDone) {
    run.status = 'completed';
    console.log(`[Worker] Run ${run.id} completed! Good: ${jobs.filter(j => j.status === 'done_good').length}, Bad: ${jobs.filter(j => j.status === 'done_bad').length}`);
  }

  // 4. Sync to DB
  await syncRunStats(supabase, run);

  // === NEW: Throttle chapters_data updates for large runs ===
  const shouldUpdateChapters = allDone || jobs.length < 100 || Math.random() < 0.2;
  if (changed && shouldUpdateChapters) {
    await updateChaptersData(supabase, run);
  }
}

// --- Update chapters_data from job_queue for UI compatibility ---
async function updateChaptersData(supabase: any, run: PipelineRun) {
  const jobs = run.job_queue;
  const chapterMap = new Map<string, any>();

  for (const job of jobs) {
    if (!chapterMap.has(job.chapterId)) {
      chapterMap.set(job.chapterId, {
        chapterId: job.chapterId,
        chapterName: job.chapterName,
        chapterNumber: job.chapterNumber,
        jobs: [],
        status: 'processing',
      });
    }
    
    // Map job_queue status to PipelineJob format
    const pipelineJob = {
      id: `${job.chapterId}_${job.topicId}`,
      chapterId: job.chapterId,
      chapterName: job.chapterName,
      chapterNumber: job.chapterNumber,
      topicId: job.topicId,
      topicName: job.topicName,
      topicNumber: job.topicNumber,
      documentId: job.documentId,
      documentName: job.documentName,
      sourceUrl: job.sourceUrl,
      sourceType: job.sourceType,
      fileName: job.fileName,
      status: job.status === 'skipped' ? 'already_done' : job.status,
      externalJobId: job.externalJobId,
      serverIp: job.serverIp,
      submittedAt: job.submittedAt,
      startedAt: job.submittedAt,
      completedAt: job.completedAt,
      retryCount: job.retryCount,
      retryDetails: job.retryDetails,
      errorMessage: job.errorMessage,
      sanityData: null,
      failedPhases: job.failedPhases,
    };

    chapterMap.get(job.chapterId).jobs.push(pipelineJob);
  }

  // Determine chapter statuses
  const chapters = Array.from(chapterMap.values()).sort((a, b) => a.chapterNumber - b.chapterNumber);
  const doneStatuses = ['done_good', 'done_bad', 'skipped', 'already_done'];
  
  for (const ch of chapters) {
    const allChDone = ch.jobs.every((j: any) => doneStatuses.includes(j.status));
    const anyProcessing = ch.jobs.some((j: any) => ['processing', 'submitting', 'sanity_checking', 'retrying', 'queued', 'needs_repair'].includes(j.status));
    ch.status = allChDone ? 'done' : anyProcessing ? 'processing' : 'pending';
  }

  await supabase
    .from('auto_pipeline_runs')
    .update({ chapters_data: chapters })
    .eq('id', run.id);
}

// ==================== ENTRY POINT ====================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    // === CHANGED: Process only 1 run per invocation, with soft-lock in query ===
    const { data: activeRuns, error } = await supabase
      .from('auto_pipeline_runs')
      .select('id, subject_id, subject_name, status, selected_ips, job_queue, pipeline_config, current_chapter_index, total_jobs, completed_jobs, good_jobs, bad_jobs, created_by, updated_at')
      .in('status', ['running'])
      .lt('updated_at', new Date(Date.now() - 50_000).toISOString())
      .order('started_at', { ascending: true })
      .limit(1);

    if (error) {
      console.error(`[Worker] DB query error: ${error.message}`);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!activeRuns || activeRuns.length === 0) {
      return new Response(JSON.stringify({ message: 'No active runs', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Worker] Processing 1 run (of possibly more)`);

    let processed = 0;
    for (const rawRun of activeRuns) {
      const run: PipelineRun = {
        id: rawRun.id,
        subject_id: rawRun.subject_id,
        subject_name: rawRun.subject_name,
        status: rawRun.status,
        selected_ips: (rawRun.selected_ips || []) as string[],
        job_queue: (rawRun.job_queue || []) as JobQueueItem[],
        pipeline_config: (rawRun.pipeline_config || { max_retries: 3, poll_interval_seconds: 10, max_jobs_per_ip: 2 }) as any,
        current_chapter_index: rawRun.current_chapter_index,
        total_jobs: rawRun.total_jobs,
        completed_jobs: rawRun.completed_jobs,
        good_jobs: rawRun.good_jobs,
        bad_jobs: rawRun.bad_jobs,
        created_by: rawRun.created_by,
      };

      if (run.job_queue.length === 0) {
        // Try to recover from chapters_data - need to fetch it separately
        const { data: fullRun } = await supabase
          .from('auto_pipeline_runs')
          .select('chapters_data')
          .eq('id', run.id)
          .single();
        
        const recovered = tryRecoverQueueFromChaptersData(fullRun?.chapters_data);
        if (recovered && recovered.length > 0) {
          console.log(`[Worker] Recovered ${recovered.length} jobs from chapters_data for run ${run.id}`);
          run.job_queue = recovered;
        } else {
          console.log(`[Worker] Run ${run.id} has empty job_queue and no recovery possible, skipping`);
          continue;
        }
      }

      await processRun(supabase, run);
      processed++;
    }

    return new Response(JSON.stringify({ message: 'OK', processed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(`[Worker] Unhandled error: ${err}`);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
