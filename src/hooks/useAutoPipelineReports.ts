import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AutoPipelineReport {
  id: string;
  subject_id: string;
  subject_name: string;
  chapter_id: string | null;
  chapter_name: string | null;
  chapter_number: number | null;
  topic_id: string | null;
  topic_name: string | null;
  topic_number: number | null;
  document_id: string | null;
  external_job_id: string | null;
  server_ip: string | null;
  category: 'good' | 'bad';
  status: 'completed' | 'failed' | 'partial' | 'no_document' | 'pending';
  submitted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  sanity_summary: Record<string, any> | null;
  error_message: string | null;
  problem_description: string | null;
  retry_count: number;
  retry_details: Array<{ phase: string; attempt: number; error: string; timestamp: string }> | null;
  failed_phases: string[] | null;
  created_at: string;
  created_by: string | null;
}

export const useAutoPipelineReports = (category?: 'good' | 'bad') => {
  return useQuery({
    queryKey: ['auto-pipeline-reports', category],
    queryFn: async () => {
      let query = supabase
        .from('auto_pipeline_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as AutoPipelineReport[];
    },
    refetchInterval: 30000,
  });
};

export const useBadReportCount = () => {
  return useQuery({
    queryKey: ['auto-pipeline-reports-bad-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('auto_pipeline_reports')
        .select('*', { count: 'exact', head: true })
        .eq('category', 'bad');
      if (error) return 0;
      return count || 0;
    },
    refetchInterval: 30000,
  });
};

export const useCreatePipelineReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (report: Omit<AutoPipelineReport, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('auto_pipeline_reports')
        .insert([report as any])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-pipeline-reports'] });
      queryClient.invalidateQueries({ queryKey: ['auto-pipeline-reports-bad-count'] });
    },
  });
};

export const useDeletePipelineReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('auto_pipeline_reports')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-pipeline-reports'] });
      queryClient.invalidateQueries({ queryKey: ['auto-pipeline-reports-bad-count'] });
    },
  });
};
