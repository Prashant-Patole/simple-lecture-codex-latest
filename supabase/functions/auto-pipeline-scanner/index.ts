// Auto Pipeline Scanner - Server-side scan/audit for video generation pipeline
// Supports two modes:
//   action: 'init' - Create run record, count topics, return chapter list
//   action: 'scan_chapter' - Scan one chapter's topics, append results to DB
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScanResult {
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
  category: 'healthy' | 'needs_repair' | 'needs_new_job' | 'no_document';
  selected: boolean;
  existingJobId: string | null;
  externalJobId: string | null;
  serverIp: string | null;
  missingPhases: string[];
  sanityData: any | null;
}

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

async function runSanityCheck(externalJobId: string, serverIp: string, topicName?: string): Promise<any | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const resp = await fetch(`${supabaseUrl}/functions/v1/video-generation-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({ action: 'sanity_check', job_id: externalJobId, server_ip: serverIp }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      console.log(`[Scanner] SANITY_FAIL | topic="${topicName}" | job=${externalJobId} | error=http_${resp.status}`);
      return null;
    }
    return await resp.json();
  } catch (err) {
    clearTimeout(timeout);
    const reason = err?.name === 'AbortError' ? 'timeout' : String(err);
    console.log(`[Scanner] SANITY_FAIL | topic="${topicName}" | job=${externalJobId} | error=${reason}`);
    return null;
  }
}

// ---- INIT MODE: Create run, count topics, return chapter list ----
async function handleInit(supabase: any, body: any) {
  const { subject_id, subject_name, chapter_ids, selected_ips } = body;

  if (!subject_id || !subject_name || !chapter_ids?.length) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Fetch chapters
  const { data: chapters } = await supabase
    .from('subject_chapters')
    .select('id, title, chapter_number')
    .in('id', chapter_ids)
    .order('chapter_number');

  if (!chapters || chapters.length === 0) {
    return new Response(JSON.stringify({ error: 'No chapters found' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Count total topics across all chapters
  let totalTopics = 0;
  for (const chapter of chapters) {
    const { count } = await supabase
      .from('subject_topics')
      .select('*', { count: 'exact', head: true })
      .eq('chapter_id', chapter.id);
    totalTopics += count || 0;
  }

  // Create pipeline run record
  const { data: run, error: insertError } = await supabase
    .from('auto_pipeline_runs')
    .insert([{
      subject_id,
      subject_name,
      status: 'scanning',
      selected_ips: selected_ips || [],
      chapters_data: [],
      scan_results: [],
      current_chapter_index: 0,
      total_jobs: totalTopics,
      completed_jobs: 0,
      good_jobs: 0,
      bad_jobs: 0,
    }])
    .select('id')
    .single();

  if (insertError || !run) {
    console.error('[Scanner] Failed to create run:', insertError);
    return new Response(JSON.stringify({ error: 'Failed to create scan run' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log(`[Scanner] INIT | runId=${run.id} | subject="${subject_name}" | chapters=${chapters.length} | totalTopics=${totalTopics}`);

  return new Response(JSON.stringify({
    runId: run.id,
    totalTopics,
    chapters: chapters.map((c: any) => ({ id: c.id, title: c.title, chapter_number: c.chapter_number })),
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ---- SCAN_CHAPTER MODE: Scan one chapter's topics, append to DB ----
async function handleScanChapter(supabase: any, body: any) {
  const { run_id, chapter_id, subject_id } = body;

  if (!run_id || !chapter_id || !subject_id) {
    return new Response(JSON.stringify({ error: 'Missing run_id, chapter_id, or subject_id' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check if run is still active (not cancelled)
  const { data: runData } = await supabase
    .from('auto_pipeline_runs')
    .select('status, scan_results, completed_jobs, total_jobs')
    .eq('id', run_id)
    .single();

  if (!runData) {
    return new Response(JSON.stringify({ error: 'Run not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (runData.status === 'cancelled') {
    console.log(`[Scanner] CANCELLED | runId=${run_id}`);
    return new Response(JSON.stringify({ cancelled: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Load existing results
  const existingResults: ScanResult[] = (runData.scan_results as ScanResult[]) || [];
  let scannedCount = runData.completed_jobs || 0;
  const totalTopics = runData.total_jobs || 0;

  // Fetch chapter info
  const { data: chapter } = await supabase
    .from('subject_chapters')
    .select('id, title, chapter_number')
    .eq('id', chapter_id)
    .single();

  if (!chapter) {
    return new Response(JSON.stringify({ error: 'Chapter not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Fetch topics for this chapter
  const { data: topics } = await supabase
    .from('subject_topics')
    .select('id, title, topic_number, sequence_order')
    .eq('chapter_id', chapter_id)
    .order('sequence_order');

  const allTopics = topics || [];
  const chapterResults: ScanResult[] = [];

  console.log(`[Scanner] SCAN_CHAPTER | runId=${run_id} | ch=${chapter.chapter_number} "${chapter.title}" | topics=${allTopics.length}`);

  for (const topic of allTopics) {
    scannedCount++;

    // Find document (topic-level first, then chapter-level fallback)
    let doc: any = null;

    // Fetch ALL documents for this topic (for dedup job lookup)
    const { data: topicDocs } = await supabase
      .from('ai_assistant_documents')
      .select('id, display_name, file_name, source_url, source_type')
      .eq('subject_id', subject_id)
      .eq('topic_id', topic.id)
      .not('source_url', 'is', null)
      .order('created_at', { ascending: true });
    
    // Pick the oldest document deterministically
    doc = topicDocs?.[0] || null;
    
    // Also collect ALL document IDs for this topic (for cross-document job lookup)
    const allTopicDocIds: string[] = (topicDocs || []).map((d: any) => d.id);

    if (!doc) {
      const { data: chapterDocs } = await supabase
        .from('ai_assistant_documents')
        .select('id, display_name, file_name, source_url, source_type')
        .eq('subject_id', subject_id)
        .eq('chapter_id', chapter_id)
        .is('topic_id', null)
        .not('source_url', 'is', null)
        .order('created_at', { ascending: true })
        .limit(1);
      doc = chapterDocs?.[0] || null;
      if (doc) allTopicDocIds.push(doc.id);
    }
    const baseScanResult = {
      topicId: topic.id,
      topicName: topic.title,
      topicNumber: typeof topic.topic_number === 'string' ? parseInt(topic.topic_number) || 0 : topic.topic_number,
      chapterId: chapter.id,
      chapterName: chapter.title,
      chapterNumber: chapter.chapter_number,
      documentId: doc?.id || null,
      documentName: doc?.display_name || doc?.file_name || null,
      sourceUrl: doc?.source_url || null,
      sourceType: doc?.source_type || null,
      fileName: doc?.file_name || null,
    };

    let result: ScanResult;

    if (!doc || !doc.source_url) {
      result = { ...baseScanResult, category: 'no_document', selected: false, existingJobId: null, externalJobId: null, serverIp: null, missingPhases: [], sanityData: null };
    } else {
      // Find best existing job across ALL documents for this topic
      const { data: allJobs } = await supabase
        .from('video_generation_jobs')
        .select('id, status, external_job_id, server_ip')
        .in('document_id', allTopicDocIds)
        .order('created_at', { ascending: false });

      const jobs = allJobs || [];
      const bestJob = jobs.find((j: any) => j.status === 'completed')
        || jobs.find((j: any) => j.status === 'completed_with_errors');

      if (!bestJob || !bestJob.external_job_id || !bestJob.server_ip) {
        result = { ...baseScanResult, category: 'needs_new_job', selected: true, existingJobId: bestJob?.id || null, externalJobId: null, serverIp: null, missingPhases: [], sanityData: null };
      } else {
        const sanity = await runSanityCheck(bestJob.external_job_id, bestJob.server_ip, topic.title);

        if (!sanity) {
          result = { ...baseScanResult, category: 'needs_repair', selected: true, existingJobId: bestJob.id, externalJobId: bestJob.external_job_id, serverIp: bestJob.server_ip, missingPhases: ['sanity_check_failed'], sanityData: null };
        } else {
          const missing = getMissingPhases(sanity);
          if (missing.length === 0) {
            result = { ...baseScanResult, category: 'healthy', selected: false, existingJobId: bestJob.id, externalJobId: bestJob.external_job_id, serverIp: bestJob.server_ip, missingPhases: [], sanityData: sanity };
          } else {
            result = { ...baseScanResult, category: 'needs_repair', selected: true, existingJobId: bestJob.id, externalJobId: bestJob.external_job_id, serverIp: bestJob.server_ip, missingPhases: missing, sanityData: sanity };
          }
        }
      }
    }

    chapterResults.push(result);

    // Update DB after every topic for real-time progress
    const allResults = [...existingResults, ...chapterResults];
    await supabase
      .from('auto_pipeline_runs')
      .update({
        scan_results: allResults as any,
        completed_jobs: scannedCount,
      })
      .eq('id', run_id);
  }

  // Check if all topics are now scanned
  const allResults = [...existingResults, ...chapterResults];
  const isComplete = scannedCount >= totalTopics;

  if (isComplete) {
    const healthy = allResults.filter(r => r.category === 'healthy').length;
    const repair = allResults.filter(r => r.category === 'needs_repair').length;
    const newJob = allResults.filter(r => r.category === 'needs_new_job').length;
    const noDoc = allResults.filter(r => r.category === 'no_document').length;

    console.log(`[Scanner] DONE | runId=${run_id} | total=${allResults.length} | healthy=${healthy} | repair=${repair} | newJob=${newJob} | noDoc=${noDoc}`);

    await supabase
      .from('auto_pipeline_runs')
      .update({
        status: 'scan_complete',
        scan_results: allResults as any,
        completed_jobs: scannedCount,
      })
      .eq('id', run_id);
  }

  return new Response(JSON.stringify({
    done: isComplete,
    chapterTopics: chapterResults.length,
    totalScanned: scannedCount,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ---- MAIN HANDLER ----
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const action = body.action || 'legacy';

    if (action === 'init') {
      return await handleInit(supabase, body);
    }

    if (action === 'scan_chapter') {
      return await handleScanChapter(supabase, body);
    }

    // Legacy mode (shouldn't be used anymore but kept for safety)
    return new Response(JSON.stringify({ error: 'Use action: init or scan_chapter' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[Scanner] ERROR:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
