import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, ChevronLeft, ChevronRight, Clock, Upload, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { stripInlineOptions } from '@/lib/stripInlineOptions';
import { convertMathpixToStandard } from '@/components/learning/player/utils/latexNormalizer';
import { isBareFilename, resolveQuestionImageUrl } from '@/lib/imageResolver';

import { useAuth } from '@/contexts/AuthContext';
import {
  useSelfTest, useSelfTestQuestions, useSubmitSelfTest, useUploadSelfTestImage,
  SelfTestQuestion,
} from '@/hooks/useSelfTests';
import { getTier, getTierMessage } from '@/components/tests/PerformanceTierBanner';

type AnswerMap = Record<string, { selected_option?: string; answer_text?: string; answer_image_url?: string }>;

const formatTime = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    : `${m}:${String(ss).padStart(2, '0')}`;
};

const SilentResolvedImage = ({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!src) { setHasError(true); return; }
    if (isBareFilename(src)) {
      resolveQuestionImageUrl(src).then((url) => {
        if (!url) setHasError(true);
        else setResolvedUrl(url);
        setResolved(true);
      });
    } else {
      setResolvedUrl(src);
      setResolved(true);
    }
  }, [src]);

  if (hasError || !resolved || !resolvedUrl) return null;
  return (
    <img
      src={resolvedUrl}
      alt={alt || ''}
      className="max-w-full w-auto h-auto rounded-md my-2 block"
      onError={() => setHasError(true)}
      {...props}
    />
  );
};

const MathText = ({ text, className }: { text: string; className?: string }) => {
  const normalized = useMemo(() => convertMathpixToStandard(text || ''), [text]);
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
        components={{
          p: ({ children }) => <p className="whitespace-pre-wrap mb-2 last:mb-0">{children}</p>,
          img: ({ node, ...imgProps }: any) => <SilentResolvedImage {...imgProps} />,
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
};

const normalizeOptions = (opts: any): { key: string; text: string }[] => {
  if (!opts) return [];
  if (Array.isArray(opts)) {
    return opts.map((o: any, i: number) => ({
      key: String.fromCharCode(65 + i),
      text: typeof o === 'string' ? o : (o?.text ?? JSON.stringify(o)),
    }));
  }
  if (typeof opts === 'object') {
    return Object.entries(opts).map(([k, v]: [string, any]) => ({
      key: k,
      text: typeof v === 'string' ? v : (v?.text ?? JSON.stringify(v)),
    }));
  }
  return [];
};

const MyTestTake = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: test, isLoading: tLoading } = useSelfTest(id);
  const { data: questions = [], isLoading: qLoading } = useSelfTestQuestions(id);
  const submit = useSubmitSelfTest();
  const upload = useUploadSelfTestImage();

  const [answers, setAnswers] = useState<AnswerMap>({});
  const [idx, setIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/auth');
  }, [authLoading, isAuthenticated, navigate]);

  // Sorted: MCQ first, then written, preserving order_number
  const sorted = useMemo(() => {
    return [...questions].sort((a, b) => {
      if (a.section !== b.section) return a.section === 'mcq' ? -1 : 1;
      return a.order_number - b.order_number;
    });
  }, [questions]);

  // Timer
  useEffect(() => {
    if (!test) return;
    const end = new Date(test.scheduled_at).getTime() + test.duration_minutes * 60_000;
    const tick = () => setSecondsLeft(Math.floor((end - Date.now()) / 1000));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [test]);

  const doSubmit = async (auto = false) => {
    if (!id || !sorted.length || submittedRef.current) return;
    submittedRef.current = true;
    try {
      const res = await submit.mutateAsync({ selfTestId: id, questions: sorted, answers });
      const tier = getTier(res.percentage);
      const msg = getTierMessage(tier);
      toast[tier === 'good' ? 'success' : tier === 'average' ? 'info' : 'warning' as any](
        msg.title,
        { description: auto ? 'Time is up — answers auto-submitted.' : undefined }
      );
      navigate(`/my-tests/${id}/result`);
    } catch (e) {
      submittedRef.current = false;
    }
  };

  // Auto-submit when timer expires (use absolute end timestamp, not stale secondsLeft)
  useEffect(() => {
    if (!test || test.submitted_at || !sorted.length || submittedRef.current) return;
    const end = new Date(test.scheduled_at).getTime() + test.duration_minutes * 60_000;
    if (Date.now() >= end) {
      doSubmit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, test, sorted.length]);

  if (authLoading || tLoading || qLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!test) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Test not found.</div>;
  }

  // Block before window
  const start = new Date(test.scheduled_at).getTime();
  const end = start + test.duration_minutes * 60_000;
  const now = Date.now();
  if (test.submitted_at) {
    navigate(`/my-tests/${id}/result`, { replace: true });
    return null;
  }
  if (now < start) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="p-8 max-w-md text-center">
          <Clock className="h-10 w-10 text-primary mx-auto mb-3" />
          <p className="font-semibold mb-1">Exam hasn't started yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Come back at the scheduled time. We'll also email you 1 hour before.
          </p>
          <Button onClick={() => navigate('/my-tests')}>Back to My Tests</Button>
        </Card>
      </div>
    );
  }
  if (now > end) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="p-8 max-w-md text-center">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
          <p className="font-semibold mb-1">Test window has ended</p>
          <p className="text-sm text-muted-foreground mb-4">
            Unfortunately you can no longer attempt this test.
          </p>
          <Button onClick={() => navigate('/my-tests')}>Back to My Tests</Button>
        </Card>
      </div>
    );
  }

  const q = sorted[idx];
  if (!q) {
    return <div className="min-h-screen flex items-center justify-center">No questions in this test.</div>;
  }

  const mcqTotal = sorted.filter((x) => x.section === 'mcq').length;
  const sectionLabel = q.section === 'mcq' ? 'Section A — MCQ' : 'Section B — Written';
  const sectionIdx = q.section === 'mcq' ? idx + 1 : idx + 1 - mcqTotal;
  const sectionTotal = q.section === 'mcq' ? mcqTotal : sorted.length - mcqTotal;

  const ans = answers[q.id] || {};
  const setAns = (patch: Partial<AnswerMap[string]>) =>
    setAnswers((prev) => ({ ...prev, [q.id]: { ...prev[q.id], ...patch } }));

  const onUpload = async (file: File) => {
    if (!id) return;
    try {
      const url = await upload.mutateAsync({ file, selfTestId: id, questionId: q.id });
      setAns({ answer_image_url: url });
      toast.success('Image uploaded');
    } catch {}
  };

  const isLast = idx === sorted.length - 1;
  const opts = normalizeOptions(q.options);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Sticky exam header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="container max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{test.title}</p>
            <p className="text-xs text-muted-foreground">
              {sectionLabel} • Q {sectionIdx} of {sectionTotal}
            </p>
          </div>
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md font-mono text-sm font-semibold tabular-nums',
            secondsLeft < 60 ? 'bg-destructive text-destructive-foreground' :
            secondsLeft < 300 ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' :
            'bg-primary/10 text-primary',
          )}>
            <Clock className="h-4 w-4" />
            {formatTime(secondsLeft)}
          </div>
        </div>
        <Progress value={((idx + 1) / sorted.length) * 100} className="h-1 rounded-none" />
      </div>

      <div className="flex-1 container max-w-3xl mx-auto px-4 py-6 w-full">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline">{q.section === 'mcq' ? 'MCQ' : 'Written'}</Badge>
            <span className="text-xs text-muted-foreground">{q.marks} {q.marks === 1 ? 'mark' : 'marks'}</span>
          </div>
          <div className="text-base md:text-lg font-medium mb-6 flex gap-2">
            <span className="text-muted-foreground">Q{idx + 1}.</span>
            <MathText text={stripInlineOptions(q.question_text, q.section === 'mcq' && opts.length > 0)} className="flex-1" />
          </div>

          {q.section === 'mcq' ? (
            <RadioGroup
              value={ans.selected_option || ''}
              onValueChange={(v) => setAns({ selected_option: v })}
              className="space-y-2"
            >
              {opts.map((o) => (
                <Label
                  key={o.key}
                  className={cn(
                    'flex items-start gap-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/40 transition',
                    ans.selected_option === o.key && 'border-primary bg-primary/5',
                  )}
                >
                  <RadioGroupItem value={o.key} className="mt-0.5" />
                  <span className="flex-1 flex gap-2">
                    <span className="font-semibold">{o.key}.</span>
                    <MathText text={o.text} className="flex-1" />
                  </span>
                </Label>
              ))}
              {opts.length === 0 && (
                <p className="text-sm text-muted-foreground">No options available for this question.</p>
              )}
            </RadioGroup>
          ) : (
            <div className="space-y-3">
              <Textarea
                placeholder="Type your answer here..."
                rows={6}
                value={ans.answer_text || ''}
                onChange={(e) => setAns({ answer_text: e.target.value })}
              />
              <div className="flex items-center gap-3 flex-wrap">
                <label className="inline-flex">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onUpload(f);
                      e.target.value = '';
                    }}
                  />
                  <Button asChild variant="outline" size="sm" disabled={upload.isPending}>
                    <span>
                      {upload.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                      Upload Answer Image
                    </span>
                  </Button>
                </label>
                {ans.answer_image_url && (
                  <a href={ans.answer_image_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline">
                    <ImageIcon className="h-3 w-3" /> View uploaded image
                  </a>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Nav */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          {isLast ? (
            <Button
              onClick={() => doSubmit(false)}
              disabled={submit.isPending}
              className="bg-primary"
            >
              {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Test
            </Button>
          ) : (
            <Button onClick={() => setIdx((i) => Math.min(sorted.length - 1, i + 1))}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
        <p className="text-xs text-center text-muted-foreground mt-4">
          Answers are stored when you submit. Stay on this tab until you finish.
        </p>
      </div>
    </div>
  );
};

export default MyTestTake;
