import { useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { SEOHead } from '@/components/SEO';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Footer } from '@/components/Footer';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MathpixRenderer } from '@/components/admin/MathpixRenderer';

type PerQuestionAnswer = {
  student_answer?: string;
  image_url?: string | null;
  is_correct?: boolean;
  marks_awarded?: number;
  max_marks?: number;
  feedback?: string;
};

const formatTime = (seconds: number | null | undefined) => {
  if (!seconds || seconds <= 0) return 'N/A';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const normalize = (raw: unknown): PerQuestionAnswer => {
  if (raw && typeof raw === 'object') return raw as PerQuestionAnswer;
  if (typeof raw === 'string') return { student_answer: raw };
  return {};
};

const buildResultReturnPath = (result: any, answers: Record<string, unknown>) => {
  const courseId = result?.course_id || result?.test?.course_id || result?.course?.id;
  if (!courseId) return null;

  const params = new URLSearchParams();
  const subjectId = result?.subject_id || result?.test?.subject_id || result?.subject?.id;
  const topicId = result?.topic_id || result?.test?.topic_id;
  const chapterId = result?.chapter_id || result?.test?.chapter_id;

  if (subjectId) params.set('subject', subjectId);
  params.set('tab', 'my-results');
  if (topicId) params.set('topic', topicId);
  if (chapterId) params.set('chapter', chapterId);

  const embedded = Object.values(answers || {}).find((value: any) => value && typeof value === 'object') as any;
  if (!params.get('subject') && embedded?.subject_id) params.set('subject', embedded.subject_id);
  if (!params.get('topic') && embedded?.topic_id) params.set('topic', embedded.topic_id);
  if (!params.get('chapter') && embedded?.chapter_id) params.set('chapter', embedded.chapter_id);

  return `/learning/${courseId}?${params.toString()}`;
};

const isLearningResultsPath = (value?: string | null) => {
  if (!value) return false;
  try {
    const url = new URL(value, window.location.origin);
    return url.pathname.startsWith('/learning/') && url.searchParams.get('tab') === 'my-results';
  } catch {
    return false;
  }
};

const Inner = ({ resultId }: { resultId: string }) => {
  const navigate = useNavigate();
  const location = useLocation();


  const { data, isLoading, error } = useQuery({
    queryKey: ['practice-result-review', resultId],
    queryFn: async () => {
      const { data: result, error: rErr } = await supabase
        .from('test_results')
        .select('id, score, total_questions, percentage, time_taken_seconds, answers, submitted_at, test_type, grading_status, subject_id, topic_id, chapter_id, test:tests(subject_id, topic_id, chapter_id)')
        .eq('id', resultId)
        .maybeSingle();
      if (rErr) throw rErr;
      if (!result) throw new Error('Result not found');

      const answers = (result.answers || {}) as Record<string, unknown>;
      const questionIds = Object.keys(answers);
      let questions: any[] = [];
      if (questionIds.length > 0) {
        try {
          const { data: qData } = await supabase
            .from('questions')
            .select('id, question_text, question_image_url, question_format, question_type, options, correct_answer, explanation, marks, difficulty')
            .in('id', questionIds);
          questions = qData || [];
        } catch (e) {
          console.warn('[review] questions fetch failed, rendering answers only', e);
        }
      }

      return { result, questions, answers, questionIds };
    },
    retry: 1,
  });

  const returnPath = useMemo(() => {
    const stateFrom = (location.state as any)?.from as string | undefined;
    if (isLearningResultsPath(stateFrom)) return stateFrom;

    const storedFrom = sessionStorage.getItem('last-learning-results-path');
    if (isLearningResultsPath(storedFrom)) return storedFrom;

    if (data) return buildResultReturnPath(data.result, data.answers);
    return null;
  }, [location.state, data]);

  const goBack = () => {
    if (returnPath) {
      navigate(returnPath, { replace: true });
      return;
    }
    navigate('/my-courses', { replace: true });
  };


  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">
          Could not load this result. It may have been removed or you don't have access.
        </p>
        <Button variant="outline" className="mt-4" onClick={goBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </Card>
    );
  }

  const { result, questions, answers, questionIds } = data;
  const scorePct = Number(result.percentage) || 0;
  const questionMap = new Map<string, any>((questions || []).map((q: any) => [q.id, q]));
  // Fallback: if the question isn't in the questions table (e.g. assignments store
  // questions as JSONB), reconstruct it from the answer payload snapshot.
  const getQuestion = (qid: string) => {
    const q = questionMap.get(qid);
    if (q) return q;
    const a = (answers[qid] || {}) as any;
    if (!a || typeof a !== 'object') return {};
    return {
      id: qid,
      question_text: a.question_text || '',
      question_image_url: a.question_image_url || null,
      question_format: a.question_format || a.question_type || '',
      question_type: a.question_type || '',
      options: a.options || null,
      correct_answer: a.correct_answer || '',
      explanation: a.explanation || '',
      marks: a.max_marks ?? 1,
    };
  };
  const rawIds: string[] = (questionIds && questionIds.length > 0) ? questionIds : Object.keys(answers || {});
  const isMcq = (qid: string) => {
    const q = getQuestion(qid);
    if (!q) return false;
    const fmt = String(q.question_format || q.question_type || '').toLowerCase();
    if (fmt.includes('mcq') || fmt.includes('multiple')) return true;
    return !!(q.options && typeof q.options === 'object' && Object.keys(q.options).length > 0);
  };
  const orderedIds: string[] = [...rawIds].sort((a, b) => {
    const am = isMcq(a) ? 0 : 1;
    const bm = isMcq(b) ? 0 : 1;
    if (am !== bm) return am - bm;
    return rawIds.indexOf(a) - rawIds.indexOf(b);
  });

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={goBack} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-xl font-bold">Practice Review</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {format(new Date(result.submitted_at), 'MMM d, yyyy · p')}
                {result.grading_status === 'pending' && (
                  <Badge variant="outline" className="ml-2">AI review pending</Badge>
                )}
              </p>
              <p className="text-sm text-muted-foreground mt-2 flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {result.score}/{result.total_questions} correct
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatTime(result.time_taken_seconds)}
                </span>
              </p>
            </div>
            <div className="text-3xl font-bold text-primary">{scorePct}%</div>
          </div>
        </CardContent>
      </Card>

      {orderedIds.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No answer data was recorded for this attempt.
        </Card>
      ) : (
        <div className="space-y-3">
          {orderedIds.map((qid, i) => {
            const q = getQuestion(qid) || {};
            const a = normalize(answers[qid]);
            const qKey = qid;


            const correct = !!a.is_correct;
            const marks = a.max_marks ?? q.marks ?? 1;
            const awarded = a.marks_awarded ?? 0;
            const options = (q.options || null) as Record<string, unknown> | null;
            const studentKey = (a.student_answer || '').trim();
            return (
              <Card
                key={qKey}
                className={correct ? 'border-green-300 dark:border-green-700' : 'border-red-300 dark:border-red-700'}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-muted-foreground">Q{i + 1}</span>
                      {correct ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {awarded}/{marks} {marks === 1 ? 'mark' : 'marks'}
                    </Badge>
                  </div>

                  {q.question_image_url && (
                    <img src={q.question_image_url} alt="Question" className="max-w-full rounded border" />
                  )}

                  {q.question_text ? (
                    <div className="text-sm overflow-x-auto">
                      <MathpixRenderer mmdText={q.question_text} inline />
                    </div>
                  ) : (
                    <p className="text-xs italic text-muted-foreground">Question text unavailable.</p>
                  )}


                  {/* MCQ options */}
                  {options && typeof options === 'object' && Object.keys(options).length > 0 && (
                    <div className="space-y-2">
                      {Object.entries(options).map(([key, value]) => {
                        const isCorrectOption = (q.correct_answer || '').toLowerCase() === key.toLowerCase();
                        const isSelectedWrong = studentKey.toLowerCase() === key.toLowerCase() && !isCorrectOption;
                        const cls = isCorrectOption
                          ? 'bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700'
                          : isSelectedWrong
                          ? 'bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700'
                          : 'bg-muted/30';
                        const text =
                          typeof value === 'string'
                            ? value
                            : (value && typeof value === 'object' && 'text' in (value as any)
                                ? String((value as any).text || '')
                                : String(value ?? ''));
                        return (
                          <div key={key} className={`p-2 rounded border text-sm ${cls}`}>
                            <span className="font-medium mr-1">{key.toUpperCase()}.</span>
                            <MathpixRenderer mmdText={text} inline />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Student's typed / extracted answer (subjective) */}
                  {(!options || Object.keys(options).length === 0) && a.student_answer && (
                    <div className="text-sm bg-muted/40 p-3 rounded-lg">
                      <span className="font-semibold">Your answer: </span>
                      <MathpixRenderer mmdText={a.student_answer} inline />
                    </div>
                  )}

                  {a.image_url && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Your uploaded answer:</p>
                      <img src={a.image_url} alt="Your answer" className="max-h-56 rounded border" />
                    </div>
                  )}

                  {q.correct_answer && (
                    <div className="text-sm bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 rounded-lg">
                      <span className="font-semibold text-green-800 dark:text-green-300">Correct Answer: </span>
                      <MathpixRenderer mmdText={q.correct_answer} inline />
                    </div>
                  )}

                  {a.feedback && (
                    <p className="text-sm text-muted-foreground">{a.feedback}</p>
                  )}

                  {q.explanation && (
                    <div className="text-sm bg-muted/50 p-3 rounded-lg">
                      <span className="font-semibold">Explanation: </span>
                      <MathpixRenderer mmdText={q.explanation} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

const PracticeResultReview = () => {
  const { resultId } = useParams<{ resultId: string }>();
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate('/auth');
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading || !isAuthenticated || !resultId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isMobile) {
    return (
      <>
        <SEOHead title="Review | SimpleLecture" description="Review your practice submission." />
        <MobileLayout title="Review">
          <Inner resultId={resultId} />
        </MobileLayout>
      </>
    );
  }

  return (
    <>
      <SEOHead title="Review | SimpleLecture" description="Review your practice submission." />
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Inner resultId={resultId} />
        </div>
        <Footer />
      </div>
    </>
  );
};

export default PracticeResultReview;
