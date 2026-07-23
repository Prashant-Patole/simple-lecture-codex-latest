import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types for regeneration tasks
export interface RegenerationTask {
  id: string;
  external_job_id: string;
  phase: string;
  section_ids: number[] | null;
  status: string;
  progress: number;
  message: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  created_by: string | null;
}

// Phase label mapping
export const phaseLabels: Record<string, string> = {
  avatar_generation: 'Avatar Generation',
  manim_codegen: 'Manim Code Generation',
  manim_render: 'Manim Re-render',
  wan_render: 'Visual Video Render',
  video_render: 'Video Render',
  tts_generation: 'TTS Audio Generation',
};

// Calculate elapsed time string
export const getElapsedTime = (startedAt: string): string => {
  const seconds = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
};

// Calculate duration string
export const getDuration = (startedAt: string, completedAt: string | null): string => {
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const seconds = Math.floor((end - new Date(startedAt).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
};

// Hook to fetch regeneration tasks for a specific job
export const useRegenerationTasks = (externalJobId: string | null) => {
  return useQuery({
    queryKey: ['regeneration-tasks', externalJobId],
    queryFn: async () => {
      if (!externalJobId) return [];
      
      const { data, error } = await supabase
        .from('regeneration_tasks')
        .select('*')
        .eq('external_job_id', externalJobId)
        .order('started_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching regeneration tasks:', error);
        return [];
      }
      
      return data as RegenerationTask[];
    },
    enabled: !!externalJobId,
    refetchInterval: (query) => {
      // Poll every 3 seconds while any task is processing
      const tasks = query.state.data as RegenerationTask[] | undefined;
      const hasProcessing = tasks?.some(t => t.status === 'processing');
      return hasProcessing ? 3000 : false;
    },
    staleTime: 1000,
  });
};

// Hook to check if there are any active tasks for a job
export const useHasActiveTasks = (externalJobId: string | null) => {
  const { data: tasks } = useRegenerationTasks(externalJobId);
  return {
    hasActiveTasks: tasks?.some(t => t.status === 'processing') || false,
    hasTasks: (tasks?.length || 0) > 0,
    tasks,
  };
};

// Hook to create a new regeneration task
export const useCreateRegenerationTask = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      externalJobId,
      phase,
      sectionIds,
      message,
    }: {
      externalJobId: string;
      phase: string;
      sectionIds?: number[];
      message?: string;
    }) => {
      const { data, error } = await supabase
        .from('regeneration_tasks')
        .insert({
          external_job_id: externalJobId,
          phase,
          section_ids: sectionIds || null,
          status: 'processing',
          progress: 0,
          message: message || `Starting ${phaseLabels[phase] || phase}...`,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as RegenerationTask;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['regeneration-tasks', data.external_job_id] });
    },
    onError: (error) => {
      console.error('Failed to create regeneration task:', error);
    },
  });
};

// Hook to update a regeneration task
export const useUpdateRegenerationTask = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      taskId,
      updates,
    }: {
      taskId: string;
      updates: Partial<Pick<RegenerationTask, 'status' | 'progress' | 'message' | 'completed_at'>>;
    }) => {
      const { data, error } = await supabase
        .from('regeneration_tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single();
      
      if (error) throw error;
      return data as RegenerationTask;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['regeneration-tasks', data.external_job_id] });
    },
  });
};

// Hook to delete a regeneration task
export const useDeleteRegenerationTask = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ taskId, externalJobId }: { taskId: string; externalJobId: string }) => {
      const { error } = await supabase
        .from('regeneration_tasks')
        .delete()
        .eq('id', taskId);
      
      if (error) throw error;
      return { taskId, externalJobId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['regeneration-tasks', data.externalJobId] });
    },
  });
};

// Minimum processing time before checking for completion (2 minutes)
const MIN_PROCESSING_TIME = 2 * 60 * 1000;

// Check if a section's asset is healthy based on the regeneration phase
function checkPhaseHealth(section: any, phase: string): boolean {
  if (!section) return false;
  
  switch (phase) {
    case 'avatar_generation':
      return section?.avatar_video?.status === 200;
    case 'wan_render':
    case 'manim_render':
    case 'video_render':
      return section?.topic_video?.status === 200;
    case 'tts_generation':
      return section?.audio?.status === 200;
    default:
      return false;
  }
}

// Hook to poll and verify task completion using sanity check
export const usePollTaskProgress = (task: RegenerationTask | null, externalJobId: string | null, serverIp?: string) => {
  const updateTask = useUpdateRegenerationTask();
  
  return useQuery({
    queryKey: ['task-progress', task?.id, serverIp],
    queryFn: async () => {
      if (!task || !externalJobId || task.status !== 'processing') return null;
      
      const elapsedMs = Date.now() - new Date(task.started_at).getTime();
      
      // During minimum processing time, show estimated progress based on time
      if (elapsedMs < MIN_PROCESSING_TIME) {
        const estimatedProgress = Math.min(80, Math.floor((elapsedMs / MIN_PROCESSING_TIME) * 80));
        
        if (estimatedProgress > (task.progress || 0)) {
          await updateTask.mutateAsync({
            taskId: task.id,
            updates: {
              progress: estimatedProgress,
              message: `Processing... (${Math.floor(elapsedMs / 1000)}s elapsed)`,
            },
          });
        }
        
        return { estimatedProgress, verifying: false };
      }
      
      // After minimum time, use sanity check to verify completion
      const { data: sanityData, error: sanityError } = await supabase.functions.invoke('video-generation-proxy', {
        body: { action: 'sanity_check', job_id: externalJobId, ...(serverIp && { server_ip: serverIp }) }
      });
      
      if (sanityError) {
        console.warn('Failed to fetch sanity check:', sanityError);
        // Update message to show we're still waiting
        if (task.message !== 'Verifying asset health...') {
          await updateTask.mutateAsync({
            taskId: task.id,
            updates: {
              progress: 85,
              message: 'Verifying asset health...',
            },
          });
        }
        return null;
      }
      
      // Find target sections and check their health
      const sections = sanityData?.sections || [];
      const targetSections = task.section_ids?.length 
        ? sections.filter((s: any) => task.section_ids?.includes(s.section_id))
        : sections;
      
      // Check if all target sections have healthy assets for this phase
      const allHealthy = targetSections.length > 0 && 
        targetSections.every((section: any) => checkPhaseHealth(section, task.phase));
      
      if (allHealthy) {
        // Assets are healthy - mark as completed
        await updateTask.mutateAsync({
          taskId: task.id,
          updates: {
            status: 'completed',
            progress: 100,
            message: 'Completed ✓ Verified',
            completed_at: new Date().toISOString(),
          },
        });
        return { completed: true };
      }
      
      // Still processing - update progress message
      const healthyCount = targetSections.filter((s: any) => checkPhaseHealth(s, task.phase)).length;
      const totalCount = targetSections.length;
      const verifyingProgress = Math.min(95, 80 + Math.floor((healthyCount / Math.max(totalCount, 1)) * 15));
      
      await updateTask.mutateAsync({
        taskId: task.id,
        updates: {
          progress: verifyingProgress,
          message: `Verifying assets... (${healthyCount}/${totalCount} healthy)`,
        },
      });
      
      return { healthyCount, totalCount, verifying: true };
    },
    enabled: !!task && task.status === 'processing' && !!externalJobId,
    refetchInterval: 5000, // Poll every 5 seconds
    staleTime: 2000,
  });
};

// Hook to mark tasks as failed if they exceed maximum duration (3 hours)
export const useCleanupStaleTasks = (externalJobId: string | null) => {
  const updateTask = useUpdateRegenerationTask();
  const { data: tasks } = useRegenerationTasks(externalJobId);
  
  // Check for tasks that have run too long
  useQuery({
    queryKey: ['cleanup-stale-tasks', externalJobId],
    queryFn: async () => {
      if (!tasks) return null;
      
      const now = Date.now();
      const maxDuration = 3 * 60 * 60 * 1000; // 3 hours maximum duration
      
      for (const task of tasks) {
        if (task.status === 'processing') {
          // Use started_at for hard timeout (not updated_at which refreshes during polling)
          const startTime = new Date(task.started_at).getTime();
          if (now - startTime > maxDuration) {
            console.log(`Marking task ${task.id} as failed: exceeded 3 hour maximum duration`);
            await updateTask.mutateAsync({
              taskId: task.id,
              updates: {
                status: 'failed',
                message: 'Task timed out (exceeded 3 hour maximum duration)',
                completed_at: new Date().toISOString(),
              },
            });
          }
        }
      }
      
      return true;
    },
    enabled: !!externalJobId && !!tasks?.length,
    refetchInterval: 60000, // Check every minute
    staleTime: 30000,
  });
};
