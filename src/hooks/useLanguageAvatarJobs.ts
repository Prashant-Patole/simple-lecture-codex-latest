import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect, useRef } from 'react';

// Type for language avatar job (matching database schema)
export interface LanguageAvatarJob {
  id: string;
  video_job_id: string;
  external_job_id: string | null;
  section_id: number;
  section_title: string | null;
  language: string;
  speaker: string;
  task_id: string | null;
  status: string;
  progress: number;
  error_message: string | null;
  avatar_url: string | null;
  server_ip: string | null;
  created_at: string;
  updated_at: string;
}

// Progress callback type for bulk generation
export interface BulkProgress {
  current: number;
  total: number;
  sectionTitle: string;
}

// Languages supported by V2.5 API (full lowercase names)
export const SUPPORTED_LANGUAGES = [
  { code: 'english', name: 'English', flag: '🇬🇧' },
  { code: 'hindi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'kannada', name: 'Kannada', flag: '🇮🇳' },
  { code: 'marathi', name: 'Marathi', flag: '🇮🇳' },
  { code: 'tamil', name: 'Tamil', flag: '🇮🇳' },
  { code: 'telugu', name: 'Telugu', flag: '🇮🇳' },
  { code: 'malayalam', name: 'Malayalam', flag: '🇮🇳' },
  { code: 'bengali', name: 'Bengali', flag: '🇮🇳' },
  { code: 'gujarati', name: 'Gujarati', flag: '🇮🇳' },
  { code: 'punjabi', name: 'Punjabi', flag: '🇮🇳' },
  { code: 'odia', name: 'Odia', flag: '🇮🇳' },
  { code: 'assamese', name: 'Assamese', flag: '🇮🇳' },
] as const;

// Voices supported by V2.5 API - grouped by gender
export const SUPPORTED_VOICES = [
  // Male Voices
  { id: 'abhilash', name: 'Abhilash', gender: 'male', description: 'Clear, Professional (Default)' },
  { id: 'karun', name: 'Karun', gender: 'male', description: 'Warm, Friendly' },
  { id: 'hitesh', name: 'Hitesh', gender: 'male', description: 'Energetic, Youthful' },
  // Female Voices
  { id: 'anushka', name: 'Anushka', gender: 'female', description: 'Soft, Gentle' },
  { id: 'manisha', name: 'Manisha', gender: 'female', description: 'Professional, Clear' },
  { id: 'vidya', name: 'Vidya', gender: 'female', description: 'Warm, Expressive' },
  { id: 'arya', name: 'Arya', gender: 'female', description: 'Young, Energetic' },
] as const;

export const DEFAULT_SPEAKER = 'abhilash';

// Avatar options by server IP
export const AVATAR_OPTIONS_BY_SERVER: Record<string, Array<{ id: string; label: string }>> = {
  '38.247.187.26': [
    { id: 'avatar_6c88c05a', label: 'Avatar 1' },
    { id: 'avatar_655f3abe', label: 'Avatar 2' },
    { id: 'avatar_353cac69', label: 'Avatar 3' },
  ],
  '38.247.185.28': [
    { id: 'avatar_0196d083', label: 'Avatar 1' },
    { id: 'avatar_a87c4c9a', label: 'Avatar 2' },
    { id: 'avatar_f543bb12', label: 'Avatar 3' },
  ],
  '63.141.249.82': [
    { id: 'avatar_60219c99', label: 'Avatar 1' },
    { id: 'avatar_f7fb5702', label: 'Avatar 2' },
    { id: 'avatar_ed8ff0d1', label: 'Avatar 3' },
  ],
  '69.197.145.4': [
    { id: 'avatar_46e03dc2', label: 'Avatar 1' },
    { id: 'avatar_9ff87c46', label: 'Avatar 2' },
    { id: 'avatar_d8825fc9', label: 'Avatar 3' },
  ],
  '173.208.218.77': [
    { id: 'avatar_60219c99', label: 'Avatar 1' },
    { id: 'avatar_f7fb5702', label: 'Avatar 2' },
    { id: 'avatar_ed8ff0d1', label: 'Avatar 3' },
  ],
};

// Helper to get avatars for a server IP (with fallback)
export function getAvatarsForServer(serverIp?: string): Array<{ id: string; label: string }> {
  const ip = serverIp || '69.197.145.4';
  return AVATAR_OPTIONS_BY_SERVER[ip] || AVATAR_OPTIONS_BY_SERVER['69.197.145.4'];
}

// Helper to normalize status strings from API
function normalizeStatus(rawStatus: string): 'completed' | 'failed' | 'processing' {
  if (['completed', 'DONE', 'done', 'success', 'SUCCESS'].includes(rawStatus)) {
    return 'completed';
  }
  if (['failed', 'FAILED', 'error', 'ERROR'].includes(rawStatus)) {
    return 'failed';
  }
  return 'processing';
}

// Constants for stale task detection
const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes with no progress = stale

// Helper function to poll until task completion (1 hour max)
async function waitForTaskCompletion(
  taskId: string,
  jobId: string,
  videoJobId: string,
  queryClient: QueryClient,
  maxWaitMs: number = 3600000 // 1 hour max
): Promise<{ completed: boolean; avatarUrl?: string; error?: string }> {
  const pollInterval = 5000; // 5 seconds
  const maxAttempts = Math.floor(maxWaitMs / pollInterval); // 720 attempts for 1 hour
  const maxConsecutiveErrors = 5; // Give up after 5 consecutive connection errors
  let consecutiveErrors = 0;
  
  // Track progress for stale detection
  let lastProgress = -1;
  let lastProgressChangeTime = Date.now();
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: {
          action: 'chatterbox_status',
          task_id: taskId,
        },
      });
      
      // Handle connection/invocation errors
      if (error) {
        consecutiveErrors++;
        console.error(`Error polling chatterbox status (${consecutiveErrors}/${maxConsecutiveErrors}):`, error);
        
        // Give up after too many consecutive connection errors
        if (consecutiveErrors >= maxConsecutiveErrors) {
          const failMessage = 'Server unavailable - please retry later';
          await supabase
            .from('language_avatar_jobs')
            .update({
              status: 'failed',
              error_message: failMessage,
              updated_at: new Date().toISOString(),
            })
            .eq('id', jobId);
          queryClient.invalidateQueries({ queryKey: ['language-avatar-jobs', videoJobId] });
          return { completed: false, error: 'Server unavailable after multiple attempts' };
        }
        
        // Continue polling on transient errors
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }
      
      // Reset error counter on successful response
      consecutiveErrors = 0;
      
      // Handle terminal "not_found" as immediate failure (stop polling)
      if (data.terminal || data.status === 'not_found') {
        const failMessage = data.error || 'Task not found - generation may have failed';
        await supabase
          .from('language_avatar_jobs')
          .update({
            status: 'failed',
            error_message: failMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', jobId);
        queryClient.invalidateQueries({ queryKey: ['language-avatar-jobs', videoJobId] });
        return { completed: false, error: failMessage };
      }
      
      const rawStatus = data.status || data.state || 'processing';
      const status = normalizeStatus(rawStatus);
      const progress = data.progress || (status === 'completed' ? 100 : 0);
      const errorMessage = data.error || data.message || null;
      
      // Stale task detection: check if progress has changed
      if (progress !== lastProgress) {
        lastProgress = progress;
        lastProgressChangeTime = Date.now();
      } else {
        // Progress hasn't changed - check if stale
        const staleDuration = Date.now() - lastProgressChangeTime;
        if (staleDuration >= STALE_THRESHOLD_MS) {
          console.warn(`[waitForTaskCompletion] Task ${taskId} stalled at ${progress}% for ${Math.round(staleDuration / 60000)} minutes`);
          const staleMessage = `Task stalled at ${progress}% - no progress for 30 minutes`;
          await supabase
            .from('language_avatar_jobs')
            .update({
              status: 'failed',
              error_message: staleMessage,
              updated_at: new Date().toISOString(),
            })
            .eq('id', jobId);
          queryClient.invalidateQueries({ queryKey: ['language-avatar-jobs', videoJobId] });
          return { completed: false, error: staleMessage };
        }
      }
      
      // Try multiple possible response fields for avatar URL
      let avatarUrl = 
        data.video_url ||
        data.output_url ||
        data.result?.video_url ||
        data.result?.url ||
        data.output?.url ||
        data.url ||
        null;
      
      // If completed and no URL provided, construct from task_id using default server
      // Note: The actual server IP should be stored in the job or subject for proper routing
      if (status === 'completed' && !avatarUrl && taskId) {
        avatarUrl = `http://69.197.145.4:5004/outputs/final_${taskId}.mp4`;
      }
      
      // Update database with current progress
      await supabase
        .from('language_avatar_jobs')
        .update({
          status,
          progress,
          avatar_url: avatarUrl,
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
      
      // Invalidate queries to update UI
      queryClient.invalidateQueries({ queryKey: ['language-avatar-jobs', videoJobId] });
      
      if (status === 'completed') {
        return { completed: true, avatarUrl: avatarUrl || undefined };
      }
      
      if (status === 'failed') {
        return { completed: false, error: errorMessage || 'Generation failed' };
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (err) {
      consecutiveErrors++;
      console.error(`Error in waitForTaskCompletion (${consecutiveErrors}/${maxConsecutiveErrors}):`, err);
      
      // Give up after too many consecutive errors
      if (consecutiveErrors >= maxConsecutiveErrors) {
        const failMessage = 'Connection error - please retry later';
        await supabase
          .from('language_avatar_jobs')
          .update({
            status: 'failed',
            error_message: failMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', jobId);
        queryClient.invalidateQueries({ queryKey: ['language-avatar-jobs', videoJobId] });
        return { completed: false, error: 'Connection error after multiple attempts' };
      }
      
      // Continue polling on errors
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }
  
  return { completed: false, error: 'Timeout waiting for completion (1 hour)' };
}

// Query all language avatar jobs for a video job
export function useLanguageAvatarJobs(videoJobId: string | null) {
  return useQuery({
    queryKey: ['language-avatar-jobs', videoJobId],
    queryFn: async () => {
      if (!videoJobId) return [];
      
      const { data, error } = await supabase
        .from('language_avatar_jobs')
        .select('*')
        .eq('video_job_id', videoJobId)
        .order('section_id', { ascending: true })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as LanguageAvatarJob[];
    },
    enabled: !!videoJobId,
    refetchInterval: 3000, // Poll every 3 seconds for status updates
  });
}

// Generate language avatar mutation
export function useGenerateLanguageAvatar() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      videoJobId,
      externalJobId,
      sectionId,
      sectionTitle,
      text,
      language,
      speaker,
      avatarId,
      serverIp,
    }: {
      videoJobId: string;
      externalJobId: string;
      sectionId: number;
      sectionTitle: string;
      text: string;
      language: string;
      speaker: string;
      avatarId?: string;
      serverIp?: string;
    }) => {
      // First, create the job record in database
      const { data: jobRecord, error: insertError } = await supabase
        .from('language_avatar_jobs')
        .insert({
          video_job_id: videoJobId,
          external_job_id: externalJobId,
          section_id: sectionId,
          section_title: sectionTitle,
          language,
          speaker,
          server_ip: serverIp || '69.197.145.4',
          status: 'pending',
          progress: 0,
        })
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      // Call the Chatterbox API - log exact payload for debugging
      console.log('[MultiLang] Sending to edge function:', { 
        action: 'chatterbox_generate',
        text: text.slice(0, 50) + '...',
        language,
        speaker,
        avatar_id: avatarId,
        server_ip: serverIp
      });
      
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: {
          action: 'chatterbox_generate',
          text,
          language,
          speaker,
          avatar_id: avatarId,
          server_ip: serverIp,
        },
      });
      
      if (error) {
        // Update job status to failed
        await supabase
          .from('language_avatar_jobs')
          .update({ status: 'failed', error_message: error.message })
          .eq('id', jobRecord.id);
        throw error;
      }
      
      // Update job with task_id and set to processing
      const { error: updateError } = await supabase
        .from('language_avatar_jobs')
        .update({
          task_id: data.task_id,
          status: 'processing',
        })
        .eq('id', jobRecord.id);
      
      if (updateError) throw updateError;
      
      return { jobId: jobRecord.id, taskId: data.task_id };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['language-avatar-jobs', variables.videoJobId] });
      toast.success(`Started ${variables.language} avatar generation for section ${variables.sectionId}`);
    },
    onError: (error) => {
      toast.error(`Failed to start avatar generation: ${error.message}`);
    },
  });
}

// Check status of a language avatar job
export function useCheckLanguageAvatarStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      jobId,
      taskId,
      videoJobId,
      serverIp,
      previousStatus,
    }: {
      jobId: string;
      taskId: string;
      videoJobId: string;
      serverIp?: string;
      previousStatus?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: {
          action: 'chatterbox_status',
          task_id: taskId,
          server_ip: serverIp,
        },
      });
      
      if (error) throw error;
      
      const rawStatus = data.status || data.state || 'processing';
      const normalizedStatus = normalizeStatus(rawStatus);
      
      const progress = data.progress || (normalizedStatus === 'completed' ? 100 : 0);
      const errorMessage = data.error || data.message || null;
      
      // Try multiple possible response fields for avatar URL
      let avatarUrl = 
        data.video_url ||
        data.output_url ||
        data.result?.video_url ||
        data.result?.url ||
        data.output?.url ||
        data.url ||
        null;
      
      // If completed and no URL provided, construct from task_id with correct server
      if (normalizedStatus === 'completed' && !avatarUrl && taskId) {
        const ip = serverIp || '69.197.145.4';
        avatarUrl = `http://${ip}:5004/outputs/final_${taskId}.mp4`;
      }
      
      // Update database
      const { error: updateError } = await supabase
        .from('language_avatar_jobs')
        .update({
          status: normalizedStatus,
          progress,
          avatar_url: avatarUrl,
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
      
      if (updateError) throw updateError;
      
      return { status: normalizedStatus, progress, avatarUrl };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['language-avatar-jobs', variables.videoJobId] });
    },
  });
}

// Auto-sync hook for polling status of in-progress jobs
// Routes V2.5 jobs (task_id starts with "v2_") to V2.5 status endpoint
// Routes legacy Chatterbox jobs to Chatterbox status endpoint
export function useAutoSyncLanguageAvatarStatus(jobs: LanguageAvatarJob[] | undefined, videoJobId: string | null) {
  const checkChatterboxStatus = useCheckLanguageAvatarStatus();
  const checkV2Status = useCheckV2LanguageAvatarStatus();
  const syncInProgressRef = useRef(false);
  
  useEffect(() => {
    if (!jobs || !videoJobId) return;
    
    const inProgressJobs = jobs.filter(
      (job) => job.status === 'processing' || job.status === 'pending'
    );
    
    if (inProgressJobs.length === 0) return;
    
    const syncStatuses = async () => {
      if (syncInProgressRef.current) return;
      syncInProgressRef.current = true;
      
      try {
        for (const job of inProgressJobs) {
          if (!job.task_id) continue;
          
          // Detect V2.5 jobs by task_id prefix
          const isV2Job = job.task_id.startsWith('v2_');
          
          if (isV2Job) {
            // Use V2.5 status endpoint (Port 5005)
            await checkV2Status.mutateAsync({
              jobId: job.id,
              externalJobId: job.external_job_id || '',
              language: job.language,
              videoJobId,
              serverIp: job.server_ip || undefined,
            });
          } else {
            // Use Chatterbox status endpoint (Port 5004)
            await checkChatterboxStatus.mutateAsync({
              jobId: job.id,
              taskId: job.task_id,
              videoJobId,
              serverIp: job.server_ip || undefined,
              previousStatus: job.status,
            });
          }
        }
      } finally {
        syncInProgressRef.current = false;
      }
    };
    
    // Run immediately
    syncStatuses();
    
    // Set up interval
    const interval = setInterval(syncStatuses, 3000);
    
    return () => clearInterval(interval);
  }, [jobs, videoJobId, checkChatterboxStatus, checkV2Status]);
}

// Bulk generate avatars for multiple sections - FIRE-AND-FORGET pattern
// Jobs are started sequentially but completion is handled by auto-sync polling
export function useBulkGenerateLanguageAvatars() {
  const generateMutation = useGenerateLanguageAvatar();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      videoJobId,
      externalJobId,
      sections,
      language,
      speaker,
      avatarId,
      serverIp,
      onProgress,
      existingJobs,
    }: {
      videoJobId: string;
      externalJobId: string;
      sections: Array<{ sectionId: number; sectionTitle: string; text: string }>;
      language: string;
      speaker: string;
      avatarId?: string;
      serverIp?: string;
      onProgress?: (progress: BulkProgress) => void;
      existingJobs?: LanguageAvatarJob[];
    }) => {
      // Filter out sections that already have a completed job for this language
      const sectionsToGenerate = sections.filter(section => {
        const existingCompleted = existingJobs?.find(j => 
          j.section_id === section.sectionId && 
          j.language === language && 
          j.status === 'completed'
        );
        if (existingCompleted) {
          console.log(`[BulkGenerate] Skipping section ${section.sectionId} - already completed for ${language}`);
        }
        return !existingCompleted;
      });
      
      if (sectionsToGenerate.length === 0) {
        toast.info(`All ${sections.length} sections already have completed ${language} avatars`);
        return { started: 0, failed: 0, skipped: sections.length, results: [] };
      }
      
      if (sectionsToGenerate.length < sections.length) {
        toast.info(`Skipping ${sections.length - sectionsToGenerate.length} already-completed sections`);
      }
      
      const results: Array<{ success: boolean; sectionId: number; jobId?: string; taskId?: string; error?: string }> = [];
      
      for (let i = 0; i < sectionsToGenerate.length; i++) {
        const section = sectionsToGenerate[i];
        
        // Report progress to UI
        onProgress?.({
          current: i + 1,
          total: sectionsToGenerate.length,
          sectionTitle: section.sectionTitle,
        });
        
        try {
          // Start the job (creates DB record + calls Chatterbox API)
          // We do NOT wait for completion - auto-sync handles polling
          const result = await generateMutation.mutateAsync({
            videoJobId,
            externalJobId,
            sectionId: section.sectionId,
            sectionTitle: section.sectionTitle,
            text: section.text,
            language,
            speaker,
            avatarId,
            serverIp,
          });
          
          results.push({
            success: true,
            sectionId: section.sectionId,
            jobId: result.jobId,
            taskId: result.taskId,
          });
          
          // Small delay before starting next job (prevent API overload)
          if (i < sectionsToGenerate.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error: any) {
          // Log error but continue with remaining sections
          console.error(`[BulkGenerate] Section ${section.sectionId} failed to start:`, error);
          results.push({
            success: false,
            sectionId: section.sectionId,
            error: error.message || 'Failed to start',
          });
          // Continue after error - don't stop the entire batch
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      return {
        started: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        skipped: sections.length - sectionsToGenerate.length,
        results,
      };
    },
    onSuccess: (data, variables) => {
      if (data.started > 0) {
        toast.success(
          `Started ${data.started} avatar generation jobs. They will complete in the background.`,
          { duration: 5000 }
        );
      }
      if (data.failed > 0) {
        toast.warning(`${data.failed} jobs failed to start. You can retry them individually.`);
      }
      
      queryClient.invalidateQueries({ queryKey: ['language-avatar-jobs', variables.videoJobId] });
    },
  });
}

// V2.5 API: Generate multi-language avatars with single API call
// Uses POST /job/{job_id}/generate_avatar on port 5005
// No text extraction needed - API reads from presentation.json
export function useGenerateLanguageAvatarV2() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      videoJobId,
      externalJobId,
      languages,
      speaker,
      targetSections,
      forceRegenerate,
      serverIp,
    }: {
      videoJobId: string;
      externalJobId: string;
      languages: string[];
      speaker: string;
      targetSections?: string[];
      forceRegenerate?: boolean;
      serverIp?: string;
    }) => {
      console.log(`[BULK_LANG] [V2_GENERATE_START] videoJobId=${videoJobId}, externalJobId=${externalJobId}, languages=[${languages.join(',')}], speaker=${speaker}, serverIp=${serverIp || 'default'}, targetSections=${targetSections?.join(',') || 'all'}, forceRegenerate=${forceRegenerate || false}`);
      
      // Create tracking records in database for each language BEFORE calling API
      // This ensures the UI shows the jobs immediately
      const jobRecords = [];
      for (const lang of languages) {
        console.log(`[BULK_LANG] [V2_DB_INSERT] Creating tracking record: videoJobId=${videoJobId}, lang=${lang}, speaker=${speaker}`);
        const { data: jobRecord, error: insertError } = await supabase
          .from('language_avatar_jobs')
          .insert({
            video_job_id: videoJobId,
            external_job_id: externalJobId,
            section_id: 0, // V2.5 generates all sections, we track at language level
            section_title: `All Sections (${lang.toUpperCase()})`,
            language: lang,
            speaker,
            server_ip: serverIp || '69.197.145.4',
            status: 'processing',
            progress: 0,
          })
          .select()
          .single();
        
        if (insertError) {
          console.error(`[BULK_LANG] [V2_DB_INSERT_ERROR] lang=${lang}, error="${insertError.message}"`);
        } else if (jobRecord) {
          console.log(`[BULK_LANG] [V2_DB_INSERT_OK] lang=${lang}, recordId=${jobRecord.id}`);
          jobRecords.push(jobRecord);
        }
      }
      
      const edgeFunctionPayload = {
        action: 'multilang_generate_avatar',
        job_id: externalJobId,
        languages,
        speaker,
        target_sections: targetSections,
        force_regenerate: forceRegenerate,
        server_ip: serverIp,
      };
      console.log(`[BULK_LANG] [V2_EDGE_CALL] payload=${JSON.stringify(edgeFunctionPayload)}`);
      
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: edgeFunctionPayload,
      });
      
      // Handle 409 "already_running" gracefully - this means generation is in progress
      if (error) {
        const errorMessage = error.message || '';
        const isAlreadyRunning = errorMessage.includes('already_running') || 
                                  errorMessage.includes('Avatar generation in progress');
        
        if (isAlreadyRunning) {
          console.log(`[BULK_LANG] [V2_ALREADY_RUNNING] externalJobId=${externalJobId}, reattaching ${jobRecords.length} job records to existing task`);
          for (const job of jobRecords) {
            const taskId = `v2_${externalJobId}_${job.language}`;
            console.log(`[BULK_LANG] [V2_REATTACH] recordId=${job.id}, lang=${job.language}, taskId=${taskId}`);
            await supabase
              .from('language_avatar_jobs')
              .update({ 
                status: 'processing',
                task_id: taskId,
              })
              .eq('id', job.id);
          }
          return { success: true, alreadyRunning: true, jobRecords };
        }
        
        console.error(`[BULK_LANG] [V2_EDGE_ERROR] externalJobId=${externalJobId}, error="${errorMessage}", marking ${jobRecords.length} records as failed`);
        for (const job of jobRecords) {
          await supabase
            .from('language_avatar_jobs')
            .update({ status: 'failed', error_message: error.message })
            .eq('id', job.id);
        }
        throw error;
      }
      
      console.log(`[BULK_LANG] [V2_EDGE_RESPONSE] externalJobId=${externalJobId}, response=${JSON.stringify(data)}`);
      
      // Update job records with response info if available
      if (data && jobRecords.length > 0) {
        const taskId = data.job_id || data.task_id || externalJobId;
        console.log(`[BULK_LANG] [V2_TASK_ASSIGN] externalJobId=${externalJobId}, resolvedTaskId=${taskId}, updatingRecords=${jobRecords.length}`);
        for (const job of jobRecords) {
          const fullTaskId = `v2_${taskId}_${job.language}`;
          console.log(`[BULK_LANG] [V2_TASK_UPDATE] recordId=${job.id}, lang=${job.language}, taskId=${fullTaskId}`);
          await supabase
            .from('language_avatar_jobs')
            .update({ 
              task_id: fullTaskId,
              status: 'processing',
            })
            .eq('id', job.id);
        }
      }
      
      return { success: true, data, jobRecords };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['language-avatar-jobs', variables.videoJobId] });
      if (result.alreadyRunning) {
        toast.info(`Avatar generation already in progress for ${variables.languages.join(', ')}. Tracking existing job.`);
      } else {
        toast.success(`Started avatar generation for ${variables.languages.join(', ')}`);
      }
    },
    onError: (error: Error) => {
      // Don't show error toast for "already running" - it's handled in onSuccess
      const errorMessage = error.message || '';
      if (errorMessage.includes('already_running') || errorMessage.includes('Avatar generation in progress')) {
        return; // Silently ignore - this is handled above
      }
      toast.error(`Failed to start avatar generation: ${error.message}`);
    },
  });
}

// V2.5 Status polling for multi-language generation
// Uses GET /job/{job_id}/status on port 5005 via multilang_avatar_status action
// Parses progress from progress_details.avatar_generation
export function useCheckV2LanguageAvatarStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      jobId,
      externalJobId,
      language,
      videoJobId,
      serverIp,
    }: {
      jobId: string;
      externalJobId: string;
      language: string;
      videoJobId: string;
      serverIp?: string;
    }) => {
      // Call the V2.5 multilang_avatar_status action on port 5005
      console.log(`[BULK_LANG] [V2_STATUS_CALL] jobId=${jobId}, externalJobId=${externalJobId}, lang=${language}, serverIp=${serverIp || 'default'}`);
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: {
          action: 'multilang_avatar_status',
          job_id: externalJobId,
          server_ip: serverIp,
        },
      });
      
      if (error) {
        console.error(`[BULK_LANG] [V2_STATUS_ERROR] jobId=${jobId}, lang=${language}, error="${error.message}"`);
        throw error;
      }
      
      console.log(`[BULK_LANG] [V2_STATUS_RAW] jobId=${jobId}, lang=${language}, rawData=${JSON.stringify(data)}`);
      
      // Parse progress from progress_details.avatar_generation
      const total = data?.total || 0;
      const completed = data?.completed || 0;
      const message = data?.message || '';
      const rawStatus = data?.status || 'processing';
      
      // Determine job status
      let status: 'processing' | 'completed' | 'failed' = 'processing';
      let progress = total > 0 ? Math.round((completed / total) * 100) : 0;
      let errorMessage: string | null = null;
      
      // Check for completion
      if (rawStatus === 'completed' || (total > 0 && completed >= total)) {
        status = 'completed';
        progress = 100;
      } else if (rawStatus === 'failed' || data?.error) {
        status = 'failed';
        errorMessage = data?.error || 'Generation failed';
      }
      
      console.log(`[BULK_LANG] [V2_STATUS_PARSED] jobId=${jobId}, lang=${language}, status=${status}, progress=${progress}% (${completed}/${total}), msg="${message}"`);
      
      // Update database with current progress
      const dbUpdate = {
        status,
        progress,
        error_message: status === 'failed' 
          ? errorMessage 
          : (message ? `${completed}/${total} - ${message}` : null),
        updated_at: new Date().toISOString(),
      };
      console.log(`[BULK_LANG] [V2_STATUS_DB_UPDATE] jobId=${jobId}, lang=${language}, update=${JSON.stringify(dbUpdate)}`);
      
      await supabase
        .from('language_avatar_jobs')
        .update(dbUpdate)
        .eq('id', jobId);
      
      return { status, progress, total, completed, message };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['language-avatar-jobs', variables.videoJobId] });
    },
  });
}
