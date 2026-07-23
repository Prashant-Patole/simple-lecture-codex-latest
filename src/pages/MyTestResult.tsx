import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Loader2, ArrowLeft, BookOpen, Target, CheckCircle2, XCircle, Clock, Sparkles } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { SEOHead } from '@/components/SEO';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Footer } from '@/components/Footer';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

import { useSelfTest, useSelfTestQuestions, useSelfTestAnswers } from '@/hooks/useSelfTests';

// Strip unresolvable OCR image markdown like ![alt](xxxx_IMG.JPG) where URL is not http(s).
const cleanOcrText = (s: string | null | undefined): string => {
  if (!s) return '';
  return s
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt: string, url: string) => {
      if (/^https?:\/\//i.test(url)) return `![${alt}](${url})`;
      return '';
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
import { PerformanceTierBanner, getTier } from '@/components/tests/PerformanceTierBanner';

const Inner = ({ id }: { id: string }) => {
  const { data: test, isLoading: tL } = useSelfTest(id);
  const { data: questions = [], isLoading: qL } = useSelfTestQuestions(id);
  const { data: answers = [], isLoading: aL } = useSelfTestAnswers(id);
  const queryClient = useQueryClient();
  const [regrading, setRegrading] = useState(false);

  const handleRegrade = async () => {
    setRegrading(true);
    try {
      const { data, error } = await supabase.functions.invoke('regrade-self-test', {
        body: { self_test_id: id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Re-evaluation complete');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['self-test', id] }),
        queryClient.invalidateQueries({ queryKey: ['self-test-answers', id] }),
      ]);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to re-evaluate');
    } finally {
      setRegrading(false);
    }
  };

  const chapterIds = useMemo(() => Array.from(new Set(questions.map((q: any) => q.chapter_id).filter(Boolean))) as string[], [questions]);
  const topicIds = useMemo(() => Array.from(new Set(questions.map((q: any) => q.topic_id).filter(Boolean))) as string[], [questions]);

  const { data: chapterRows = [] } = useQuery({
    queryKey: ['self-test-chapter-names', chapterIds],
    enabled: chapterIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('subject_chapters').select('id, title').in('id', chapterIds);
      if (error) throw error;
      return data || [];
    },
  });
  const { data: topicRows = [] } = useQuery({
    queryKey: ['self-test-topic-names', topicIds],
    enabled: topicIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('subject_topics').select('id, title').in('id', topicIds);
      if (error) throw error;
      return data || [];
    },
  });
  const chapterNameMap = useMemo(() => new Map((chapterRows as any[]).map((r) => [r.id, r.title])), [chapterRows]);
  const topicNameMap = useMemo(() => new Map((topicRows as any[]).map((r) => [r.id, r.title])), [topicRows]);

  const breakdown = useMemo(() => {
    if (!questions.length) return { byTopic: [], byChapter: [], weakTopics: [] as any[], writtenFeedback: [] as any[] };
    const ansBy: Record<string, any> = {};
    answers.forEach((a) => { ansBy[a.self_test_question_id] = a; });

    const topicMap = new Map<string, { topic_id: string; total: number; earned: number; max: number }>();
    const chapterMap = new Map<string, { chapter_id: string; total: number; earned: number; max: number }>();

    questions.forEach((q) => {
      const a = ansBy[q.id];
      const maxM = Number(a?.max_marks ?? q.marks ?? 1);
      const earnedM = Number(a?.marks_awarded ?? (a?.is_correct ? maxM : 0));
      if (q.topic_id) {
        const t = topicMap.get(q.topic_id) || { topic_id: q.topic_id, total: 0, earned: 0, max: 0 };
        t.total++; t.earned += earnedM; t.max += maxM;
        topicMap.set(q.topic_id, t);
      }
      if (q.chapter_id) {
        const c = chapterMap.get(q.chapter_id) || { chapter_id: q.chapter_id, total: 0, earned: 0, max: 0 };
        c.total++; c.earned += earnedM; c.max += maxM;
        chapterMap.set(q.chapter_id, c);
      }
    });

    const byTopic = Array.from(topicMap.values()).map((t) => ({
      ...t, accuracy: t.max > 0 ? Math.round((t.earned / t.max) * 100) : null,
    }));
    const byChapter = Array.from(chapterMap.values()).map((c) => ({
      ...c, accuracy: c.max > 0 ? Math.round((c.earned / c.max) * 100) : null,
    }));
    const weakTopics = byTopic.filter((t) => t.accuracy !== null && t.accuracy < 50);

    const writtenFeedback = questions
      .filter((q) => q.section === 'written')
      .map((q) => {
        const a = ansBy[q.id];
        return {
          id: q.id,
          question_text: q.question_text,
          marks_awarded: Number(a?.marks_awarded ?? 0),
          max_marks: Number(a?.max_marks ?? q.marks ?? 1),
          feedback: a?.ai_feedback || null,
          extracted_text: a?.extracted_text || null,
          answer_text: a?.answer_text || null,
          answer_image_url: a?.answer_image_url || null,
          correct_answer: q.correct_answer || null,
        };
      });

    return { byTopic, byChapter, weakTopics, writtenFeedback };
  }, [questions, answers]);

  if (tL || qL || aL) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!test) return <p className="text-center text-muted-foreground py-12">Test not found.</p>;
  if (!test.submitted_at) {
    return (
      <Card className="p-6 text-center">
        <Clock className="h-8 w-8 mx-auto text-primary mb-2" />
        <p className="font-semibold">You haven't submitted this test yet.</p>
        <Button asChild className="mt-3"><Link to={`/my-tests/${id}/take`}>Go to Test</Link></Button>
      </Card>
    );
  }

  const pct = test.percentage ?? 0;
  const tier = getTier(pct);
  

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/my-tests"><ArrowLeft className="h-4 w-4 mr-1" /> Back to My Tests</Link>
      </Button>

      <Card className="p-5">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-xl font-bold">{test.title}</h2>
          <Badge variant="outline" className="capitalize">{test.test_type} test</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {test.mcq_count} MCQ • {test.written_count} written • Written answers are auto-graded by AI.
        </p>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" disabled={regrading} onClick={handleRegrade}>
            {regrading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
            {regrading ? 'Re-evaluating…' : 'Re-evaluate with AI'}
          </Button>
          <span className="text-xs text-muted-foreground">Use this if your written answers weren't graded.</span>
        </div>
      </Card>

      <PerformanceTierBanner percentage={pct} />

      {/* Suggested actions per tier */}
      <Card className="p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Next steps</h3>
        <ul className="space-y-2 text-sm">
          {tier === 'weak' && (
            <>
              <li className="flex gap-2"><BookOpen className="h-4 w-4 mt-0.5 text-primary shrink-0" /> Re-watch the lectures for the chapters in this test.</li>
              <li className="flex gap-2"><Target className="h-4 w-4 mt-0.5 text-primary shrink-0" /> Solve daily practice (DPP) questions on the weak topics below.</li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" /> Reschedule this test in 3–5 days and aim for at least 50%.</li>
            </>
          )}
          {tier === 'average' && (
            <>
              <li className="flex gap-2"><Target className="h-4 w-4 mt-0.5 text-primary shrink-0" /> Solve more practice questions — especially on the weak topics listed.</li>
              <li className="flex gap-2"><BookOpen className="h-4 w-4 mt-0.5 text-primary shrink-0" /> Quickly revisit the chapter summaries for the topics you got wrong.</li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" /> Retake a similar test — you can easily cross 75% with a bit more focus!</li>
            </>
          )}
          {tier === 'good' && (
            <>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 shrink-0" /> Excellent! Maintain this with weekly practice tests.</li>
              <li className="flex gap-2"><Target className="h-4 w-4 mt-0.5 text-green-600 shrink-0" /> Try a harder chapter test next, or aim for a perfect score on this one.</li>
            </>
          )}
        </ul>
      </Card>

      {breakdown.weakTopics.length > 0 && (
        <Card className="p-5 border-amber-500/40 bg-amber-500/5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <XCircle className="h-4 w-4 text-amber-600" /> Topics to improve
          </h3>
          <div className="space-y-2">
            {breakdown.weakTopics.map((t) => (
              <div key={t.topic_id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{topicNameMap.get(t.topic_id) || 'Topic'}</span>
                <Badge variant="destructive">{t.accuracy}%</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {breakdown.byChapter.length > 0 && (
        <Card className="p-5">
          <h3 className="font-semibold mb-3">Performance by chapter</h3>
          <div className="space-y-3">
            {breakdown.byChapter.map((c) => (
              <div key={c.chapter_id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="truncate opacity-80">{chapterNameMap.get(c.chapter_id) || 'Chapter'}</span>
                  <span className="font-medium">{c.accuracy ?? '—'}{c.accuracy !== null ? '%' : ''} <span className="text-xs text-muted-foreground">({c.earned}/{c.max} marks)</span></span>
                </div>
                <Progress value={c.accuracy ?? 0} className="h-2" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {breakdown.writtenFeedback.length > 0 && (
        <Card className="p-5">
          <h3 className="font-semibold mb-3">Written answers — AI evaluation</h3>
          <div className="space-y-4">
            {breakdown.writtenFeedback.map((w, idx) => {
              const pass = w.max_marks > 0 && w.marks_awarded / w.max_marks >= 0.5;
              return (
                <div key={w.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium line-clamp-3 flex-1 whitespace-pre-wrap">Q{idx + 1}. {cleanOcrText(w.question_text)}</p>
                    <Badge variant={pass ? 'default' : 'destructive'} className="shrink-0">
                      {w.marks_awarded}/{w.max_marks}
                    </Badge>
                  </div>
                  {w.feedback && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Feedback:</span> {w.feedback}
                    </p>
                  )}
                  {(w.extracted_text || w.answer_text) && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        View your answer{w.extracted_text ? ' (extracted from image)' : ''}
                      </summary>
                      <p className="mt-1 whitespace-pre-wrap opacity-80">{cleanOcrText(w.extracted_text || w.answer_text)}</p>
                    </details>
                  )}
                  {w.answer_image_url && (
                    <a href={w.answer_image_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                      View uploaded image
                    </a>
                  )}
                  {w.correct_answer && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-green-700 dark:text-green-400 hover:underline font-medium">
                        View correct answer
                      </summary>
                      <p className="mt-1 whitespace-pre-wrap opacity-90 p-2 rounded bg-green-500/5 border border-green-500/20">{cleanOcrText(w.correct_answer)}</p>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};

const MyTestResult = () => {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate('/auth');
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading || !id) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (isMobile) {
    return (
      <>
        <SEOHead title="Test Result | SimpleLecture" description="Your test result" />
        <MobileLayout title="Test Result"><Inner id={id} /></MobileLayout>
      </>
    );
  }

  return (
    <>
      <SEOHead title="Test Result | SimpleLecture" description="Your scheduled test result" />
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <Inner id={id} />
        </div>
        <Footer />
      </div>
    </>
  );
};

export default MyTestResult;
