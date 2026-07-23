import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ChapterProgress, PipelineState } from "./useAutoPipeline";

export interface ActivePipelineRun {
  id: string;
  subjectId: string;
  subjectName: string;
  status: PipelineState | 'interrupted';
  chaptersData: ChapterProgress[];
  currentChapterIndex: number;
  totalJobs: number;
  completedJobs: number;
  goodJobs: number;
  badJobs: number;
  startedAt: string;
  updatedAt: string;
  scanResults: any[] | null;
  selectedIps: string[] | null;
}

export function useActivePipelineRun(subjectId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: activeRun, isLoading } = useQuery({
    queryKey: ['active-pipeline-run', subjectId],
    queryFn: async (): Promise<ActivePipelineRun | null> => {
      if (!subjectId) return null;

      const { data, error } = await supabase
        .from('auto_pipeline_runs')
        .select('*')
        .eq('subject_id', subjectId)
        .in('status', ['building_queue', 'running', 'paused_for_approval', 'interrupted', 'scanning', 'scan_complete'])
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;

      // Prefer chapters_data built from job_queue by the worker
      const chaptersData = (data.chapters_data as unknown as ChapterProgress[]) || [];

      return {
        id: data.id,
        subjectId: data.subject_id,
        subjectName: data.subject_name,
        status: data.status as PipelineState | 'interrupted',
        chaptersData,
        currentChapterIndex: data.current_chapter_index,
        totalJobs: data.total_jobs,
        completedJobs: data.completed_jobs,
        goodJobs: data.good_jobs,
        badJobs: data.bad_jobs,
        startedAt: data.started_at,
        updatedAt: data.updated_at,
        scanResults: (data.scan_results as any) || null,
        selectedIps: (data.selected_ips as string[]) || null,
      };
    },
    enabled: !!subjectId,
    staleTime: 1000 * 3,
    refetchInterval: 5000, // Poll every 5 seconds for live updates
    refetchOnWindowFocus: true,
  });

  const dismissRun = async (runId: string) => {
    await supabase
      .from('auto_pipeline_runs')
      .update({ status: 'cancelled' })
      .eq('id', runId);
    queryClient.invalidateQueries({ queryKey: ['active-pipeline-run', subjectId] });
  };

  return { activeRun, isLoading, dismissRun };
}
