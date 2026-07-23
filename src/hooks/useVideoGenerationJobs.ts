import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect, useRef } from 'react';

interface VideoJobFilters {
  subjectId?: string;
  status?: string;
}

export interface VideoJobWithDocument {
  id: string;
  subject_id: string | null;
  document_id: string | null;
  document_name: string | null;
  external_job_id: string | null;
  status: string;
  progress: number | null;
  current_step: string | null;
  current_phase: string | null;
  steps_completed: number | null;
  total_steps: number | null;
  video_url: string | null;
  error_message: string | null;
  created_at: string | null;
  completed_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
  server_ip?: string | null;
  target_port?: number | null;
  is_published?: boolean;
  ai_assistant_documents?: {
    id: string;
    chapter_id: string | null;
    topic_id: string | null;
    subject_chapters: { 
      id: string; 
      title: string; 
      chapter_number: number;
    } | null;
    subject_topics: { 
      id: string; 
      title: string; 
      topic_number: number | string;
    } | null;
  } | null;
}

// Surgical field selection - excludes ai_presentation_json (~50KB per job)
const VIDEO_JOBS_SELECT_FIELDS = `
  id, subject_id, document_id, document_name, external_job_id, status,
  progress, current_step, current_phase, steps_completed, total_steps,
  video_url, error_message, created_at, completed_at, updated_at,
  created_by, server_ip, target_port, is_published,
  ai_assistant_documents (
    id, chapter_id, topic_id,
    subject_chapters (id, title, chapter_number),
    subject_topics (id, title, topic_number)
  )
`;

interface UseVideoGenerationJobsOptions extends VideoJobFilters {
  enabled?: boolean;
}

// Original hook - still available for backward compatibility
export const useVideoGenerationJobs = (options: UseVideoGenerationJobsOptions = {}) => {
  const { subjectId, status, enabled = true } = options;
  
  return useQuery({
    queryKey: ['video-generation-jobs', { subjectId, status }],
    queryFn: async () => {
      let query = supabase
        .from('video_generation_jobs')
        .select(VIDEO_JOBS_SELECT_FIELDS)
        .not('external_job_id', 'is', null)
        .order('created_at', { ascending: false });
      
      if (subjectId) {
        query = query.eq('subject_id', subjectId);
      }
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as VideoJobWithDocument[];
    },
    enabled,
    // Smart polling: only poll when there are active jobs, stop when all complete
    refetchInterval: (query) => {
      const hasActiveJobs = query.state.data?.some(
        job => job.status === 'pending' || job.status === 'processing'
      );
      return hasActiveJobs ? 10000 : false; // 10s when active, no polling when idle
    },
    refetchIntervalInBackground: false, // Don't poll when tab is hidden
  });
};

// NEW: Paginated infinite query - loads 5 jobs at a time
const PAGE_SIZE = 5;

interface UseVideoGenerationJobsInfiniteOptions {
  subjectId?: string;
  status?: string;
  chapterId?: string;
  topicId?: string;
  searchQuery?: string;
  enabled?: boolean;
}

export const useVideoGenerationJobsInfinite = (options: UseVideoGenerationJobsInfiniteOptions = {}) => {
  const { subjectId, status, chapterId, topicId, searchQuery, enabled = true } = options;
  
  return useInfiniteQuery({
    queryKey: ['video-generation-jobs-paginated', { subjectId, status, chapterId, topicId, searchQuery }],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      // Use !inner join when chapter/topic filters are active so PostgREST
      // excludes parent rows that have no matching joined document
      const needsInnerJoin = (chapterId && chapterId !== 'all') || (topicId && topicId !== 'all');
      const selectFields = needsInnerJoin
        ? VIDEO_JOBS_SELECT_FIELDS.replace('ai_assistant_documents (', 'ai_assistant_documents!inner (')
        : VIDEO_JOBS_SELECT_FIELDS;

      let query = supabase
        .from('video_generation_jobs')
        .select(selectFields)
        .not('external_job_id', 'is', null)
        .order('created_at', { ascending: false })
        .range(from, to);
      
      if (subjectId) {
        query = query.eq('subject_id', subjectId);
      }
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      if (chapterId && chapterId !== 'all') {
        query = query.eq('ai_assistant_documents.chapter_id', chapterId);
      }
      if (topicId && topicId !== 'all') {
        query = query.eq('ai_assistant_documents.topic_id', topicId);
      }
      if (searchQuery && searchQuery.trim()) {
        const s = searchQuery.trim();
        query = query.or(`external_job_id.ilike.%${s}%,document_name.ilike.%${s}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return {
        items: (data as unknown) as VideoJobWithDocument[],
        pageParam,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      // If we got a full page, there might be more
      if (lastPage.items.length === PAGE_SIZE) {
        return lastPage.pageParam + 1;
      }
      return undefined; // No more pages
    },
    enabled,
    // Smart polling for first page only
    refetchInterval: (query) => {
      const firstPageItems = query.state.data?.pages?.[0]?.items || [];
      const hasActiveJobs = firstPageItems.some(
        job => job.status === 'pending' || job.status === 'processing'
      );
      return hasActiveJobs ? 10000 : false;
    },
    refetchIntervalInBackground: false,
  });
};

export const useVideoJobStats = (subjectId?: string) => {
  return useQuery({
    queryKey: ['video-job-stats', subjectId],
    queryFn: async () => {
      let query = supabase
        .from('video_generation_jobs')
        .select('status')
        .not('external_job_id', 'is', null);
      
      if (subjectId) {
        query = query.eq('subject_id', subjectId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const stats = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        total: data?.length || 0
      };
      
      data?.forEach((job) => {
        const status = job.status as keyof typeof stats;
        if (status in stats && status !== 'total') {
          stats[status]++;
        }
      });
      
      return stats;
    },
    refetchInterval: 5000,
  });
};

export const useCheckVideoJobStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ externalJobId, jobId, serverIp, targetPort }: { externalJobId: string; jobId: string; serverIp?: string; targetPort?: number | null }) => {
      const port = Number(targetPort) || 5005;
      const proxy = port === 5006 ? 'marketing-video-proxy' : 'video-generation-proxy';
      const { data, error } = await supabase.functions.invoke(proxy, {
        body: { action: 'status', job_id: externalJobId, server_ip: serverIp, target_port: port }
      });
      
      if (error) throw error;
      
      // Update the database with the latest status
      if (data) {
        const updateData: Record<string, unknown> = {
          progress: data.progress || 0,
          current_step: data.current_step || null,
          current_phase: data.current_phase || null,
          steps_completed: data.steps_completed || 0,
          total_steps: data.total_steps || 0,
        };
        
        if (data.status === 'completed') {
          updateData.status = 'completed';
          updateData.video_url = data.player_url || data.video_url;
          updateData.completed_at = new Date().toISOString();
          updateData.progress = 100;
        } else if (data.status === 'failed') {
          updateData.status = 'failed';
          updateData.error_message = data.error || 'Job failed';
        } else if (data.status === 'processing') {
          updateData.status = 'processing';
        }
        
        await supabase
          .from('video_generation_jobs')
          .update(updateData)
          .eq('id', jobId);
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-generation-jobs'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['video-generation-jobs-paginated'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['video-job-stats'] });
      toast.success('Status updated');
    },
    onError: (error) => {
      toast.error('Failed to check status');
      console.error('Check status error:', error);
    }
  });
};

export const useGenerateAvatar = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (externalJobId: string) => {
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: { action: 'generate_avatar', job_id: externalJobId }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-generation-jobs'] });
      toast.success('Avatar generation started');
    },
    onError: (error) => {
      toast.error('Failed to start avatar generation');
      console.error('Avatar generation error:', error);
    }
  });
};

export const useAvatarStatus = (externalJobId: string | null) => {
  return useQuery({
    queryKey: ['avatar-status', externalJobId],
    queryFn: async () => {
      if (!externalJobId) return null;
      
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: { action: 'avatar_status', job_id: externalJobId }
      });
      
      if (error) throw error;
      return data;
    },
    enabled: !!externalJobId,
    refetchInterval: 3000,
  });
};

export const usePublishVideoToStudents = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      videoUrl, 
      topicId, 
      chapterId,
      jobId,
      externalJobId,
      serverIp
    }: { 
      videoUrl: string; 
      topicId?: string | null; 
      chapterId?: string | null;
      jobId: string;
      externalJobId: string;
      serverIp?: string;
    }) => {
      if (!topicId && !chapterId) {
        throw new Error('No topic or chapter linked to this document');
      }
      
      // Fetch presentation.json via proxy (which now falls back to the CDN
      // server-side when the port-5005 upstream is missing the job).
      const { data: presentationData, error: fetchError } = await supabase.functions.invoke(
        'video-generation-proxy',
        { body: { action: 'review', job_id: externalJobId, server_ip: serverIp } }
      );

      if (fetchError || !presentationData) {
        console.error('Failed to fetch presentation data:', fetchError);
        throw new Error('Failed to fetch presentation data');
      }


      
      
      // Mark the job as published and store the presentation JSON in the job itself
      const { error: updateError } = await supabase
        .from('video_generation_jobs')
        .update({ 
          is_published: true,
          presentation_json: presentationData,
          video_url: videoUrl
        })
        .eq('id', jobId);
      
      if (updateError) throw updateError;
      
      return { type: topicId ? 'topic' : 'chapter', id: topicId || chapterId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['video-generation-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['published-ai-lectures'] });
      queryClient.invalidateQueries({ queryKey: ['subject-chapters'] });
      queryClient.invalidateQueries({ queryKey: ['subject-chapters-learning'] });
      queryClient.invalidateQueries({ queryKey: ['chapter-topics'] });
      toast.success(`Video published to ${data.type}! Students can now access it.`);
    },
    onError: (error) => {
      toast.error('Failed to publish video');
      console.error('Publish error:', error);
    }
  });
};

export const useUnpublishVideo = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from('video_generation_jobs')
        .update({ is_published: false })
        .eq('id', jobId);
      
      if (error) throw error;
      return { jobId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-generation-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['video-generation-jobs-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['published-ai-lectures'] });
      toast.success('Video unpublished from students');
    },
    onError: (error) => {
      toast.error('Failed to unpublish video');
      console.error('Unpublish error:', error);
    }
  });
};

// Presentation Review Types
interface NarrationSegment {
  segment_id?: string;
  text: string;
  start_time?: number;
  end_time?: number;
  duration_seconds: number;
}

interface Narration {
  full_text: string;
  segments: NarrationSegment[];
  total_duration_seconds: number;
}

export interface VisualBeat {
  beat_id: string;
  visual_type: 'text' | 'bullet_list' | 'image' | 'latex' | string;
  display_text: string;
  image_id: string | null;
  latex_content: string | null;
  segment_id?: string;
}

interface ExplanationPlan {
  visual_beats: VisualBeat[];
}

export interface PresentationSection {
  section_id: number;
  section_type: 'intro' | 'summary' | 'content' | 'memory' | 'recap' | string;
  title: string;
  renderer?: string;
  narration: Narration;
  visual_beats: VisualBeat[];
  explanation_plan?: ExplanationPlan;
}

export interface PresentationReview {
  presentation_title: string;
  sections: PresentationSection[];
}

export const usePresentationReview = (externalJobId: string | null, serverIp?: string) => {
  return useQuery({
    queryKey: ['presentation-review', externalJobId, serverIp],
    queryFn: async () => {
      if (!externalJobId) return null;
      
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: { 
          action: 'review', 
          job_id: externalJobId,
          // Pass server_ip for dynamic routing (falls back to default in edge function)
          ...(serverIp && { server_ip: serverIp })
        }
      });
      
      if (error) throw error;
      return data as PresentationReview;
    },
    enabled: !!externalJobId,
  });
};

// Sanity Check Types
export interface ImageHealth {
  image_id: string;
  beat_id?: string;
  status: number;
}

export interface PromptsVsDisk {
  status: 'N/A' | 'MATCH' | 'MISMATCH';
  prompts?: number;
  disk?: number;
  files?: Array<{ path: string; status: number }>;
}

export interface UrlHealth {
  clean: boolean;
  issues: string[];
}

export interface V25LogicCheck {
  status: 'PASS' | 'FAIL' | 'N/A';
  type: string | null;
  details: Record<string, number> | null;
}

export interface SectionHealth {
  section_id: number;
  section_type: string;
  title: string;
  renderer: string | null;
  avatar_video: { path: string; status: number | null };
  topic_video: { 
    path: string | null; 
    status: number | null;
    orphan?: { path: string; status: number } | null;
  };
  prompts_vs_disk: PromptsVsDisk;
  images: ImageHealth[];
  url_health: UrlHealth;
  v25_logic_check: V25LogicCheck;
}

export interface SanityCheckSummary {
  total_sections: number;
  avatar_healthy: number;
  avatar_total: number;
  topic_healthy: number;
  topic_total: number;
  images_healthy: number;
  images_total: number;
  url_issues?: number;
  v25_pass?: number;
  v25_fail?: number;
}

export interface SanityCheckData {
  job_id: string;
  presentation_title?: string;
  check_status?: string;
  orphans_found?: boolean;
  orphan_files?: string[];
  sections: SectionHealth[];
  summary: SanityCheckSummary;
}

export const useSanityCheck = (externalJobId: string | null, serverIp?: string) => {
  return useQuery({
    queryKey: ['sanity-check', externalJobId, serverIp],
    queryFn: async () => {
      if (!externalJobId) return null;
      
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: {
          action: 'sanity_check',
          job_id: externalJobId,
          ...(serverIp && { server_ip: serverIp }),
        }
      });
      
      if (error) throw error;
      return data as SanityCheckData;
    },
    enabled: !!externalJobId,
    staleTime: 30000, // Cache for 30 seconds
  });
};

export const useRepairUrls = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (externalJobId: string) => {
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: { action: 'repair_urls', job_id: externalJobId }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sanity-check'] });
      toast.success('URLs repaired successfully! Refreshing data...');
    },
    onError: (error) => {
      console.error('URL repair error:', error);
    }
  });
};

// Auto-sync job statuses - now uses per-job status checks with server_ip
export const useAutoSyncJobStatuses = (jobs: VideoJobWithDocument[] | undefined) => {
  const queryClient = useQueryClient();
  const syncInProgressRef = useRef(false);
  const jobsRef = useRef(jobs);
  
  // Keep jobsRef updated
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);
  
  useEffect(() => {
    const syncStatuses = async () => {
      const currentJobs = jobsRef.current;
      if (!currentJobs) return;
      
      // Prevent concurrent syncs
      if (syncInProgressRef.current) return;
      
      // Find jobs that need syncing (pending or processing)
      const activeJobs = currentJobs.filter(
        job => job.external_job_id && 
               (job.status === 'pending' || job.status === 'processing')
      );
      
      if (activeJobs.length === 0) return;
      
      syncInProgressRef.current = true;
      
      try {
        let hasUpdates = false;
        
        // Check each job individually with correct server_ip
        for (const job of activeJobs) {
          try {
            const port = Number((job as any).target_port) || 5005;
            const proxy = port === 5006 ? 'marketing-video-proxy' : 'video-generation-proxy';
            const { data, error } = await supabase.functions.invoke(
              proxy,
              { 
                body: { 
                  action: 'status', 
                  job_id: job.external_job_id,
                  server_ip: job.server_ip,
                  target_port: port,
                } 
              }
            );
            
            if (error || !data) {
              console.error(`Failed to fetch status for job ${job.id}:`, error);
              continue;
            }
            
            // Check if status actually changed
            const statusChanged = data.status !== job.status;
            const progressChanged = (data.progress || 0) !== (job.progress || 0);
            
            if (statusChanged || progressChanged) {
              hasUpdates = true;
              
              const updateData: Record<string, unknown> = {
                progress: data.progress || 0,
                current_step: data.current_step || null,
                current_phase: data.current_phase || null,
              };
              
              if (data.status === 'completed' || data.status === 'completed_with_errors') {
                // Use dynamic URL based on server_ip + target_port
                const serverIp = job.server_ip || '69.197.145.4';
                updateData.status = data.status; // preserve exact status
                updateData.video_url = data.player_url || `http://${serverIp}:${port}/player_v2/?job=${job.external_job_id}`;
                updateData.completed_at = data.completed_at || new Date().toISOString();
                updateData.progress = data.status === 'completed' ? 100 : (data.progress || 0);
              } else if (data.status === 'failed') {
                updateData.status = 'failed';
                updateData.error_message = data.error || 'Job failed';
              } else if (data.status === 'processing') {
                updateData.status = 'processing';
              }
              
              await supabase
                .from('video_generation_jobs')
                .update(updateData)
                .eq('id', job.id);
            }
          } catch (err) {
            console.error(`Error syncing job ${job.id}:`, err);
          }
        }
        
        // Only refresh UI if there were actual updates
        if (hasUpdates) {
          queryClient.invalidateQueries({ queryKey: ['video-generation-jobs'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['video-generation-jobs-paginated'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['video-job-stats'] });
        }
      } catch (error) {
        console.error('Auto-sync failed:', error);
      } finally {
        syncInProgressRef.current = false;
      }
    };
    
    // Run immediately
    syncStatuses();
    
    // Then poll every 5 seconds
    const intervalId = setInterval(syncStatuses, 5000);
    
    return () => clearInterval(intervalId);
  }, [queryClient]);
};

// Hook for stitching missing assets
export const useStitchAssets = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (externalJobId: string) => {
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: { action: 'stitch_assets', job_id: externalJobId }
      });
      
      if (error) throw error;
      if (data?.status === 'error') throw new Error(data.error || 'Stitch failed');
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sanity-check'] });
      const updatedCount = data?.updated_assets || 0;
      toast.success(`Success! ${updatedCount} assets stitched. Refreshing data...`);
    },
    onError: (error) => {
      console.error('Asset stitch error:', error);
    }
  });
};

// Hook for repairing missing avatar assets (re-downloads from remote server)
export const useRepairMissingAssets = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ externalJobId, serverIp }: { externalJobId: string; serverIp?: string }) => {
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: { action: 'repair_missing_assets', job_id: externalJobId, ...(serverIp && { server_ip: serverIp }) }
      });
      
      if (error) throw error;
      if (data?.status === 'error') throw new Error(data.error || data.message || 'Repair failed');
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sanity-check'] });
      const repairedCount = data?.repaired_count || 0;
      toast.success(`Successfully repaired ${repairedCount} avatar file${repairedCount !== 1 ? 's' : ''}. Refreshing data...`);
    },
    onError: (error) => {
      console.error('Repair missing assets error:', error);
    }
  });
};

// Regeneration phase types
export type RegenerationPhase = 
  | 'manim_codegen' 
  | 'manim_render' 
  | 'avatar_generation' 
  | 'wan_render'
  | 'video_render'
  | 'tts_generation';

export interface RetryPhaseParams {
  externalJobId: string;
  phase: RegenerationPhase;
  sectionIds?: number[];
  userFeedback?: string;
  serverIp?: string;
}

// Regeneration status types
export interface AvatarGenerationStatus {
  state: 'idle' | 'processing' | 'completed' | 'error';
  message?: string;
  progress?: number;
  details?: {
    total_sections: number;
    completed_sections: number;
    failed_sections: number[];
  };
}

export interface RegenJobStatus {
  status: string;
  status_message?: string;
  current_phase?: string;
  progress?: number;
}

// Hook for retrying specific phases during regeneration
// This now also creates a persistent task in the database
export const useRetryPhase = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ externalJobId, phase, sectionIds, userFeedback, serverIp }: RetryPhaseParams) => {
      console.log(`[useRetryPhase] Calling retry_phase: phase=${phase}, job=${externalJobId}, sections=`, sectionIds, userFeedback ? `feedback: ${userFeedback}` : '', serverIp ? `server: ${serverIp}` : '');
      
      // First, call the edge function to start regeneration
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: { 
          action: 'retry_phase', 
          job_id: externalJobId,
          phase,
          section_ids: sectionIds,
          user_feedback: userFeedback,
          server_ip: serverIp
        }
      });
      
      console.log('[useRetryPhase] Response:', data, 'Error:', error);
      
      if (error) throw error;
      
      // Check for error status in the response
      if (data?.status === 'error') {
        const errorMsg = data.error || data.upstream_body?.error || data.upstream_body?.message || 'Regeneration failed';
        throw new Error(`${errorMsg} (upstream: ${data.upstream_status || 'unknown'})`);
      }
      
      // Create a persistent task in the database for tracking
      try {
        const phaseLabels: Record<string, string> = {
          avatar_generation: 'Avatar Generation',
          manim_codegen: 'Manim Code Generation',
          manim_render: 'Manim Re-render',
          wan_render: 'Visual Video Render',
          video_render: 'Video Render',
          tts_generation: 'TTS Audio Generation',
        };
        
        const sectionCount = sectionIds?.length || 0;
        const sectionText = sectionCount > 0 ? `${sectionCount} section(s)` : 'all sections';
        
        await supabase.from('regeneration_tasks').insert({
          external_job_id: externalJobId,
          phase,
          section_ids: sectionIds || null,
          status: 'processing',
          progress: 0,
          message: `${phaseLabels[phase] || phase} started for ${sectionText}`,
        });
        
        // Invalidate tasks query to show the new task
        queryClient.invalidateQueries({ queryKey: ['regeneration-tasks', externalJobId] });
      } catch (taskError) {
        // Don't fail the whole operation if task creation fails
        console.warn('[useRetryPhase] Failed to create tracking task:', taskError);
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['video-generation-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['sanity-check'] });
      
      const phase = data?.phase || 'Phase';
      const sectionsInfo = Array.isArray(data?.section_ids) 
        ? `${data.section_ids.length} section(s)` 
        : 'all sections';
      
      // Show different message based on whether we got upstream confirmation
      const description = data?.timeout 
        ? `Processing ${sectionsInfo} in background. Check status panel for progress.`
        : `Upstream confirmed. Processing ${sectionsInfo}. Check status panel.`;
      
      toast.success(`${phase} regeneration started`, { description });
    },
    onError: (error: Error) => {
      console.error('[useRetryPhase] Error:', error);
      toast.error('Failed to start regeneration', {
        description: error.message
      });
    }
  });
};

// Hook for regenerating visual content (Manim/WAN) via regenerate_and_render endpoint
export interface RegenerateAndRenderParams {
  externalJobId: string;
  sectionIds: number[];
  renderers?: string[];
  execute?: boolean;
  dryRun?: boolean;
  skipWan?: boolean;
}

export const useRegenerateAndRender = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ externalJobId, sectionIds, renderers, execute, dryRun, skipWan }: RegenerateAndRenderParams) => {
      console.log(`[useRegenerateAndRender] Job: ${externalJobId}, sections:`, sectionIds, `renderers:`, renderers);
      
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: { 
          action: 'regenerate_and_render', 
          job_id: externalJobId,
          section_ids: sectionIds,
          ...(renderers && { renderers }),
          ...(execute !== undefined && { execute }),
          ...(dryRun !== undefined && { dry_run: dryRun }),
          ...(skipWan !== undefined && { skip_wan: skipWan }),
        }
      });
      
      console.log('[useRegenerateAndRender] Response:', data, 'Error:', error);
      
      if (error) throw error;
      
      if (data?.status === 'error') {
        const errorMsg = data.error || data.upstream_body?.error || data.upstream_body?.message || 'Regeneration failed';
        throw new Error(`${errorMsg} (upstream: ${data.upstream_status || 'unknown'})`);
      }
      
      // Create a persistent task in the database for tracking
      try {
        const rendererLabel = renderers?.includes('manim') ? 'Manim Regeneration' 
          : renderers?.includes('wan') ? 'Visual Video Regeneration' 
          : 'Visual Regeneration';
        
        const sectionText = `${sectionIds.length} section(s)`;
        
        // Use a phase name that maps to visual regeneration for tracking
        const trackingPhase = renderers?.includes('manim') ? 'manim_codegen' 
          : renderers?.includes('wan') ? 'wan_render' 
          : 'wan_render';
        
        await supabase.from('regeneration_tasks').insert({
          external_job_id: externalJobId,
          phase: trackingPhase,
          section_ids: sectionIds,
          status: 'processing',
          progress: 0,
          message: `${rendererLabel} started for ${sectionText}`,
        });
        
        queryClient.invalidateQueries({ queryKey: ['regeneration-tasks', externalJobId] });
      } catch (taskError) {
        console.warn('[useRegenerateAndRender] Failed to create tracking task:', taskError);
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['video-generation-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['sanity-check'] });
      
      const sectionsInfo = Array.isArray(data?.section_ids) 
        ? `${data.section_ids.length} section(s)` 
        : 'selected sections';
      
      const description = data?.timeout 
        ? `Processing ${sectionsInfo} in background. Check status panel for progress.`
        : `Upstream confirmed. Processing ${sectionsInfo}. Check status panel.`;
      
      toast.success('Visual regeneration started', { description });
    },
    onError: (error: Error) => {
      console.error('[useRegenerateAndRender] Error:', error);
      toast.error('Failed to start visual regeneration', {
        description: error.message
      });
    }
  });
};


// Hook for quick WAN re-render via /rerender endpoint (no LLM re-generation)
export interface RerenderParams {
  externalJobId: string;
  sectionIds: number[];
}

export const useRerender = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ externalJobId, sectionIds }: RerenderParams) => {
      console.log(`[useRerender] Job: ${externalJobId}, sections:`, sectionIds);
      
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: { 
          action: 'rerender', 
          job_id: externalJobId,
          section_ids: sectionIds,
        }
      });
      
      console.log('[useRerender] Response:', data, 'Error:', error);
      
      if (error) throw error;
      
      if (data?.status === 'error') {
        const errorMsg = data.error || data.upstream_body?.error || data.upstream_body?.message || 'Rerender failed';
        throw new Error(`${errorMsg} (upstream: ${data.upstream_status || 'unknown'})`);
      }
      
      // Create a persistent task in the database for tracking
      try {
        const sectionText = `${sectionIds.length} section(s)`;
        
        await supabase.from('regeneration_tasks').insert({
          external_job_id: externalJobId,
          phase: 'wan_render',
          section_ids: sectionIds,
          status: 'processing',
          progress: 0,
          message: `WAN Rerender started for ${sectionText}`,
        });
        
        queryClient.invalidateQueries({ queryKey: ['regeneration-tasks', externalJobId] });
      } catch (taskError) {
        console.warn('[useRerender] Failed to create tracking task:', taskError);
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['video-generation-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['sanity-check'] });
      
      const sectionsInfo = Array.isArray(data?.section_ids) 
        ? `${data.section_ids.length} section(s)` 
        : 'selected sections';
      
      const description = data?.timeout 
        ? `Processing ${sectionsInfo} in background. Check status panel for progress.`
        : `Upstream confirmed. Processing ${sectionsInfo}. Check status panel.`;
      
      toast.success('WAN rerender started', { description });
    },
    onError: (error: Error) => {
      console.error('[useRerender] Error:', error);
      toast.error('Failed to start WAN rerender', {
        description: error.message
      });
    }
  });
};

export const useAvatarGenerationStatus = (externalJobId: string | null, enabled: boolean = true, serverIp?: string) => {
  return useQuery({
    queryKey: ['avatar-regen-status', externalJobId],
    queryFn: async () => {
      if (!externalJobId) return null;
      
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: { action: 'avatar_regen_status', job_id: externalJobId, server_ip: serverIp }
      });
      
      // Handle edge function errors gracefully - return idle state
      if (error) {
        console.warn('Avatar status fetch error, returning idle state:', error);
        return { state: 'idle', message: 'Unable to fetch status' } as AvatarGenerationStatus;
      }
      return data as AvatarGenerationStatus;
    },
    enabled: enabled && !!externalJobId,
    refetchInterval: (query) => {
      // Poll every 3 seconds while processing
      const data = query.state.data as AvatarGenerationStatus | null | undefined;
      if (data?.state === 'processing') return 3000;
      return false;
    },
    staleTime: 1000,
    retry: false, // Don't retry on errors - we handle them gracefully
  });
};

// Hook to fetch general job/regeneration status with auto-polling
export const useRegenJobStatus = (externalJobId: string | null, enabled: boolean = true, serverIp?: string) => {
  return useQuery({
    queryKey: ['regen-job-status', externalJobId],
    queryFn: async () => {
      if (!externalJobId) return null;
      
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: { action: 'regen_job_status', job_id: externalJobId, server_ip: serverIp }
      });
      
      // Handle edge function errors gracefully
      if (error) {
        console.warn('Job status fetch error, returning idle state:', error);
        return { status: 'idle', status_message: 'Unable to fetch status' } as RegenJobStatus;
      }
      return data as RegenJobStatus;
    },
    enabled: enabled && !!externalJobId,
    refetchInterval: (query) => {
      // Poll every 3 seconds while processing
      const data = query.state.data as RegenJobStatus | null | undefined;
      if (data?.status === 'processing') return 3000;
      return false;
    },
    staleTime: 1000,
    retry: false, // Don't retry on errors - we handle them gracefully
  });
};

// ========== NEW REGENERATION HOOKS ==========

// Hook to regenerate all failed/missing avatars automatically using unified retry_phase
export const useRegenerateFailedAvatars = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ externalJobId, serverIp }: { externalJobId: string; serverIp?: string }) => {
      console.log(`[useRegenerateFailedAvatars] Using unified retry_phase for job: ${externalJobId}`, serverIp ? `server: ${serverIp}` : '');
      
      // Use the unified retry_phase endpoint for avatar generation
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: { 
          action: 'retry_phase', 
          job_id: externalJobId,
          phase: 'avatar_generation',
          server_ip: serverIp
          // No section_ids = process ALL failed sections
        }
      });
      
      if (error) throw error;
      if (data?.status === 'error') {
        throw new Error(data.error || data.upstream_body?.error || 'Regeneration failed');
      }
      
      // Create tracking task for status monitoring
      try {
        await supabase.from('regeneration_tasks').insert({
          external_job_id: externalJobId,
          phase: 'avatar_generation',
          section_ids: null, // All sections
          status: 'processing',
          progress: 0,
          message: 'Avatar regeneration started (all failed sections)',
        });
        queryClient.invalidateQueries({ queryKey: ['regeneration-tasks', externalJobId] });
      } catch (taskError) {
        console.warn('[useRegenerateFailedAvatars] Failed to create tracking task:', taskError);
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-generation-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['sanity-check'] });
      toast.success('Failed avatar regeneration started! Check status panel for progress.');
    },
    onError: (error: Error) => {
      console.error('[useRegenerateFailedAvatars] Error:', error);
      toast.error('Failed to start avatar regeneration', {
        description: error.message
      });
    }
  });
};

// Hook to regenerate a single avatar for a specific section (unified retry_phase)
export const useRegenerateSingleAvatar = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ externalJobId, sectionId, serverIp }: { externalJobId: string; sectionId: number; serverIp?: string }) => {
      console.log(`[useRegenerateSingleAvatar] Regenerating avatar for job: ${externalJobId}, section: ${sectionId} via retry_phase`, serverIp ? `server: ${serverIp}` : '');
      
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: { 
          action: 'retry_phase', 
          job_id: externalJobId,
          phase: 'avatar_generation',
          section_ids: [sectionId],  // Single section as array
          server_ip: serverIp
        }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return { ...data, section_id: sectionId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['video-generation-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['sanity-check'] });
      toast.success(`Avatar regeneration started for section ${data?.section_id || 'unknown'}`);
    },
    onError: (error: Error) => {
      console.error('[useRegenerateSingleAvatar] Error:', error);
      toast.error('Failed to start avatar regeneration', {
        description: error.message
      });
    }
  });
};

// Hook to regenerate Manim with user feedback (unified retry_phase)
export const useRegenerateManimWithFeedback = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      externalJobId, 
      sectionId, 
      userFeedback 
    }: { 
      externalJobId: string; 
      sectionId: number; 
      userFeedback?: string;
    }) => {
      console.log(`[useRegenerateManimWithFeedback] Regenerating Manim for job: ${externalJobId}, section: ${sectionId}, feedback: ${userFeedback || '(none)'} via retry_phase`);
      
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: { 
          action: 'retry_phase', 
          job_id: externalJobId,
          phase: 'manim_codegen',
          section_ids: [sectionId],
          user_feedback: userFeedback || undefined  // Only include if provided
        }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return { ...data, section_id: sectionId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['video-generation-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['sanity-check'] });
      toast.success('Manim regeneration started!', {
        description: data?.message || `Processing section ${data?.section_id || 'unknown'}`
      });
    },
    onError: (error: Error) => {
      console.error('[useRegenerateManimWithFeedback] Error:', error);
      toast.error('Failed to start Manim regeneration', {
        description: error.message
      });
    }
  });
};

// Submit section-specific review notes
export const useSubmitReview = () => {
  return useMutation({
    mutationFn: async ({ 
      externalJobId, 
      sections 
    }: { 
      externalJobId: string; 
      sections: { section_id: number; notes: string }[] 
    }) => {
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: { 
          action: 'submit_review', 
          job_id: externalJobId,
          sections 
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Review submitted successfully');
    },
    onError: (error: Error) => {
      console.error('[useSubmitReview] Error:', error);
      toast.error('Failed to submit review');
    }
  });
};

// Trigger regeneration based on submitted reviews
// Includes fallback to section-by-section regeneration if batch fails
export const useRecreateFromReview = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      externalJobId, 
      sectionIds,
      edits
    }: { 
      externalJobId: string; 
      sectionIds?: number[];
      edits?: { section_id: number; notes: string }[];
    }) => {
      // Transform edits to the format expected by the API
      const formattedEdits = edits?.map(e => ({
        section_id: e.section_id,
        notes: e.notes,
        feedback: e.notes,
        edit: e.notes,
        text: e.notes,
      }));
      
      console.log('[useRecreateFromReview] Attempting batch regeneration...');
      
      // First try the batch approach
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: { 
          action: 'recreate_from_review', 
          job_id: externalJobId,
          section_ids: sectionIds,
          edits: formattedEdits
        }
      });
      
      // If batch fails with "No reviews found", try section-by-section using proven retry_phase
      const errorMessage = error?.message || data?.error || '';
      if (error || errorMessage.includes('No reviews found')) {
        console.log('[useRecreateFromReview] Batch failed with:', errorMessage);
        console.log('[useRecreateFromReview] Falling back to section-by-section regeneration...');
        
        if (!edits || edits.length === 0) {
          throw new Error('No edits provided for regeneration');
        }
        
        const results = [];
        for (const edit of edits) {
          console.log(`[useRecreateFromReview] Regenerating section ${edit.section_id} with feedback...`);
          
          const { data: sectionData, error: sectionError } = await supabase.functions.invoke('video-generation-proxy', {
            body: { 
              action: 'regenerate_with_feedback',
              job_id: externalJobId,
              section_id: edit.section_id,
              feedback: edit.notes,
              phase: 'avatar_generation'
            }
          });
          
          if (sectionError) {
            console.error(`[useRecreateFromReview] Section ${edit.section_id} failed:`, sectionError);
          } else {
            console.log(`[useRecreateFromReview] Section ${edit.section_id} started:`, sectionData);
            results.push({ section_id: edit.section_id, ...sectionData });
          }
        }
        
        return { success: true, method: 'section_by_section', results };
      }
      
      if (error) throw error;
      return { ...data, method: 'batch' };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['video-generation-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['sanity-check'] });
      const method = data?.method === 'section_by_section' 
        ? 'Section-by-section regeneration started' 
        : 'Batch regeneration started';
      toast.success(method);
    },
    onError: (error: Error) => {
      console.error('[useRecreateFromReview] Error:', error);
      toast.error('Failed to start regeneration', {
        description: error.message
      });
    }
  });
};
