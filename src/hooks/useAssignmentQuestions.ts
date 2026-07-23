import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentAuthUser } from './useCurrentAuthUser';

export interface AssignmentQuestion {
  id: string;
  question: string;
  type: 'mcq' | 'true_false' | 'short_answer' | 'long_answer' | 'application' | 'fill_blank' | 'diagram' | 'case_study' | 'real_world_application';
  options?: string[];
  correct_answer?: string;
  marks: number;
  explanation?: string;
  image_url?: string;
}

export interface AssignmentDetails {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  total_marks: number;
  passing_marks: number;
  duration_minutes: number | null;
  due_date: string | null;
  questions: AssignmentQuestion[];
  chapter_id: string | null;
  topic_id: string | null;
  subject_id: string | null;
}

export const useAssignmentQuestions = (assignmentId: string | null) => {
  return useQuery({
    queryKey: ['assignment-questions', assignmentId],
    queryFn: async (): Promise<AssignmentDetails | null> => {
      if (!assignmentId) return null;

      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('id', assignmentId)
        .single();

      if (error) {
        console.error('Error fetching assignment questions:', error);
        return null;
      }

      // Parse questions from JSONB
      const rawQuestions = data.questions as unknown[];
      const questions: AssignmentQuestion[] = Array.isArray(rawQuestions)
        ? rawQuestions.map((q: any, index: number) => ({
            id: q.id || `q_${index}`,
            question: q.question || q.text || '',
            type: q.type || 'short_answer',
            options: q.options || [],
            correct_answer: q.correct_answer || q.answer || '',
            marks: q.marks || 1,
            explanation: q.explanation || '',
            image_url: q.image_url || null,
          }))
        : [];

      return {
        id: data.id,
        title: data.title,
        description: data.description,
        instructions: data.instructions,
        total_marks: data.total_marks || questions.reduce((sum, q) => sum + q.marks, 0),
        passing_marks: data.passing_marks || 0,
        duration_minutes: data.duration_minutes,
        due_date: data.due_date,
        questions,
        chapter_id: data.chapter_id,
        topic_id: data.topic_id,
        subject_id: data.subject_id,
      };
    },
    enabled: !!assignmentId,
  });
};

export interface StudentAssignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  valid_until: string | null;
  total_marks: number;
  passing_marks: number;
  duration_minutes: number | null;
  chapter_id: string | null;
  topic_id: string | null;
  status: 'pending' | 'submitted' | 'graded';
  score: number | null;
  percentage: number | null;
  submitted_at: string | null;
  graded_at: string | null;
}

// Get all assignments for a subject (for student view) with submission status
export const useSubjectAssignmentsForStudent = (subjectId: string | null, chapterId?: string | null, topicId?: string | null) => {
  const { data: user } = useCurrentAuthUser();

  return useQuery({
    queryKey: ['student-subject-assignments', subjectId, chapterId, topicId, user?.id],
    queryFn: async (): Promise<StudentAssignment[]> => {
      if (!subjectId || !user?.id) return [];

      let query = supabase
        .from('assignments')
        .select(`
          id,
          title,
          description,
          due_date,
          valid_until,
          total_marks,
          passing_marks,
          duration_minutes,
          chapter_id,
          topic_id
        `)
        .eq('subject_id', subjectId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (chapterId) {
        query = query.eq('chapter_id', chapterId);
      }

      if (topicId) {
        query = query.eq('topic_id', topicId);
      }

      const { data: assignmentsData, error } = await query;

      if (error) {
        console.error('Error fetching student assignments:', error);
        return [];
      }

      if (!assignmentsData || assignmentsData.length === 0) return [];

      // Fetch submissions for these assignments
      const assignmentIds = assignmentsData.map(a => a.id);
      const { data: submissions, error: subError } = await supabase
        .from('assignment_submissions')
        .select('assignment_id, score, percentage, submitted_at, graded_at')
        .eq('student_id', user.id)
        .in('assignment_id', assignmentIds);

      if (subError) {
        console.error('Error fetching submissions:', subError);
      }

      // Create a map of submissions
      const submissionMap = new Map(
        (submissions || []).map(s => [s.assignment_id, s])
      );

      // Merge assignments with submission data
      return assignmentsData.map(assignment => {
        const submission = submissionMap.get(assignment.id);
        let status: 'pending' | 'submitted' | 'graded' = 'pending';
        
        if (submission) {
          status = submission.graded_at ? 'graded' : 'submitted';
        }

        return {
          id: assignment.id,
          title: assignment.title,
          description: assignment.description,
          due_date: assignment.due_date,
          valid_until: assignment.valid_until,
          total_marks: assignment.total_marks || 0,
          passing_marks: assignment.passing_marks || 0,
          duration_minutes: assignment.duration_minutes,
          chapter_id: assignment.chapter_id,
          topic_id: assignment.topic_id,
          status,
          score: submission?.score ?? null,
          percentage: submission?.percentage ?? null,
          submitted_at: submission?.submitted_at ?? null,
          graded_at: submission?.graded_at ?? null,
        };
      });
    },
    enabled: !!subjectId && !!user?.id,
  });
};
