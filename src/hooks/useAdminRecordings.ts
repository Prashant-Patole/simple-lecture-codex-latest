import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AdminRecording {
  id: string;
  scheduled_class_id: string | null;
  bbb_recording_id: string | null;
  b2_original_path: string | null;
  b2_hls_360p_path: string | null;
  b2_hls_480p_path: string | null;
  b2_hls_720p_path: string | null;
  b2_hls_1080p_path: string | null;
  bunny_video_guid: string | null;
  bunny_status: string | null;
  processing_status: string | null;
  processing_error: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  available_qualities: string[] | null;
  default_quality: string | null;
  created_at: string | null;
  processed_at: string | null;
  // New columns for topic-based recordings
  course_id: string | null;
  subject_id: string | null;
  chapter_id: string | null;
  topic_id: string | null;
  recording_title: string | null;
  recording_type: string | null;
  original_filename: string | null;
  // Related data for new columns
  course?: { id: string; name: string } | null;
  subject?: { id: string; name: string } | null;
  chapter?: { id: string; title: string; chapter_number: number } | null;
  topic?: { id: string; title: string; topic_number: string } | null;
  // Backward compatibility for class-based recordings
  scheduled_class?: {
    id: string;
    scheduled_at: string;
    subject: string | null;
    course: { id: string; name: string } | null;
    teacher: { id: string; full_name: string } | null;
  } | null;
}

interface RecordingFilters {
  courseId?: string;
  subjectId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const useAdminRecordings = (filters?: RecordingFilters) => {
  return useQuery({
    queryKey: ['admin-recordings', filters],
    queryFn: async () => {
      let query = supabase
        .from('class_recordings')
        .select(`
          id,
          scheduled_class_id,
          bbb_recording_id,
          b2_original_path,
          b2_hls_360p_path,
          b2_hls_480p_path,
          b2_hls_720p_path,
          b2_hls_1080p_path,
          bunny_video_guid,
          bunny_status,
          processing_status,
          processing_error,
          duration_seconds,
          file_size_bytes,
          available_qualities,
          default_quality,
          created_at,
          processed_at,
          course_id,
          subject_id,
          chapter_id,
          topic_id,
          recording_title,
          recording_type,
          original_filename,
          course:courses!course_id(id, name),
          subject:popular_subjects!subject_id(id, name),
          chapter:subject_chapters!chapter_id(id, title, chapter_number),
          topic:subject_topics!topic_id(id, title, topic_number),
          scheduled_class:scheduled_classes(
            id,
            scheduled_at,
            course_id,
            subject,
            course:courses(id, name),
            teacher:teacher_profiles(id, full_name)
          )
        `)
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('processing_status', filters.status);
      }

      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }

      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter by course if needed (post-query filter due to nested structure)
      let filteredData = data || [];
      
      if (filters?.courseId) {
        filteredData = filteredData.filter(r => 
          (r as any).course?.id === filters.courseId ||
          (r.scheduled_class as any)?.course?.id === filters.courseId
        );
      }

      // Filter by subject if needed
      if (filters?.subjectId) {
        filteredData = filteredData.filter(r => 
          (r as any).subject?.id === filters.subjectId ||
          (r.scheduled_class as any)?.subject === filters.subjectId
        );
      }

      return filteredData as unknown as AdminRecording[];
    },
  });
};

export const useRecordingStats = () => {
  return useQuery({
    queryKey: ['recording-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('class_recordings')
        .select('processing_status, duration_seconds, file_size_bytes');

      if (error) throw error;

      const stats = {
        total: data?.length || 0,
        ready: data?.filter(r => r.processing_status === 'ready').length || 0,
        processing: data?.filter(r => r.processing_status === 'processing').length || 0,
        pending: data?.filter(r => r.processing_status === 'pending').length || 0,
        failed: data?.filter(r => r.processing_status === 'failed').length || 0,
        totalDuration: data?.reduce((sum, r) => sum + (r.duration_seconds || 0), 0) || 0,
        totalSize: data?.reduce((sum, r) => sum + (r.file_size_bytes || 0), 0) || 0,
      };

      return stats;
    },
  });
};

export const useDeleteRecording = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recordingId: string) => {
      const { error } = await supabase
        .from('class_recordings')
        .delete()
        .eq('id', recordingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-recordings'] });
      queryClient.invalidateQueries({ queryKey: ['recording-stats'] });
      toast.success('Recording deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete recording: ${error.message}`);
    },
  });
};

export const useReprocessRecording = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recordingId: string) => {
      // Get recording details
      const { data: recording, error: fetchError } = await supabase
        .from('class_recordings')
        .select('bbb_recording_id, b2_original_path')
        .eq('id', recordingId)
        .single();

      if (fetchError) throw fetchError;

      // Update status to pending
      const { error: updateError } = await supabase
        .from('class_recordings')
        .update({ 
          processing_status: 'pending',
          processing_error: null 
        })
        .eq('id', recordingId);

      if (updateError) throw updateError;

      // Trigger reprocessing
      const { error: fnError } = await supabase.functions.invoke('transfer-recording', {
        body: { 
          recording_id: recordingId,
          bbb_recording_id: recording.bbb_recording_id,
          reprocess: true
        },
      });

      if (fnError) throw fnError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-recordings'] });
      toast.success('Recording queued for reprocessing');
    },
    onError: (error: Error) => {
      toast.error(`Failed to reprocess: ${error.message}`);
    },
  });
};

export const useBulkDeleteRecordings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recordingIds: string[]) => {
      const { error } = await supabase
        .from('class_recordings')
        .delete()
        .in('id', recordingIds);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-recordings'] });
      queryClient.invalidateQueries({ queryKey: ['recording-stats'] });
      toast.success(`${variables.length} recordings deleted`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete recordings: ${error.message}`);
    },
  });
};
