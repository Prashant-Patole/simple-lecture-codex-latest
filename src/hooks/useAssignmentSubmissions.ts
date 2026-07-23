import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentAuthUser } from './useCurrentAuthUser';
import { toast } from '@/hooks/use-toast';

export interface AssignmentAnswer {
  question_id: string;
  text_answer?: string;
  image_url?: string;
  marks_awarded?: number;
  feedback?: string;
  is_correct?: boolean;
}

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  answers: Record<string, AssignmentAnswer>;
  score: number | null;
  percentage: number | null;
  feedback: string | null;
  submitted_at: string | null;
  graded_at: string | null;
  time_taken_seconds: number | null;
}

export const useAssignmentSubmission = (assignmentId: string | null) => {
  const { data: user } = useCurrentAuthUser();

  return useQuery({
    queryKey: ['assignment-submission', assignmentId, user?.id],
    queryFn: async (): Promise<AssignmentSubmission | null> => {
      if (!assignmentId || !user?.id) return null;

      const { data, error } = await supabase
        .from('assignment_submissions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .eq('student_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching assignment submission:', error);
        return null;
      }

      if (!data) return null;

      // Parse answers from JSON
      let parsedAnswers: Record<string, AssignmentAnswer> = {};
      if (data.answers && typeof data.answers === 'object' && !Array.isArray(data.answers)) {
        parsedAnswers = data.answers as unknown as Record<string, AssignmentAnswer>;
      }

      return {
        id: data.id,
        assignment_id: data.assignment_id || '',
        student_id: data.student_id || '',
        answers: parsedAnswers,
        score: data.score,
        percentage: data.percentage,
        feedback: data.feedback,
        submitted_at: data.submitted_at,
        graded_at: data.graded_at,
        time_taken_seconds: data.time_taken_seconds,
      };
    },
    enabled: !!assignmentId && !!user?.id,
  });
};

interface SubmitAssignmentParams {
  assignmentId: string;
  answers: Record<string, AssignmentAnswer>;
  score: number;
  percentage: number;
  feedback?: string;
  timeTakenSeconds?: number;
}

export const useSubmitAssignment = () => {
  const { data: user } = useCurrentAuthUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      assignmentId,
      answers,
      score,
      percentage,
      feedback,
      timeTakenSeconds,
    }: SubmitAssignmentParams) => {
      if (!user?.id) throw new Error('User not authenticated');

      // Check for existing submission
      const { data: existing } = await supabase
        .from('assignment_submissions')
        .select('id')
        .eq('assignment_id', assignmentId)
        .eq('student_id', user.id)
        .maybeSingle();

      const submissionData = {
        assignment_id: assignmentId,
        student_id: user.id,
        answers: JSON.parse(JSON.stringify(answers)),
        score,
        percentage,
        feedback: feedback || null,
        submitted_at: new Date().toISOString(),
        graded_at: new Date().toISOString(),
        time_taken_seconds: timeTakenSeconds || null,
      };

      if (existing) {
        const { data, error } = await supabase
          .from('assignment_submissions')
          .update(submissionData)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('assignment_submissions')
          .insert(submissionData)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      // Invalidate all assignment-related queries to refresh status
      queryClient.invalidateQueries({ queryKey: ['assignment-submission'] });
      queryClient.invalidateQueries({ queryKey: ['student-subject-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['student-assignments'] });
    },
    onError: (error: Error) => {
      console.error('Error submitting assignment:', error);
      toast({
        title: 'Submission Error',
        description: error.message || 'Failed to submit assignment',
        variant: 'destructive',
      });
    },
  });
};

export const useUploadAssignmentAnswerImage = () => {
  return useMutation({
    mutationFn: async ({
      file,
      assignmentId,
      questionId,
    }: {
      file: File;
      assignmentId: string;
      questionId: string;
    }) => {
      const fileExt = file.name.split('.').pop();
      const filePath = `assignments/${assignmentId}/${questionId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('student-answers')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('student-answers')
        .getPublicUrl(filePath);

      return publicUrl;
    },
    onError: (error: Error) => {
      console.error('Error uploading answer image:', error);
      toast({
        title: 'Upload Error',
        description: 'Failed to upload image',
        variant: 'destructive',
      });
    },
  });
};
