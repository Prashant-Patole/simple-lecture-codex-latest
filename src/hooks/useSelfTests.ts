import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SelfTest {
  id: string;
  student_id: string;
  course_id: string;
  subject_id: string;
  test_type: 'topic' | 'chapter';
  chapter_ids: string[];
  topic_ids: string[];
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  total_questions: number;
  mcq_count: number;
  written_count: number;
  submitted_at: string | null;
  mcq_score: number | null;
  percentage: number | null;
  status: string;
  created_at: string;
}

export interface SelfTestQuestion {
  id: string;
  self_test_id: string;
  question_id: string | null;
  chapter_id: string | null;
  topic_id: string | null;
  order_number: number;
  section: 'mcq' | 'written';
  question_text: string;
  options: any;
  correct_answer: string | null;
  marks: number;
}

export interface SelfTestAnswer {
  id: string;
  self_test_id: string;
  self_test_question_id: string;
  student_id: string;
  chapter_id: string | null;
  topic_id: string | null;
  selected_option: string | null;
  answer_text: string | null;
  answer_image_url: string | null;
  is_correct: boolean | null;
  marks_awarded: number | null;
  max_marks: number | null;
  ai_feedback: string | null;
  extracted_text: string | null;
  submitted_at: string;
}

export const useCreateSelfTest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      courseId: string;
      subjectId: string;
      testType: 'topic' | 'chapter';
      chapterIds: string[];
      topicIds: string[];
      title: string;
      scheduledAt: string;
      durationMinutes: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('create-self-test', { body: params });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { id: string; totalQuestions: number; mcqCount: number; writtenCount: number };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['self-tests'] });
      qc.invalidateQueries({ queryKey: ['study-sessions'] });
      toast.success(`Test scheduled with ${data.totalQuestions} questions. Reminders 24h & 1h before.`);
    },
    onError: (e: any) => toast.error(e.message || 'Failed to schedule test'),
  });
};

export type SelfTestWithLabels = SelfTest & { chapter_names: string[]; topic_names: string[] };

export const useSelfTests = () => {
  return useQuery({
    queryKey: ['self-tests'],
    queryFn: async (): Promise<SelfTestWithLabels[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from('self_tests' as any)
        .select('*')
        .eq('student_id', user.id)
        .order('scheduled_at', { ascending: false });
      if (error) throw error;
      const tests = (data || []) as unknown as SelfTest[];

      const chapterIds = Array.from(new Set(tests.flatMap((t) => t.chapter_ids || [])));
      const topicIds = Array.from(new Set(tests.flatMap((t) => t.topic_ids || [])));

      const [chaptersRes, topicsRes] = await Promise.all([
        chapterIds.length
          ? supabase.from('subject_chapters').select('id, title').in('id', chapterIds)
          : Promise.resolve({ data: [] as any[] } as any),
        topicIds.length
          ? supabase.from('subject_topics').select('id, title').in('id', topicIds)
          : Promise.resolve({ data: [] as any[] } as any),
      ]);

      const chapterMap = new Map<string, string>(
        ((chaptersRes as any).data || []).map((c: any) => [c.id, c.title]),
      );
      const topicMap = new Map<string, string>(
        ((topicsRes as any).data || []).map((t: any) => [t.id, t.title]),
      );

      return tests.map((t) => ({
        ...t,
        chapter_names: (t.chapter_ids || []).map((id) => chapterMap.get(id)).filter(Boolean) as string[],
        topic_names: (t.topic_ids || []).map((id) => topicMap.get(id)).filter(Boolean) as string[],
      }));
    },
  });
};

export const useSelfTest = (id: string | undefined) => {
  return useQuery({
    queryKey: ['self-test', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('self_tests' as any)
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as SelfTest | null;
    },
    enabled: !!id,
  });
};

export const useSelfTestQuestions = (id: string | undefined) => {
  return useQuery({
    queryKey: ['self-test-questions', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('self_test_questions' as any)
        .select('*')
        .eq('self_test_id', id)
        .order('order_number', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as SelfTestQuestion[];
    },
    enabled: !!id,
  });
};

export const useSelfTestAnswers = (id: string | undefined) => {
  return useQuery({
    queryKey: ['self-test-answers', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('self_test_answers' as any)
        .select('*')
        .eq('self_test_id', id);
      if (error) throw error;
      return (data || []) as unknown as SelfTestAnswer[];
    },
    enabled: !!id,
  });
};

export const useSubmitSelfTest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      selfTestId: string;
      questions: SelfTestQuestion[];
      answers: Record<string, { selected_option?: string; answer_text?: string; answer_image_url?: string }>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const norm = (s: string | null | undefined) => (s || '').toString().trim().toLowerCase();

      const writtenQs = params.questions.filter((q) => q.section !== 'mcq');
      if (writtenQs.length > 0) {
        toast.info(`Grading ${writtenQs.length} written answer${writtenQs.length > 1 ? 's' : ''} with AI…`);
      }

      let mcqCorrect = 0;
      let mcqMarks = 0;
      let writtenMarks = 0;
      let totalMaxMarks = 0;

      // Build rows with AI grading for written
      const rows: any[] = [];

      // Grade written in small parallel batches
      const writtenResults = new Map<string, { marks: number; isCorrect: boolean | null; feedback: string; extracted: string | null }>();
      const BATCH = 3;
      for (let i = 0; i < writtenQs.length; i += BATCH) {
        const batch = writtenQs.slice(i, i + BATCH);
        await Promise.all(batch.map(async (q) => {
          const ans = params.answers[q.id] || {};
          const maxMarks = Number(q.marks || 1);
          let studentAnswer = (ans.answer_text || '').trim();
          let extracted: string | null = null;

          // OCR image if needed
          if (!studentAnswer && ans.answer_image_url) {
            try {
              const { data: ex, error: exErr } = await supabase.functions.invoke('extract-answer-from-image', {
                body: { image_url: ans.answer_image_url, question_context: q.question_text },
              });
              if (!exErr) {
                extracted = (ex as any)?.extracted_text || null;
                if (extracted) studentAnswer = extracted;
              }
            } catch (e) {
              console.error('OCR failed', e);
            }
          }

          if (!studentAnswer) {
            writtenResults.set(q.id, { marks: 0, isCorrect: false, feedback: 'Not answered', extracted });
            return;
          }
          if (!q.correct_answer) {
            writtenResults.set(q.id, { marks: 0, isCorrect: null, feedback: 'No reference answer available', extracted });
            return;
          }

          try {
            const { data: ai, error: aiErr } = await supabase.functions.invoke('ai-check-answer', {
              body: {
                question_id: q.question_id || q.id,
                question_text: q.question_text,
                question_type: 'subjective',
                correct_answer: q.correct_answer,
                student_answer: studentAnswer,
                max_marks: maxMarks,
              },
            });
            if (aiErr) throw aiErr;
            const r = ai as any;
            writtenResults.set(q.id, {
              marks: Math.min(maxMarks, Number(r?.marks_awarded) || 0),
              isCorrect: !!r?.is_correct,
              feedback: r?.feedback || 'Evaluated',
              extracted,
            });
          } catch (e) {
            console.error('AI grading failed', e);
            writtenResults.set(q.id, { marks: 0, isCorrect: null, feedback: 'AI grading failed — will be reviewed', extracted });
          }
        }));
      }

      for (const q of params.questions) {
        const ans = params.answers[q.id] || {};
        const maxMarks = Number(q.marks || 1);
        totalMaxMarks += maxMarks;

        let isCorrect: boolean | null = null;
        let marksAwarded = 0;
        let aiFeedback: string | null = null;
        let extractedText: string | null = null;

        if (q.section === 'mcq') {
          if (q.correct_answer && ans.selected_option) {
            isCorrect = norm(ans.selected_option) === norm(q.correct_answer);
            if (isCorrect) {
              mcqCorrect++;
              marksAwarded = maxMarks;
              mcqMarks += maxMarks;
            }
          } else {
            isCorrect = false;
          }
        } else {
          const r = writtenResults.get(q.id);
          if (r) {
            marksAwarded = r.marks;
            isCorrect = r.isCorrect;
            aiFeedback = r.feedback;
            extractedText = r.extracted;
            writtenMarks += r.marks;
          }
        }

        rows.push({
          self_test_id: params.selfTestId,
          self_test_question_id: q.id,
          student_id: user.id,
          chapter_id: q.chapter_id,
          topic_id: q.topic_id,
          selected_option: ans.selected_option || null,
          answer_text: ans.answer_text || null,
          answer_image_url: ans.answer_image_url || null,
          is_correct: isCorrect,
          marks_awarded: marksAwarded,
          max_marks: maxMarks,
          ai_feedback: aiFeedback,
          extracted_text: extractedText,
        });
      }

      const { error: aErr } = await supabase
        .from('self_test_answers' as any)
        .upsert(rows, { onConflict: 'self_test_question_id,student_id' });
      if (aErr) throw aErr;

      const totalScore = mcqMarks + writtenMarks;
      const percentage = totalMaxMarks > 0 ? Math.round((totalScore / totalMaxMarks) * 100) : 0;

      const { error: uErr } = await supabase
        .from('self_tests' as any)
        .update({
          submitted_at: new Date().toISOString(),
          mcq_score: mcqCorrect,
          written_score: writtenMarks,
          total_score: totalScore,
          total_max_marks: totalMaxMarks,
          percentage,
          status: 'submitted',
        })
        .eq('id', params.selfTestId);
      if (uErr) throw uErr;

      return { percentage, totalScore, totalMaxMarks, mcqCorrect, writtenMarks };
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['self-tests'] });
      qc.invalidateQueries({ queryKey: ['self-test', vars.selfTestId] });
      qc.invalidateQueries({ queryKey: ['self-test-answers', vars.selfTestId] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to submit test'),
  });
};

export const useUploadSelfTestImage = () => {
  return useMutation({
    mutationFn: async ({ file, selfTestId, questionId }: { file: File; selfTestId: string; questionId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const ext = file.name.split('.').pop();
      const path = `${user.id}/self-tests/${selfTestId}/${questionId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('student-answers').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('student-answers').getPublicUrl(path);
      return publicUrl;
    },
    onError: (e: any) => toast.error('Image upload failed: ' + e.message),
  });
};
