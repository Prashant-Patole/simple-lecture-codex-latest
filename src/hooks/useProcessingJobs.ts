import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProcessingJobFilters {
  jobType?: string;
  status?: string;
  documentId?: string;
}

export const useProcessingJobs = (filters: ProcessingJobFilters = {}) => {
  return useQuery({
    queryKey: ['processing-jobs', filters],
    queryFn: async () => {
      let query = supabase
        .from('document_processing_jobs')
        .select(`
          *,
          uploaded_question_documents!document_processing_jobs_document_id_fkey(
            file_name,
            file_type,
            category_id,
            subject_id,
            chapter_id
          )
        `)
        .order('created_at', { ascending: false });
      
      if (filters.jobType && filters.jobType !== 'all') {
        query = query.eq('job_type', filters.jobType);
      }
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.documentId) {
        query = query.eq('document_id', filters.documentId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });
};

export const useJobLogs = (jobId: string | null) => {
  return useQuery({
    queryKey: ['job-logs', jobId],
    queryFn: async () => {
      if (!jobId) return [];
      
      const { data, error } = await supabase
        .from('job_logs')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!jobId,
  });
};

export const useRetryJob = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { data, error } = await supabase.functions.invoke('retry-failed-job', {
        body: { jobId }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Job retry initiated successfully');
      queryClient.invalidateQueries({ queryKey: ['processing-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job-logs'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to retry job', {
        description: error.message
      });
    }
  });
};

export const useCancelJob = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from('document_processing_jobs')
        .update({
          status: 'failed',
          error_message: 'Cancelled by user',
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Job cancelled');
      queryClient.invalidateQueries({ queryKey: ['processing-jobs'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to cancel job', {
        description: error.message
      });
    }
  });
};

export const useJobStats = () => {
  return useQuery({
    queryKey: ['job-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_processing_jobs')
        .select('status');
      
      if (error) throw error;
      
      const stats = {
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        timeout: 0,
        total: data.length
      };
      
      data.forEach((job: any) => {
        stats[job.status as keyof typeof stats]++;
      });
      
      return stats;
    },
    refetchInterval: 5000,
  });
};

export const useCheckJobStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { data, error } = await supabase.functions.invoke('check-replit-job-status', {
        body: { jobId }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data, jobId) => {
      if (data.status === 'completed') {
        toast.success('Processing completed!', {
          description: `${data.questionsInserted} questions inserted into database`
        });
      } else if (data.status === 'processing') {
        toast.info('Still processing', {
          description: 'Job is being processed on Replit service'
        });
      } else if (data.status === 'failed') {
        toast.error('Processing failed', {
          description: data.message
        });
      }
      
      // Invalidate only necessary queries
      queryClient.invalidateQueries({ queryKey: ['processing-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job-logs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['uploaded-documents'] });
      
      // Only invalidate pending questions if completed
      if (data.status === 'completed') {
        queryClient.invalidateQueries({ queryKey: ['pending-questions'] });
      }
    },
    onError: (error: Error) => {
      toast.error('Failed to check job status', {
        description: error.message
      });
    }
  });
};