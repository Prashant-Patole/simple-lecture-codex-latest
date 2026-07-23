import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL } from '@/lib/supabaseUrl';
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { SubjectChapter, SubjectTopic } from "./useSubjectManagement";
import type { SanityCheckData } from "./useVideoGenerationJobs";

// --- Types ---

export type PipelineJobStatus = 
  | 'queued' 
  | 'submitting' 
  | 'processing' 
  | 'sanity_checking' 
  | 'retrying' 
  | 'done_good' 
  | 'done_bad' 
  | 'no_document'
  | 'already_done'
  | 'needs_repair';

export interface ScanResult {
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
  sanityData: SanityCheckData | null;
}

export interface PipelineJob {
  id: string;
  chapterId: string;
  chapterName: string;
  chapterNumber: number;
  topicId: string;
  topicName: string;
  topicNumber: number;
  documentId: string | null;
  documentName: string | null;
  sourceUrl: string | null;
  sourceType: string | null;
  fileName: string | null;
  status: PipelineJobStatus;
  externalJobId: string | null;
  serverIp: string | null;
  submittedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  retryCount: number;
  retryDetails: Array<{ phase: string; attempt: number; error: string; timestamp: string }>;
  errorMessage: string | null;
  sanityData: SanityCheckData | null;
  failedPhases: string[];
}

export interface ChapterProgress {
  chapterId: string;
  chapterName: string;
  chapterNumber: number;
  jobs: PipelineJob[];
  status: 'pending' | 'processing' | 'waiting_approval' | 'done';
}

export type PipelineState = 'idle' | 'building_queue' | 'scanning' | 'scan_complete' | 'running' | 'paused_for_approval' | 'completed' | 'cancelled' | 'interrupted';

// Max retries for failed sanity checks
const MAX_RETRIES = 3;
const POLL_INTERVAL = 10000; // 10 seconds
const MAX_JOBS_PER_IP = 2;

// --- Helper: Generate job prefix ---
async function generateJobPrefix(subjectName: string): Promise<string> {
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
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const fullPrefix = `${sanitized}_${ts}_${code}`;

  console.log(`[AutoPipeline] JOB_PREFIX | prefix=${fullPrefix}`);

  try {
    await supabase.from('video_job_prefixes').insert([{
      random_code: code,
      full_prefix: fullPrefix,
      subject_name: sanitized,
    }]);
  } catch {
    // Ignore collision, still usable
  }

  return fullPrefix;
}

// --- Main Hook ---
export function useAutoPipeline() {
  const queryClient = useQueryClient();
  const [pipelineState, setPipelineState] = useState<PipelineState>('idle');
  const [chapters, setChapters] = useState<ChapterProgress[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [activeIpSlots, setActiveIpSlots] = useState<Record<string, number>>({});
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const cancelledRef = useRef(false);
  const runningRef = useRef(false);
  const pipelineRunIdRef = useRef<string | null>(null);
  const selectedIpsRef = useRef<string[]>([]);

  // --- DB persistence helpers ---
  const insertPipelineRun = async (
    subjectId: string,
    subjectName: string,
    chaptersData: ChapterProgress[],
    selectedIps: string[],
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    const allJobs = chaptersData.flatMap(c => c.jobs);
    const { data, error } = await supabase
      .from('auto_pipeline_runs')
      .insert([{
        subject_id: subjectId,
        subject_name: subjectName,
        status: 'building_queue',
        selected_ips: selectedIps,
        chapters_data: chaptersData as any,
        current_chapter_index: 0,
        total_jobs: allJobs.length,
        completed_jobs: 0,
        good_jobs: 0,
        bad_jobs: 0,
        created_by: user?.id,
      }])
      .select('id')
      .single();
    if (!error && data) {
      pipelineRunIdRef.current = data.id;
      console.log(`[AutoPipeline] DB_INSERT | runId=${data.id}`);
    }
  };

  const syncPipelineRun = async (
    status: string,
    chaptersData: ChapterProgress[],
    chapterIndex: number,
  ) => {
    if (!pipelineRunIdRef.current) return;
    const allJobs = chaptersData.flatMap(c => c.jobs);
    const doneStatuses = ['done_good', 'done_bad', 'no_document', 'already_done'];
    await supabase
      .from('auto_pipeline_runs')
      .update({
        status,
        chapters_data: chaptersData as any,
        current_chapter_index: chapterIndex,
        completed_jobs: allJobs.filter(j => doneStatuses.includes(j.status)).length,
        good_jobs: allJobs.filter(j => j.status === 'done_good').length,
        bad_jobs: allJobs.filter(j => j.status === 'done_bad').length,
      })
      .eq('id', pipelineRunIdRef.current);
  };

  // --- beforeunload handler to mark interrupted ---
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (runningRef.current && pipelineRunIdRef.current) {
        // Use sendBeacon for reliable delivery on page close
        const url = `${SUPABASE_URL}/rest/v1/auto_pipeline_runs?id=eq.${pipelineRunIdRef.current}`;
        const body = JSON.stringify({ status: 'interrupted' });
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
        // Also try fetch as fallback (keepalive)
        fetch(url, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Prefer': 'return=minimal',
          },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // --- Build job queue from subject data ---
  const buildQueue = useCallback(async (
    subjectId: string,
    subjectName: string,
    allChapters: SubjectChapter[],
  ): Promise<ChapterProgress[]> => {
    console.log(`[AutoPipeline] BUILD_QUEUE_START | subject=${subjectName} | subjectId=${subjectId} | chapters=${allChapters.length}`);
    const chapterProgresses: ChapterProgress[] = [];

    for (const chapter of allChapters) {
      console.log(`[AutoPipeline] BUILD_QUEUE_CHAPTER | ch=${chapter.chapter_number} "${chapter.title}" | chapterId=${chapter.id}`);
      
      // Fetch topics for this chapter
      const { data: topics } = await supabase
        .from('subject_topics')
        .select('*')
        .eq('chapter_id', chapter.id)
        .order('sequence_order');

      console.log(`[AutoPipeline] BUILD_QUEUE_TOPICS | ch=${chapter.chapter_number} | topicCount=${topics?.length || 0}`);

      const jobs: PipelineJob[] = [];

      for (const topic of (topics || []) as SubjectTopic[]) {
        // Find document for this topic (topic-level first, then chapter-level fallback)
        let doc: { id: string; display_name: string | null; file_name: string | null; source_url: string | null; source_type: string | null } | null = null;
        let docSource = 'none';
        
        const { data: topicDocs } = await supabase
          .from('ai_assistant_documents')
          .select('id, display_name, file_name, source_url, source_type')
          .eq('subject_id', subjectId)
          .eq('topic_id', topic.id)
          .not('source_url', 'is', null)
          .order('created_at', { ascending: true });

        // Pick oldest document deterministically
        doc = topicDocs?.[0] || null;
        if (doc) docSource = 'topic';

        // Collect ALL document IDs for this topic (for cross-document job lookup)
        const allTopicDocIds: string[] = (topicDocs || []).map((d: any) => d.id);

        // Fallback: check chapter-level documents
        if (!doc) {
          const { data: chapterDocs } = await supabase
            .from('ai_assistant_documents')
            .select('id, display_name, file_name, source_url, source_type')
            .eq('subject_id', subjectId)
            .eq('chapter_id', chapter.id)
            .is('topic_id', null)
            .not('source_url', 'is', null)
            .order('created_at', { ascending: true })
            .limit(1);

          doc = chapterDocs?.[0] || null;
          if (doc) {
            docSource = 'chapter_fallback';
            allTopicDocIds.push(doc.id);
          }
        }

        const hasValidDoc = doc && doc.source_url;

        // Check if a job already exists for ANY document of this topic
        let hasExistingJob = false;
        if (hasValidDoc && allTopicDocIds.length > 0) {
          const { data: existingJobs } = await supabase
            .from('video_generation_jobs')
            .select('id')
            .in('document_id', allTopicDocIds)
            .limit(1);
          hasExistingJob = (existingJobs && existingJobs.length > 0);
          if (hasExistingJob) {
            console.log(`[AutoPipeline] QUEUE | ch=${chapter.chapter_number} "${chapter.title}" | topic="${topic.title}" | status=already_done | docIds=${allTopicDocIds.length} | existingJobId=${existingJobs?.[0]?.id}`);
          }
        }

        const jobStatus: PipelineJobStatus = !hasValidDoc 
          ? 'no_document' 
          : hasExistingJob 
            ? 'already_done' 
            : 'queued';

        if (jobStatus === 'no_document') {
          console.log(`[AutoPipeline] QUEUE | ch=${chapter.chapter_number} "${chapter.title}" | topic="${topic.title}" | status=no_document`);
        } else if (jobStatus === 'queued') {
          console.log(`[AutoPipeline] QUEUE | ch=${chapter.chapter_number} "${chapter.title}" | topic="${topic.title}" | status=queued | doc=${doc?.id} | docSource=${docSource}`);
        }

        jobs.push({
          id: `${chapter.id}_${topic.id}`,
          chapterId: chapter.id,
          chapterName: chapter.title,
          chapterNumber: chapter.chapter_number,
          topicId: topic.id,
          topicName: topic.title,
          topicNumber: typeof topic.topic_number === 'string' ? parseInt(topic.topic_number) || 0 : topic.topic_number,
          documentId: doc?.id || null,
          documentName: doc?.display_name || doc?.file_name || null,
          sourceUrl: doc?.source_url || null,
          sourceType: doc?.source_type || null,
          fileName: doc?.file_name || null,
          status: jobStatus,
          externalJobId: null,
          serverIp: null,
          submittedAt: null,
          startedAt: null,
          completedAt: null,
          retryCount: 0,
          retryDetails: [],
          errorMessage: null,
          sanityData: null,
          failedPhases: [],
        });
      }

      const queued = jobs.filter(j => j.status === 'queued').length;
      const noDoc = jobs.filter(j => j.status === 'no_document').length;
      const alreadyDone = jobs.filter(j => j.status === 'already_done').length;
      console.log(`[AutoPipeline] BUILD_QUEUE_CHAPTER_SUMMARY | ch=${chapter.chapter_number} "${chapter.title}" | total=${jobs.length} | queued=${queued} | no_doc=${noDoc} | already_done=${alreadyDone}`);

      chapterProgresses.push({
        chapterId: chapter.id,
        chapterName: chapter.title,
        chapterNumber: chapter.chapter_number,
        jobs,
        status: 'pending',
      });
    }

    const totalQueued = chapterProgresses.reduce((s, c) => s + c.jobs.filter(j => j.status === 'queued').length, 0);
    const totalNoDoc = chapterProgresses.reduce((s, c) => s + c.jobs.filter(j => j.status === 'no_document').length, 0);
    const totalAlreadyDone = chapterProgresses.reduce((s, c) => s + c.jobs.filter(j => j.status === 'already_done').length, 0);
    console.log(`[AutoPipeline] BUILD_QUEUE_DONE | totalChapters=${chapterProgresses.length} | totalQueued=${totalQueued} | totalNoDoc=${totalNoDoc} | totalAlreadyDone=${totalAlreadyDone}`);

    return chapterProgresses;
  }, []);

  // --- Scan subject: one chapter at a time, driven by client ---
  const scanSubject = useCallback(async (
    subjectId: string,
    subjectName: string,
    allChapters: SubjectChapter[],
    selectedIps?: string[],
    resumeFromChapterIds?: string[], // For resuming interrupted scans
  ): Promise<ScanResult[]> => {
    console.log(`[AutoPipeline] SCAN_START | subject="${subjectName}" | chapters=${allChapters.length} | resume=${!!resumeFromChapterIds}`);
    setPipelineState('scanning');
    cancelledRef.current = false;

    const chapterIds = resumeFromChapterIds || allChapters.map(c => c.id);
    const ips = selectedIps || selectedIpsRef.current;
    selectedIpsRef.current = ips; // Sync internal ref

    try {
      // Step 1: Init - create run record & get chapter list (skip if resuming)
      let runId: string;
      let totalTopics: number;
      let chaptersToScan: { id: string; title: string; chapter_number: number }[];

      if (resumeFromChapterIds && pipelineRunIdRef.current) {
        // Resuming: use existing run, only scan remaining chapters
        runId = pipelineRunIdRef.current;
        // Fetch chapter info for remaining chapters
        chaptersToScan = allChapters
          .filter(c => resumeFromChapterIds.includes(c.id))
          .map(c => ({ id: c.id, title: c.title, chapter_number: c.chapter_number }));
        totalTopics = 0; // Will be read from DB by polling
        console.log(`[AutoPipeline] SCAN_RESUME | runId=${runId} | remainingChapters=${chaptersToScan.length}`);
      } else {
        // Fresh scan: init
        const { data: initData, error: initError } = await supabase.functions.invoke('auto-pipeline-scanner', {
          body: {
            action: 'init',
            subject_id: subjectId,
            subject_name: subjectName,
            chapter_ids: chapterIds,
            selected_ips: ips,
          },
        });

        if (initError || !initData?.runId) {
          console.error(`[AutoPipeline] SCAN_INIT_ERROR | error=${initError?.message || 'No runId'}`);
          toast.error('Failed to start scan', { description: initError?.message });
          setPipelineState('idle');
          return [];
        }

        runId = initData.runId;
        totalTopics = initData.totalTopics;
        chaptersToScan = initData.chapters;
        pipelineRunIdRef.current = runId;
        setScanProgress({ current: 0, total: totalTopics });
        console.log(`[AutoPipeline] SCAN_INIT_OK | runId=${runId} | totalTopics=${totalTopics} | chapters=${chaptersToScan.length}`);
      }

      // Invalidate so UI picks up the new run
      queryClient.invalidateQueries({ queryKey: ['active-pipeline-run'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['all-pipeline-runs'] });
      queryClient.invalidateQueries({ queryKey: ['active-pipeline-run-count'] });

      toast.success(`Scanning ${chaptersToScan.length} chapters one by one...`);

      // Step 2: Scan each chapter sequentially
      for (let i = 0; i < chaptersToScan.length; i++) {
        if (cancelledRef.current) {
          console.log(`[AutoPipeline] SCAN_CANCELLED | runId=${runId} | at chapter ${i + 1}/${chaptersToScan.length}`);
          break;
        }

        const chapter = chaptersToScan[i];
        console.log(`[AutoPipeline] SCAN_CHAPTER | runId=${runId} | ch=${chapter.chapter_number} "${chapter.title}" (${i + 1}/${chaptersToScan.length})`);

        const { data: chapterData, error: chapterError } = await supabase.functions.invoke('auto-pipeline-scanner', {
          body: {
            action: 'scan_chapter',
            run_id: runId,
            chapter_id: chapter.id,
            subject_id: subjectId,
          },
        });

        if (chapterError) {
          console.error(`[AutoPipeline] SCAN_CHAPTER_ERROR | ch=${chapter.chapter_number} | error=${chapterError.message}`);
          toast.error(`Scan failed on chapter ${chapter.chapter_number}`, { description: chapterError.message });
          // Continue with next chapter instead of stopping entirely
          continue;
        }

        if (chapterData?.cancelled) {
          console.log(`[AutoPipeline] SCAN_CANCELLED_BY_SERVER | runId=${runId}`);
          break;
        }

        // Invalidate queries so UI picks up new results immediately
        queryClient.invalidateQueries({ queryKey: ['active-pipeline-run'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['all-pipeline-runs'] });

        console.log(`[AutoPipeline] SCAN_CHAPTER_DONE | ch=${chapter.chapter_number} | topics=${chapterData?.chapterTopics} | totalScanned=${chapterData?.totalScanned} | complete=${chapterData?.done}`);
      }

      // Final invalidation
      queryClient.invalidateQueries({ queryKey: ['active-pipeline-run'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['all-pipeline-runs'] });
      queryClient.invalidateQueries({ queryKey: ['active-pipeline-run-count'] });

      return [];
    } catch (err) {
      console.error(`[AutoPipeline] SCAN_EXCEPTION | error=${err}`);
      toast.error('Failed to start scan');
      setPipelineState('idle');
      return [];
    }
  }, [queryClient]);

  // --- Build queue from scan results ---
  const buildQueueFromScan = useCallback((selectedResults: ScanResult[], allChapters: SubjectChapter[]): ChapterProgress[] => {
    console.log(`[AutoPipeline] BUILD_FROM_SCAN | selectedCount=${selectedResults.filter(r => r.selected).length}`);
    const chapterMap = new Map<string, ChapterProgress>();

    // Initialize chapters
    for (const ch of allChapters) {
      chapterMap.set(ch.id, {
        chapterId: ch.id,
        chapterName: ch.title,
        chapterNumber: ch.chapter_number,
        jobs: [],
        status: 'pending',
      });
    }

    for (const result of selectedResults) {
      const chapter = chapterMap.get(result.chapterId);
      if (!chapter) continue;

      // Unselected items or no_document -> skip or mark
      if (!result.selected) {
        if (result.category === 'no_document') {
          chapter.jobs.push({
            id: `${result.chapterId}_${result.topicId}`,
            chapterId: result.chapterId, chapterName: result.chapterName, chapterNumber: result.chapterNumber,
            topicId: result.topicId, topicName: result.topicName, topicNumber: result.topicNumber,
            documentId: result.documentId, documentName: result.documentName,
            sourceUrl: result.sourceUrl, sourceType: result.sourceType, fileName: result.fileName,
            status: 'no_document',
            externalJobId: null, serverIp: null, submittedAt: null, startedAt: null, completedAt: null,
            retryCount: 0, retryDetails: [], errorMessage: null, sanityData: null, failedPhases: [],
          });
        } else {
          // Healthy unselected or deselected repair/new -> already_done
          chapter.jobs.push({
            id: `${result.chapterId}_${result.topicId}`,
            chapterId: result.chapterId, chapterName: result.chapterName, chapterNumber: result.chapterNumber,
            topicId: result.topicId, topicName: result.topicName, topicNumber: result.topicNumber,
            documentId: result.documentId, documentName: result.documentName,
            sourceUrl: result.sourceUrl, sourceType: result.sourceType, fileName: result.fileName,
            status: 'already_done',
            externalJobId: result.externalJobId, serverIp: result.serverIp,
            submittedAt: null, startedAt: null, completedAt: null,
            retryCount: 0, retryDetails: [], errorMessage: null, sanityData: result.sanityData, failedPhases: [],
          });
        }
        continue;
      }

      // Selected items
      let jobStatus: PipelineJobStatus;
      if (result.category === 'needs_repair') {
        jobStatus = 'needs_repair';
      } else {
        // needs_new_job or force-selected healthy -> queued
        jobStatus = 'queued';
      }

      chapter.jobs.push({
        id: `${result.chapterId}_${result.topicId}`,
        chapterId: result.chapterId, chapterName: result.chapterName, chapterNumber: result.chapterNumber,
        topicId: result.topicId, topicName: result.topicName, topicNumber: result.topicNumber,
        documentId: result.documentId, documentName: result.documentName,
        sourceUrl: result.sourceUrl, sourceType: result.sourceType, fileName: result.fileName,
        status: jobStatus,
        externalJobId: result.externalJobId, serverIp: result.serverIp,
        submittedAt: null, startedAt: null, completedAt: null,
        retryCount: 0, retryDetails: [], errorMessage: null, sanityData: result.sanityData,
        failedPhases: result.missingPhases,
      });
    }

    // Filter out empty chapters and sort
    const result = Array.from(chapterMap.values())
      .filter(c => c.jobs.length > 0)
      .sort((a, b) => a.chapterNumber - b.chapterNumber);

    const totalQueued = result.reduce((s, c) => s + c.jobs.filter(j => j.status === 'queued').length, 0);
    const totalRepair = result.reduce((s, c) => s + c.jobs.filter(j => j.status === 'needs_repair').length, 0);
    console.log(`[AutoPipeline] BUILD_FROM_SCAN_DONE | chapters=${result.length} | queued=${totalQueued} | repairs=${totalRepair}`);

    return result;
  }, []);


  const submitJob = async (
    job: PipelineJob,
    serverIp: string,
    subjectName: string,
    subjectId: string,
  ): Promise<{ externalJobId: string; dbJobId: string } | null> => {
    try {
      // === DEDUP CHECK: Skip if topic already has a completed/processing job ===
      if (job.documentId) {
        const { data: docRow } = await supabase
          .from('ai_assistant_documents')
          .select('topic_id')
          .eq('id', job.documentId)
          .single();
        
        if (docRow?.topic_id) {
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
              console.log(`[AutoPipeline] DEDUP_SKIP | topic="${job.topicName}" | existingJob=${existingJobs[0].id} | status=${existingJobs[0].status}`);
              return null;
            }
          }
        }
      }
      // === END DEDUP CHECK ===

      const jobPrefix = await generateJobPrefix(subjectName);

      const payload: Record<string, any> = {
        action: 'submit',
        server_ip: '69.197.145.4',
        target_port: 5005,
        subject: subjectName,
        grade: '12',
        job_prefix: jobPrefix,
        dry_run: false,
        skip_wan: false,
        skip_avatar: false,
        audio_only: false,
        tts_provider: 'our_tts',
        pipeline_version: 'v15_v2_director',
        generation_scope: 'full',
        video_provider: 'kie',
        ocr_provider: 'local',
        skip_threejs: false,
        avatar_language: 'english',
        llm_routing: {
          chunker: 'openrouter',
          director: 'openrouter',
          manim_renderer: 'openrouter',
          remotion_renderer: 'openrouter',
          video_renderer: 'openrouter',
          prompt_enhancer: 'openrouter',
        },
      };

      if (job.sourceUrl) {
        payload.document_url = job.sourceUrl;
        payload.file_name = job.fileName;
        payload.source_type = job.sourceType;
      }

      console.log(`[AutoPipeline] SUBMIT | topic="${job.topicName}" | ip=${serverIp} | docId=${job.documentId} | jobPrefix=${jobPrefix}`);

      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: payload,
      });

      if (error || !data?.job_id) {
        const errMsg = data?.message || error?.message || 'No job ID returned';
        console.error(`[AutoPipeline] SUBMIT_FAIL | topic="${job.topicName}" | ip=${serverIp} | error=${errMsg}`);
        throw new Error(errMsg);
      }

      const uniqueId = Math.floor(100000000 + Math.random() * 900000000).toString();

      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from('video_generation_jobs').insert([{
        id: uniqueId,
        external_job_id: data.job_id,
        document_id: job.documentId,
        subject_id: subjectId,
        document_name: job.documentName,
        status: 'processing',
        created_by: user?.id,
        server_ip: serverIp,
      }]);

      // Invalidate caches so the jobs table updates immediately
      queryClient.invalidateQueries({ queryKey: ['video-generation-jobs'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['video-generation-jobs-paginated'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['video-job-stats'], exact: false });

      console.log(`[AutoPipeline] SUBMIT_OK | topic="${job.topicName}" | extJobId=${data.job_id} | dbJobId=${uniqueId} | ip=${serverIp}`);

      return { externalJobId: data.job_id, dbJobId: uniqueId };
    } catch (err) {
      console.error('[AutoPipeline] SUBMIT_ERROR |', err);
      return null;
    }
  };

  // --- Poll job status ---
  const pollJobStatus = async (externalJobId: string, serverIp: string): Promise<'completed' | 'completed_with_errors' | 'failed' | 'processing'> => {
    try {
      const { data } = await supabase.functions.invoke('video-generation-proxy', {
        body: { action: 'status', job_id: externalJobId, server_ip: serverIp },
      });

      if (!data) {
        console.log(`[AutoPipeline] POLL | extJobId=${externalJobId} | ip=${serverIp} | status=processing (no data)`);
        return 'processing';
      }

      console.log(`[AutoPipeline] POLL | extJobId=${externalJobId} | ip=${serverIp} | status=${data.status}`);

      if (data.status === 'completed' || data.status === 'completed_with_errors') {
        return data.status;
      }
      if (data.status === 'failed') return 'failed';
      return 'processing';
    } catch (err) {
      console.log(`[AutoPipeline] POLL_ERROR | extJobId=${externalJobId} | ip=${serverIp} | error=${err}`);
      return 'processing';
    }
  };

  // --- Run sanity check ---
  const runSanityCheck = async (externalJobId: string, serverIp: string): Promise<SanityCheckData | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: { action: 'sanity_check', job_id: externalJobId, server_ip: serverIp },
      });
      if (error) {
        console.error(`[AutoPipeline] SANITY_ERROR | extJobId=${externalJobId} | error=${error.message}`);
        return null;
      }
      const sanity = data as SanityCheckData;
      if (sanity?.summary) {
        console.log(`[AutoPipeline] SANITY | extJobId=${externalJobId} | avatar=${sanity.summary.avatar_healthy}/${sanity.summary.avatar_total} | topic=${sanity.summary.topic_healthy}/${sanity.summary.topic_total}`);
      } else {
        console.log(`[AutoPipeline] SANITY | extJobId=${externalJobId} | no summary data`);
      }
      return sanity;
    } catch (err) {
      console.error(`[AutoPipeline] SANITY_EXCEPTION | extJobId=${externalJobId} | error=${err}`);
      return null;
    }
  };

  // --- Check sanity for missing phases ---
  const getMissingPhases = (sanity: SanityCheckData): string[] => {
    const missing: string[] = [];
    if (!sanity.summary) return missing;

    if (sanity.summary.avatar_healthy < sanity.summary.avatar_total) {
      missing.push('avatar_generation');
    }
    if (sanity.summary.topic_healthy < sanity.summary.topic_total) {
      const hasManim = sanity.sections?.some(s => s.renderer === 'manim' && (s.topic_video?.status !== 200));
      const hasWan = sanity.sections?.some(s => s.renderer !== 'manim' && (s.topic_video?.status !== 200));
      if (hasManim) missing.push('manim_render');
      if (hasWan) missing.push('wan_render');
    }

    if (missing.length > 0) {
      console.log(`[AutoPipeline] MISSING_PHASES | phases=[${missing.join(', ')}]`);
    } else {
      console.log(`[AutoPipeline] MISSING_PHASES | none - all healthy`);
    }

    return missing;
  };

  // --- Retry a phase ---
  const retryPhase = async (externalJobId: string, phase: string, serverIp: string): Promise<boolean> => {
    console.log(`[AutoPipeline] RETRY_PHASE | extJobId=${externalJobId} | phase=${phase} | ip=${serverIp}`);
    try {
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: { action: 'retry_phase', job_id: externalJobId, phase, server_ip: serverIp },
      });
      if (error) {
        console.error(`[AutoPipeline] RETRY_PHASE_FAIL | extJobId=${externalJobId} | phase=${phase} | error=${error.message}`);
        return false;
      }
      if (data?.status === 'error') {
        console.error(`[AutoPipeline] RETRY_PHASE_FAIL | extJobId=${externalJobId} | phase=${phase} | serverError=${JSON.stringify(data)}`);
        return false;
      }
      console.log(`[AutoPipeline] RETRY_PHASE_OK | extJobId=${externalJobId} | phase=${phase}`);
      return true;
    } catch (err) {
      console.error(`[AutoPipeline] RETRY_PHASE_EXCEPTION | extJobId=${externalJobId} | phase=${phase} | error=${err}`);
      return false;
    }
  };

  // --- Wait for retry to complete ---
  const waitForRetryCompletion = async (externalJobId: string, serverIp: string, timeoutMs = 300000): Promise<boolean> => {
    const start = Date.now();
    console.log(`[AutoPipeline] RETRY_WAIT_START | extJobId=${externalJobId} | ip=${serverIp} | timeoutMs=${timeoutMs}`);
    while (Date.now() - start < timeoutMs) {
      if (cancelledRef.current) {
        console.log(`[AutoPipeline] RETRY_WAIT_CANCELLED | extJobId=${externalJobId}`);
        return false;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
      
      try {
        const { data } = await supabase.functions.invoke('video-generation-proxy', {
          body: { action: 'regen_job_status', job_id: externalJobId, server_ip: serverIp },
        });
        
        console.log(`[AutoPipeline] RETRY_WAIT | extJobId=${externalJobId} | regenStatus=${data?.status || 'unknown'}`);
        
        if (data?.status === 'completed' || data?.status === 'idle' || !data?.status) {
          console.log(`[AutoPipeline] RETRY_WAIT_DONE | extJobId=${externalJobId} | finalStatus=${data?.status || 'idle'}`);
          return true;
        }
        if (data?.status === 'error' || data?.status === 'failed') {
          console.error(`[AutoPipeline] RETRY_WAIT_FAILED | extJobId=${externalJobId} | status=${data.status}`);
          return false;
        }
      } catch {
        // continue polling
      }
    }
    console.error(`[AutoPipeline] RETRY_WAIT_TIMEOUT | extJobId=${externalJobId} | elapsed=${Date.now() - start}ms`);
    return false; // timeout
  };

  // --- Create report entry ---
  const createReport = async (
    job: PipelineJob,
    subjectId: string,
    subjectName: string,
    category: 'good' | 'bad',
    status: string,
  ) => {
    console.log(`[AutoPipeline] REPORT | topic="${job.topicName}" | category=${category} | status=${status} | extJobId=${job.externalJobId || 'n/a'}`);

    const { data: { user } } = await supabase.auth.getUser();

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
      started_at: job.startedAt,
      completed_at: job.completedAt,
      duration_seconds: duration,
      sanity_summary: job.sanityData?.summary || null,
      error_message: job.errorMessage,
      problem_description: job.failedPhases.length > 0 
        ? `Missing phases: ${job.failedPhases.join(', ')}` 
        : (job.status === 'no_document' ? 'No document uploaded for this topic' : null),
      retry_count: job.retryCount,
      retry_details: job.retryDetails.length > 0 ? job.retryDetails : null,
      failed_phases: job.failedPhases.length > 0 ? job.failedPhases : null,
      created_by: user?.id,
    } as any]);

    queryClient.invalidateQueries({ queryKey: ['auto-pipeline-reports'] });
    queryClient.invalidateQueries({ queryKey: ['auto-pipeline-reports-bad-count'] });
  };

  // --- Find next available IP ---
  const getNextAvailableIp = (selectedIps: string[], slots: Record<string, number>): string | null => {
    for (const ip of selectedIps) {
      if ((slots[ip] || 0) < MAX_JOBS_PER_IP) return ip;
    }
    return null;
  };

  // --- Process a single chapter (dual-track) ---
  const processChapter = async (
    chapterProgress: ChapterProgress,
    selectedIps: string[],
    subjectId: string,
    subjectName: string,
    updateChapters: (updater: (prev: ChapterProgress[]) => ChapterProgress[]) => void,
  ) => {
    const slots: Record<string, number> = {};
    selectedIps.forEach(ip => { slots[ip] = 0; });

    const noDocJobs = chapterProgress.jobs.filter(j => j.status === 'no_document');
    const alreadyDoneJobs = chapterProgress.jobs.filter(j => j.status === 'already_done');
    const repairJobs = chapterProgress.jobs.filter(j => j.status === 'needs_repair');
    const jobQueue = chapterProgress.jobs.filter(j => j.status === 'queued');

    console.log(`[AutoPipeline] CHAPTER_START | ch=${chapterProgress.chapterNumber} "${chapterProgress.chapterName}" | queued=${jobQueue.length} | repairs=${repairJobs.length} | no_doc=${noDocJobs.length} | already_done=${alreadyDoneJobs.length}`);

    // First, create reports for no_document topics
    for (const job of noDocJobs) {
      await createReport(job, subjectId, subjectName, 'bad', 'no_document');
    }

    if (jobQueue.length === 0 && repairJobs.length === 0) {
      console.log(`[AutoPipeline] CHAPTER_SKIP | ch=${chapterProgress.chapterNumber} | reason=no queued or repair jobs`);
      return;
    }

    const updateState = () => {
      setActiveIpSlots({ ...slots });
      updateChapters(prev => [...prev]);
    };

    // --- Track A: Repair jobs (parallel, no IP slots) ---
    const repairOneJob = async (job: PipelineJob) => {
      if (cancelledRef.current || !job.externalJobId || !job.serverIp) return;

      const extJobId = job.externalJobId;
      const ip = job.serverIp;

      console.log(`[AutoPipeline] REPAIR_START | topic="${job.topicName}" | extJobId=${extJobId} | ip=${ip} | phases=[${job.failedPhases.join(', ')}]`);

      for (let attempt = 1; attempt <= MAX_RETRIES && !cancelledRef.current; attempt++) {
        job.status = 'retrying';
        job.retryCount = attempt;
        updateState();

        // Get current missing phases via fresh sanity check
        const currentSanity = await runSanityCheck(extJobId, ip);
        if (!currentSanity) {
          job.retryDetails.push({ phase: 'sanity_check', attempt, error: 'Sanity check failed', timestamp: new Date().toISOString() });
          continue;
        }
        job.sanityData = currentSanity;
        const currentMissing = getMissingPhases(currentSanity);
        
        if (currentMissing.length === 0) {
          // Already healthy
          job.status = 'done_good';
          job.completedAt = new Date().toISOString();
          job.failedPhases = [];
          console.log(`[AutoPipeline] REPAIR_DONE | topic="${job.topicName}" | result=done_good (already healthy at attempt ${attempt})`);
          const videoUrl = `http://${ip}:5005/player_v2/?job=${extJobId}`;
          await supabase.from('subject_topics').update({ ai_generated_video_url: videoUrl } as any).eq('id', job.topicId);
          await createReport(job, subjectId, subjectName, 'good', 'repaired');
          updateState();
          return;
        }

        job.failedPhases = currentMissing;
        console.log(`[AutoPipeline] REPAIR_ATTEMPT | topic="${job.topicName}" | attempt=${attempt}/${MAX_RETRIES} | phases=[${currentMissing.join(', ')}]`);

        // Retry each missing phase sequentially
        for (const phase of currentMissing) {
          if (cancelledRef.current) break;
          const retryResult = await retryPhase(extJobId, phase, ip);
          job.retryDetails.push({ phase, attempt, error: retryResult ? '' : 'retry_phase failed', timestamp: new Date().toISOString() });
          
          if (retryResult) {
            await waitForRetryCompletion(extJobId, ip);
          }
        }

        // Verify after all phases retried
        const recheckSanity = await runSanityCheck(extJobId, ip);
        job.sanityData = recheckSanity;

        if (recheckSanity) {
          const stillMissing = getMissingPhases(recheckSanity);
          if (stillMissing.length === 0) {
            job.status = 'done_good';
            job.completedAt = new Date().toISOString();
            job.failedPhases = [];
            console.log(`[AutoPipeline] REPAIR_DONE | topic="${job.topicName}" | result=done_good (after attempt ${attempt})`);
            const videoUrl = `http://${ip}:5005/player_v2/?job=${extJobId}`;
            await supabase.from('subject_topics').update({ ai_generated_video_url: videoUrl } as any).eq('id', job.topicId);
            await createReport(job, subjectId, subjectName, 'good', 'repaired');
            updateState();
            return;
          }
          job.failedPhases = stillMissing;
          console.log(`[AutoPipeline] REPAIR_STILL_MISSING | topic="${job.topicName}" | attempt=${attempt} | phases=[${stillMissing.join(', ')}]`);
        }
      }

      // Failed after MAX_RETRIES
      if (!cancelledRef.current) {
        job.status = 'done_bad';
        job.completedAt = new Date().toISOString();
        job.errorMessage = `CRITICAL: Repair failed after ${MAX_RETRIES} attempts. Missing: ${job.failedPhases.join(', ')}`;
        console.error(`[AutoPipeline] REPAIR_DONE | topic="${job.topicName}" | result=done_bad (critical) | missing=[${job.failedPhases.join(', ')}]`);
        await createReport(job, subjectId, subjectName, 'bad', 'critical');
        updateState();
      }
    };

    // --- Track B: New jobs (2 per IP, existing concurrency) ---
    const activeJobs = new Map<string, PipelineJob>();

    const processOneJob = async (job: PipelineJob, ip: string) => {
      if (cancelledRef.current) return;

      job.status = 'submitting';
      job.serverIp = ip;
      job.submittedAt = new Date().toISOString();
      console.log(`[AutoPipeline] JOB_SUBMITTING | topic="${job.topicName}" | ip=${ip}`);
      updateState();

      const result = await submitJob(job, ip, subjectName, subjectId);
      if (!result) {
        job.status = 'done_bad';
        job.errorMessage = 'Failed to submit job';
        job.completedAt = new Date().toISOString();
        await createReport(job, subjectId, subjectName, 'bad', 'failed');
        slots[ip] = Math.max(0, (slots[ip] || 0) - 1);
        updateState();
        return;
      }

      job.externalJobId = result.externalJobId;
      job.status = 'processing';
      job.startedAt = new Date().toISOString();
      activeJobs.set(result.externalJobId, job);
      updateState();

      let finalStatus: string = 'processing';
      while (finalStatus === 'processing' && !cancelledRef.current) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
        finalStatus = await pollJobStatus(result.externalJobId, ip);
      }

      if (cancelledRef.current) return;

      if (finalStatus === 'failed') {
        job.status = 'done_bad';
        job.errorMessage = 'Job failed during processing';
        job.completedAt = new Date().toISOString();
        await createReport(job, subjectId, subjectName, 'bad', 'failed');
        slots[ip] = Math.max(0, (slots[ip] || 0) - 1);
        activeJobs.delete(result.externalJobId);
        updateState();
        return;
      }

      // Sanity check
      job.status = 'sanity_checking';
      updateState();

      const sanityData = await runSanityCheck(result.externalJobId, ip);
      job.sanityData = sanityData;

      if (sanityData) {
        const missingPhases = getMissingPhases(sanityData);
        
        if (missingPhases.length === 0) {
          job.status = 'done_good';
          job.completedAt = new Date().toISOString();
          const videoUrl = `http://${ip}:5005/player_v2/?job=${result.externalJobId}`;
          await supabase.from('subject_topics').update({ ai_generated_video_url: videoUrl } as any).eq('id', job.topicId);
          await createReport(job, subjectId, subjectName, 'good', 'completed');
        } else {
          job.failedPhases = missingPhases;
          let resolved = false;

          for (let attempt = 1; attempt <= MAX_RETRIES && !resolved && !cancelledRef.current; attempt++) {
            job.status = 'retrying';
            job.retryCount = attempt;
            updateState();

            for (const phase of missingPhases) {
              const retryResult = await retryPhase(result.externalJobId, phase, ip);
              job.retryDetails.push({ phase, attempt, error: retryResult ? '' : 'retry_phase call failed', timestamp: new Date().toISOString() });
              if (retryResult) {
                await waitForRetryCompletion(result.externalJobId, ip);
              }
            }

            const recheckSanity = await runSanityCheck(result.externalJobId, ip);
            job.sanityData = recheckSanity;

            if (recheckSanity) {
              const stillMissing = getMissingPhases(recheckSanity);
              if (stillMissing.length === 0) {
                resolved = true;
                job.status = 'done_good';
                job.completedAt = new Date().toISOString();
                job.failedPhases = [];
                const videoUrl = `http://${ip}:5005/player_v2/?job=${result.externalJobId}`;
                await supabase.from('subject_topics').update({ ai_generated_video_url: videoUrl } as any).eq('id', job.topicId);
                await createReport(job, subjectId, subjectName, 'good', 'completed');
              } else {
                job.failedPhases = stillMissing;
              }
            }
          }

          if (!resolved && !cancelledRef.current) {
            job.status = 'done_bad';
            job.completedAt = new Date().toISOString();
            job.errorMessage = `Failed after ${MAX_RETRIES} retry attempts. Missing: ${job.failedPhases.join(', ')}`;
            await createReport(job, subjectId, subjectName, 'bad', 'partial');
          }
        }
      } else {
        job.status = 'done_bad';
        job.completedAt = new Date().toISOString();
        job.errorMessage = 'Sanity check request failed';
        await createReport(job, subjectId, subjectName, 'bad', 'failed');
      }

      slots[ip] = Math.max(0, (slots[ip] || 0) - 1);
      activeJobs.delete(result.externalJobId);
      setActiveIpSlots({ ...slots });
      updateState();
    };

    // --- Run both tracks in parallel ---
    const trackAPromise = repairJobs.length > 0
      ? Promise.all(repairJobs.map(job => repairOneJob(job)))
      : Promise.resolve();

    const trackBPromise = (async () => {
      const promises: Promise<void>[] = [];
      for (const job of jobQueue) {
        if (cancelledRef.current) break;
        let ip = getNextAvailableIp(selectedIps, slots);
        while (!ip && !cancelledRef.current) {
          await new Promise(r => setTimeout(r, 2000));
          ip = getNextAvailableIp(selectedIps, slots);
        }
        if (!ip || cancelledRef.current) break;
        slots[ip] = (slots[ip] || 0) + 1;
        setActiveIpSlots({ ...slots });
        promises.push(processOneJob(job, ip));
      }
      await Promise.all(promises);
    })();

    await Promise.all([trackAPromise, trackBPromise]);

    const goodCount = chapterProgress.jobs.filter(j => j.status === 'done_good').length;
    const badCount = chapterProgress.jobs.filter(j => j.status === 'done_bad' || j.status === 'no_document').length;
    console.log(`[AutoPipeline] CHAPTER_DONE | ch=${chapterProgress.chapterNumber} "${chapterProgress.chapterName}" | good=${goodCount} | bad=${badCount}`);
  };

  // --- Start pipeline from scan results (SERVER-SIDE execution) ---
  const startPipelineFromScan = useCallback(async (
    subjectId: string,
    subjectName: string,
    allChapters: SubjectChapter[],
    selectedResults: ScanResult[],
    selectedIps: string[],
  ) => {
    cancelledRef.current = false;
    runningRef.current = true;
    selectedIpsRef.current = selectedIps;
    setPipelineState('building_queue');

    console.log(`[AutoPipeline] START_FROM_SCAN_SERVER | subject="${subjectName}" | ips=[${selectedIps.join(', ')}]`);

    const queue = buildQueueFromScan(selectedResults, allChapters);
    setChapters(queue);

    // Build job_queue JSONB for server-side processing
    const jobQueue = selectedResults
      .filter(r => r.selected)
      .map(r => ({
        topicId: r.topicId,
        topicName: r.topicName,
        topicNumber: r.topicNumber,
        chapterId: r.chapterId,
        chapterName: r.chapterName,
        chapterNumber: r.chapterNumber,
        documentId: r.documentId,
        documentName: r.documentName,
        sourceUrl: r.sourceUrl,
        sourceType: r.sourceType,
        fileName: r.fileName,
        category: r.category,
        status: r.category === 'needs_repair' ? 'needs_repair' : 'queued',
        externalJobId: r.externalJobId,
        serverIp: r.serverIp,
        retryCount: 0,
        retryDetails: [],
        errorMessage: null,
        failedPhases: r.missingPhases,
        submittedAt: null,
        completedAt: null,
        lastPolledAt: null,
      }));

    // Also add unselected items as 'skipped' for tracking
    const skippedJobs = selectedResults
      .filter(r => !r.selected && r.category !== 'no_document')
      .map(r => ({
        topicId: r.topicId,
        topicName: r.topicName,
        topicNumber: r.topicNumber,
        chapterId: r.chapterId,
        chapterName: r.chapterName,
        chapterNumber: r.chapterNumber,
        documentId: r.documentId,
        documentName: r.documentName,
        sourceUrl: r.sourceUrl,
        sourceType: r.sourceType,
        fileName: r.fileName,
        category: r.category,
        status: 'skipped',
        externalJobId: r.externalJobId,
        serverIp: r.serverIp,
        retryCount: 0,
        retryDetails: [],
        errorMessage: null,
        failedPhases: [],
        submittedAt: null,
        completedAt: null,
        lastPolledAt: null,
      }));

    const fullJobQueue = [...jobQueue, ...skippedJobs];
    const activeJobCount = jobQueue.length;

    // Insert pipeline run with job_queue for server-side processing
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('auto_pipeline_runs')
      .insert([{
        subject_id: subjectId,
        subject_name: subjectName,
        status: 'running',
        selected_ips: selectedIps,
        chapters_data: queue as any,
        job_queue: fullJobQueue as any,
        scan_results: selectedResults as any,
        pipeline_config: { max_retries: 3, poll_interval_seconds: 10, max_jobs_per_ip: 2 },
        current_chapter_index: 0,
        total_jobs: activeJobCount,
        completed_jobs: 0,
        good_jobs: 0,
        bad_jobs: 0,
        created_by: user?.id,
      }])
      .select('id')
      .single();

    if (error || !data) {
      console.error(`[AutoPipeline] DB_INSERT_FAIL | error=${error?.message}`);
      toast.error('Failed to start pipeline');
      setPipelineState('idle');
      runningRef.current = false;
      return;
    }

    pipelineRunIdRef.current = data.id;
    console.log(`[AutoPipeline] DB_INSERT_OK | runId=${data.id} | jobs=${activeJobCount}`);

    setPipelineState('running');
    setCurrentChapterIndex(0);

    // Trigger the server-side worker immediately
    try {
      await supabase.functions.invoke('auto-pipeline-worker', { body: {} });
      console.log(`[AutoPipeline] WORKER_TRIGGERED | runId=${data.id}`);
    } catch (err) {
      console.warn(`[AutoPipeline] WORKER_TRIGGER_WARN | error=${err} (cron will pick up)`);
    }

    // The browser no longer runs the pipeline loop.
    // UI will poll auto_pipeline_runs for progress via useActivePipelineRun.
    runningRef.current = false;
    
    toast.success('Pipeline started! It will continue running on the server even if you close this tab.');

    // Invalidate to start polling
    queryClient.invalidateQueries({ queryKey: ['active-pipeline-run'], exact: false });
  }, [buildQueueFromScan, queryClient]);

  // --- Legacy startPipeline (kept for backward compat) ---
  const startPipeline = useCallback(async (
    subjectId: string,
    subjectName: string,
    allChapters: SubjectChapter[],
    selectedIps: string[],
  ) => {
    const pipelineStartTime = Date.now();
    cancelledRef.current = false;
    runningRef.current = true;
    setPipelineState('building_queue');

    const queue = await buildQueue(subjectId, subjectName, allChapters);
    setChapters(queue);
    await insertPipelineRun(subjectId, subjectName, queue, selectedIps);

    setPipelineState('running');
    setCurrentChapterIndex(0);
    await syncPipelineRun('running', queue, 0);

    const updateChapters = (updater: (prev: ChapterProgress[]) => ChapterProgress[]) => {
      setChapters(prev => updater(prev));
    };

    let lastSyncTime = 0;
    const debouncedSync = (status: string, idx: number) => {
      const now = Date.now();
      if (now - lastSyncTime > 3000) { lastSyncTime = now; syncPipelineRun(status, queue, idx); }
    };

    for (let i = 0; i < queue.length; i++) {
      if (cancelledRef.current) break;
      setCurrentChapterIndex(i);
      queue[i].status = 'processing';
      updateChapters(prev => [...prev]);
      debouncedSync('running', i);

      await processChapter(queue[i], selectedIps, subjectId, subjectName, (updater) => {
        updateChapters(updater);
        debouncedSync('running', i);
      });

      if (cancelledRef.current) break;
      queue[i].status = 'waiting_approval';
      updateChapters(prev => [...prev]);

      if (i < queue.length - 1) {
        setPipelineState('paused_for_approval');
        await syncPipelineRun('paused_for_approval', queue, i);
        await new Promise<void>((resolve) => {
          const check = setInterval(() => {
            if (cancelledRef.current || runningRef.current === false) { clearInterval(check); resolve(); }
          }, 500);
          (window as any).__pipelineResolve = () => { clearInterval(check); resolve(); };
        });
        if (cancelledRef.current) break;
      } else {
        queue[i].status = 'done';
        updateChapters(prev => [...prev]);
      }
    }

    const totalDuration = Math.round((Date.now() - pipelineStartTime) / 1000);
    const finalState = cancelledRef.current ? 'cancelled' : 'completed';
    setPipelineState(cancelledRef.current ? 'cancelled' : 'completed');
    runningRef.current = false;
    await syncPipelineRun(finalState, queue, queue.length - 1);
    queryClient.invalidateQueries({ queryKey: ['active-pipeline-run'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['video-generation-jobs'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['video-generation-jobs-paginated'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['video-job-stats'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['auto-pipeline-reports'] });
    toast.success(cancelledRef.current ? 'Pipeline cancelled' : 'Pipeline completed!');
  }, [buildQueue, queryClient]);

  // --- Approve chapter and continue ---
  const approveChapter = useCallback(() => {
    console.log(`[AutoPipeline] APPROVE_CHAPTER | resuming pipeline`);
    setPipelineState('running');
    if ((window as any).__pipelineResolve) {
      (window as any).__pipelineResolve();
      delete (window as any).__pipelineResolve;
    }
  }, []);

  // --- Cancel pipeline ---
  const cancelPipeline = useCallback(() => {
    console.log(`[AutoPipeline] CANCEL | pipeline cancelled by user`);
    cancelledRef.current = true;
    runningRef.current = false;
    // Immediately transition to cancelled for ALL active states
    setPipelineState(prev => {
      if (prev === 'idle' || prev === 'completed' || prev === 'cancelled') return prev;
      return 'cancelled';
    });
    if ((window as any).__pipelineResolve) {
      (window as any).__pipelineResolve();
      delete (window as any).__pipelineResolve;
    }
  }, []);

  // --- Reset ---
  const resetPipeline = useCallback(() => {
    console.log(`[AutoPipeline] RESET | pipeline state cleared`);
    setPipelineState('idle');
    setChapters([]);
    setCurrentChapterIndex(0);
    setActiveIpSlots({});
    setScanResults([]);
    setScanProgress({ current: 0, total: 0 });
    cancelledRef.current = false;
    runningRef.current = false;
    pipelineRunIdRef.current = null;
    selectedIpsRef.current = [];
  }, []);

  // --- Set scan results from server (for hydration from DB) ---
  const setScanResultsFromServer = useCallback((results: ScanResult[], keepScanning?: boolean) => {
    setScanResults(results);
    if (!keepScanning) {
      setPipelineState('scan_complete');
    }
  }, []);

  // --- Hydrate from a DB run (for restoring state) ---
  const hydrateFromRun = useCallback((run: {
    id: string;
    status: PipelineState | 'interrupted';
    chaptersData: ChapterProgress[];
    currentChapterIndex: number;
  }) => {
    pipelineRunIdRef.current = run.id;
    setChapters(run.chaptersData);
    setCurrentChapterIndex(run.currentChapterIndex);
    setPipelineState(run.status === 'interrupted' ? 'interrupted' as any : run.status);
  }, []);

  return {
    pipelineState,
    chapters,
    currentChapterIndex,
    activeIpSlots,
    scanResults,
    scanProgress,
    setScanProgress,
    startPipeline,
    startPipelineFromScan,
    scanSubject,
    approveChapter,
    cancelPipeline,
    resetPipeline,
    hydrateFromRun,
    setScanResultsFromServer,
    pipelineRunId: pipelineRunIdRef.current,
    selectedIps: selectedIpsRef.current,
  };
}
