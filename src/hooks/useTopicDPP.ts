import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, differenceInDays, subDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export interface DPPQuestion {
  id: number;
  originalId: string; // Database UUID for tracking
  question: string;
  options: { id: string; text: string }[];
  correctAnswer: string;
  explanation: string;
  difficulty: string;
}

export interface DPPSubmission {
  id: string;
  student_id: string;
  topic_id: string;
  test_date: string;
  dpp_type: 'teacher' | 'ai_generated' | 'database';
  questions: DPPQuestion[];
  answers: Record<number, string>;
  score: number;
  total_questions: number;
  time_taken_seconds: number;
  submitted_at: string;
}

// Calculate streak from submission history
const calculateStreak = (submissions: { test_date: string }[]): number => {
  if (!submissions || submissions.length === 0) return 0;
  
  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const dates = [...new Set(submissions.map(s => s.test_date))].sort().reverse();
  
  // If no submission today or yesterday, streak is 0
  if (dates[0] !== today && dates[0] !== yesterday) return 0;
  
  let streak = 1;
  for (let i = 0; i < dates.length - 1; i++) {
    const current = parseISO(dates[i]);
    const next = parseISO(dates[i + 1]);
    const diffDays = differenceInDays(current, next);
    
    if (diffDays === 1) streak++;
    else break;
  }
  return streak;
};

// Shuffle and select random questions
const shuffleAndSelect = <T,>(array: T[], count: number): T[] => {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

export const useTopicDPP = (topicId: string | undefined, chapterId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check today's submission
  const { data: todaySubmission, isLoading: isLoadingSubmission } = useQuery({
    queryKey: ['topic-dpp-submission', topicId],
    queryFn: async () => {
      return null; // Allow unlimited attempts for testing
    },
    enabled: !!topicId
  });

  // Fetch submission history
  const { data: submissionHistory } = useQuery({
    queryKey: ['dpp-submission-history', topicId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('dpp_topic_submissions')
        .select('test_date, score, total_questions, time_taken_seconds, submitted_at')
        .eq('student_id', user.id)
        .eq('topic_id', topicId!)
        .order('test_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!topicId
  });

  // Check if DPP questions are available in database
  const { data: dppQuestionsCount } = useQuery({
    queryKey: ['dpp-questions-count', topicId, chapterId],
    queryFn: async () => {
      // First try topic-level questions (only count those with valid correct_answer)
      if (topicId) {
        const { count } = await supabase
          .from('dpp_questions')
          .select('*', { count: 'exact', head: true })
          .eq('topic_id', topicId)
          .eq('is_active', true)
          .neq('correct_answer', '')
          .not('correct_answer', 'is', null);
        
        if (count && count > 0) return { count, source: 'topic' as const };
      }
      
      // Then try chapter-level questions
      if (chapterId) {
        const { count } = await supabase
          .from('dpp_questions')
          .select('*', { count: 'exact', head: true })
          .eq('chapter_id', chapterId)
          .eq('is_active', true)
          .neq('correct_answer', '')
          .not('correct_answer', 'is', null);
        
        if (count && count > 0) return { count, source: 'chapter' as const };
      }
      
      return { count: 0, source: null };
    },
    enabled: !!topicId || !!chapterId
  });

  const streak = calculateStreak(submissionHistory || []);
  const completedDates = (submissionHistory || []).map(s => parseISO(s.test_date));
  
  const getSubmissionByDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return submissionHistory?.find(s => s.test_date === dateStr) || null;
  };

  // Fetch DPP questions from database (excluding already attempted)
  const fetchDPPQuestions = useMutation({
    mutationFn: async (): Promise<{ questions: DPPQuestion[] }> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get already attempted question IDs for this topic
      const { data: attemptedData } = await supabase
        .from('dpp_attempted_questions')
        .select('question_id')
        .eq('student_id', user.id)
        .eq('topic_id', topicId!);

      const attemptedIds = (attemptedData || []).map(a => a.question_id);

      // Helper to fetch and select questions (only those with valid correct_answer)
      const fetchQuestions = async (filterColumn: 'topic_id' | 'chapter_id', filterId: string) => {
        // First try to get unattempted questions with valid answers
        let query = supabase
          .from('dpp_questions')
          .select('*')
          .eq('is_active', true)
          .eq(filterColumn, filterId)
          .neq('correct_answer', '')
          .not('correct_answer', 'is', null);

        if (attemptedIds.length > 0) {
          query = query.not('id', 'in', `(${attemptedIds.join(',')})`);
        }

        const { data: unattemptedQuestions } = await query.limit(50);

        if (unattemptedQuestions && unattemptedQuestions.length >= 10) {
          // Enough new questions
          return shuffleAndSelect(unattemptedQuestions, 10);
        } else if (unattemptedQuestions && unattemptedQuestions.length > 0) {
          // Some new + fill with previously attempted
          const selected = [...unattemptedQuestions];
          const needed = 10 - selected.length;

          if (attemptedIds.length > 0) {
            const { data: oldQuestions } = await supabase
              .from('dpp_questions')
              .select('*')
              .eq('is_active', true)
              .eq(filterColumn, filterId)
              .neq('correct_answer', '')
              .not('correct_answer', 'is', null)
              .in('id', attemptedIds)
              .limit(needed * 2);

            if (oldQuestions) {
              selected.push(...shuffleAndSelect(oldQuestions, needed));
            }
          }
          return selected;
        } else if (attemptedIds.length > 0) {
          // All questions attempted - allow repeats (still require valid answers)
          const { data: allQuestions } = await supabase
            .from('dpp_questions')
            .select('*')
            .eq('is_active', true)
            .eq(filterColumn, filterId)
            .neq('correct_answer', '')
            .not('correct_answer', 'is', null)
            .limit(50);

          return shuffleAndSelect(allQuestions || [], 10);
        }
        return [];
      };

      // First try topic-level
      if (topicId) {
        const questions = await fetchQuestions('topic_id', topicId);
        if (questions.length >= 5) {
          return { questions: formatQuestionsFromDB(questions) };
        }
      }

      // Then try chapter-level
      if (chapterId) {
        const questions = await fetchQuestions('chapter_id', chapterId);
        if (questions.length >= 5) {
          return { questions: formatQuestionsFromDB(questions) };
        }
      }

      throw new Error('No DPP questions available for this topic. Please ask your teacher to upload DPP documents.');
    },
    onError: (error: Error) => {
      toast({
        title: "No DPP Available",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Submit DPP answers
  const submitDPP = useMutation({
    mutationFn: async ({ 
      questions, 
      answers, 
      score, 
      timeSeconds 
    }: { 
      questions: DPPQuestion[]; 
      answers: Record<number, string>; 
      score: number; 
      timeSeconds: number;
    }) => {
      if (!topicId) throw new Error('Topic ID is required');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const today = format(new Date(), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('dpp_topic_submissions')
        .upsert({
          student_id: user.id,
          topic_id: topicId,
          test_date: today,
          dpp_type: 'teacher',
          questions: questions as any,
          answers: answers as any,
          score,
          total_questions: questions.length,
          time_taken_seconds: timeSeconds,
          submitted_at: new Date().toISOString()
        }, {
          onConflict: 'student_id,topic_id,test_date'
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error submitting DPP:', error);
        throw new Error(error.message || 'Failed to submit DPP');
      }

      // Track attempted questions to avoid repeating
      const attemptedRecords = questions
        .filter(q => q.originalId) // Only track questions with DB IDs
        .map(q => ({
          student_id: user.id,
          question_id: q.originalId,
          topic_id: topicId,
          was_correct: answers[q.id]?.toLowerCase() === q.correctAnswer?.toLowerCase()
        }));

      if (attemptedRecords.length > 0) {
        await supabase
          .from('dpp_attempted_questions')
          .upsert(attemptedRecords, { onConflict: 'student_id,question_id' });
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topic-dpp-submission', topicId] });
      queryClient.invalidateQueries({ queryKey: ['dpp-submission-history', topicId] });
      toast({
        title: "DPP Submitted!",
        description: "Your answers have been saved successfully."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to submit DPP",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  return {
    todaySubmission,
    isLoadingSubmission,
    isCompleted: !!todaySubmission,
    fetchDPPQuestions,
    submitDPP,
    streak,
    completedDates,
    submissionHistory: submissionHistory || [],
    getSubmissionByDate,
    hasDPPQuestions: (dppQuestionsCount?.count || 0) > 0,
    dppQuestionsSource: dppQuestionsCount?.source || null,
  };
};

// Helper to format DB questions to expected format
function formatQuestionsFromDB(dbQuestions: any[]): DPPQuestion[] {
  return dbQuestions.map((q, index) => {
    // Handle options - DB stores as {a: "text", b: "text", ...} but we need [{id, text}]
    let formattedOptions: { id: string; text: string }[] = [];
    
    if (Array.isArray(q.options)) {
      // Already in array format
      formattedOptions = q.options;
    } else if (q.options && typeof q.options === 'object') {
      // Convert object format {a: "text", b: "text"} to array format
      formattedOptions = Object.entries(q.options).map(([key, value]) => ({
        id: key,
        text: String(value),
      }));
    }
    
    return {
      id: index + 1,
      originalId: q.id, // Store DB UUID for tracking
      question: q.question_text,
      options: formattedOptions,
      correctAnswer: q.correct_answer?.toLowerCase() || '',
      explanation: q.explanation || '',
      difficulty: q.difficulty || 'medium',
    };
  });
}
