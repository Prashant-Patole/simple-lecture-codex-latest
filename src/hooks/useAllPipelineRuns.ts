import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ChapterProgress, PipelineState } from "./useAutoPipeline";

export interface PipelineRunSummary {
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
}

export function useAllPipelineRuns() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['all-pipeline-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auto_pipeline_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);

      if (error || !data) return { active: [], recent: [] };

      const runs: PipelineRunSummary[] = data.map((r: any) => ({
        id: r.id,
        subjectId: r.subject_id,
        subjectName: r.subject_name,
        status: r.status as PipelineState | 'interrupted',
        chaptersData: (r.chapters_data as unknown as ChapterProgress[]) || [],
        currentChapterIndex: r.current_chapter_index,
        totalJobs: r.total_jobs,
        completedJobs: r.completed_jobs,
        goodJobs: r.good_jobs,
        badJobs: r.bad_jobs,
        startedAt: r.started_at,
        updatedAt: r.updated_at,
        scanResults: r.scan_results as any[] | null,
      }));

      const activeStatuses = ['running', 'scanning', 'scan_complete', 'building_queue', 'paused_for_approval', 'interrupted'];
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      return {
        active: runs.filter(r => activeStatuses.includes(r.status)),
        recent: runs.filter(r => !activeStatuses.includes(r.status) && r.startedAt > sevenDaysAgo),
      };
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.active && data.active.length > 0 ? 5000 : 30000;
    },
    refetchOnWindowFocus: true,
  });

  const cancelRun = async (runId: string) => {
    await supabase.from('auto_pipeline_runs').update({ status: 'cancelled' }).eq('id', runId);
    queryClient.invalidateQueries({ queryKey: ['all-pipeline-runs'] });
    queryClient.invalidateQueries({ queryKey: ['active-pipeline-run'], exact: false });
  };

  const approveChapter = async (runId: string) => {
    // The server-side worker checks for paused_for_approval -> running transition
    await supabase.from('auto_pipeline_runs').update({ status: 'running' }).eq('id', runId);
    // Trigger the worker immediately
    try {
      await supabase.functions.invoke('auto-pipeline-worker', { body: {} });
    } catch { /* cron will pick up */ }
    queryClient.invalidateQueries({ queryKey: ['all-pipeline-runs'] });
    queryClient.invalidateQueries({ queryKey: ['active-pipeline-run'], exact: false });
  };

  const cleanupStaleRuns = async () => {
    // Mark runs that have been "running" for over 24 hours with empty job queues as cancelled
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('auto_pipeline_runs')
      .update({ status: 'cancelled' })
      .in('status', ['running', 'building_queue', 'scanning'])
      .lt('updated_at', cutoff);
    queryClient.invalidateQueries({ queryKey: ['all-pipeline-runs'] });
    queryClient.invalidateQueries({ queryKey: ['active-pipeline-run'], exact: false });
  };

  return {
    activeRuns: data?.active || [],
    recentRuns: data?.recent || [],
    isLoading,
    cancelRun,
    approveChapter,
    cleanupStaleRuns,
  };
}

// Small hook just for sidebar badge count
export function useActivePipelineRunCount() {
  const { data: count = 0 } = useQuery({
    queryKey: ['active-pipeline-run-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('auto_pipeline_runs')
        .select('*', { count: 'exact', head: true })
        .in('status', ['running', 'scanning', 'scan_complete', 'building_queue', 'paused_for_approval']);
      if (error) return 0;
      return count || 0;
    },
    refetchInterval: 15000,
  });
  return count;
}
