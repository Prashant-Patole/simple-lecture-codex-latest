import { useMemo, useState } from 'react';
import { useAllQuestions } from '@/hooks/useAllQuestions';
import { useAskAIJobs } from '@/hooks/useAskAIJobs';
import { SUPABASE_DIRECT_URL } from '@/lib/supabaseUrl';

const CPU_BASE = 'http://116.202.230.124:8000';
const AI_PROXY_URL = `${SUPABASE_DIRECT_URL}/functions/v1/ai-teaching-proxy`;
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Sparkles, CheckCircle2, Loader2, PlayCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { convertMathpixToStandard } from '@/components/learning/player/utils/latexNormalizer';

const MathText = ({ children }: { children?: string | null }) => {
  if (children == null || children === '') return null;
  const normalized = convertMathpixToStandard(String(children));
  return (
    <span className="math-inline [&>p]:inline [&>p]:m-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{ p: ({ children }) => <span>{children}</span> }}
      >
        {normalized}
      </ReactMarkdown>
    </span>
  );
};

interface Props {
  topicId?: string;
  chapterId?: string;
  subjectId?: string;
  subjectName?: string;
  onOpenInAITab?: (questionText: string, cachedResponse: any) => void;
}


export function SolutionsTab({ topicId, chapterId, subjectId, subjectName, onOpenInAITab }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [responseMap, setResponseMap] = useState<Map<string, any>>(new Map());

  const { data: questions = [], isLoading: qLoading } = useAllQuestions(
    topicId,
    chapterId,
    !topicId && !!chapterId,
  );

  const { data: pregenJobs = [] } = useAskAIJobs({
    subjectId: subjectId || '',
    topicId,
    chapterId,
    status: 'ready',
  });

  const pregenMap = useMemo(() => {
    const m = new Map<string, any>();
    pregenJobs.forEach((j) => {
      if (j.is_pregen_done && j.question_id) m.set(j.question_id, j);
    });
    return m;
  }, [pregenJobs]);

  const handleWatch = async (q: any) => {
    if (!onOpenInAITab) return;
    const cached = responseMap.get(q.id);
    if (cached) {
      onOpenInAITab(q.question_text, cached);
      return;
    }
    setLoadingId(q.id);
    try {
      const url = `${AI_PROXY_URL}?path=${encodeURIComponent('/ai-teaching-assistant')}&base=${encodeURIComponent(CPU_BASE)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'full',
          question: q.question_text,
          subjectId,
          subjectName,
          language: 'en-US',
        }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
      const data = text ? JSON.parse(text) : null;
      setResponseMap((prev) => new Map(prev).set(q.id, data));
      onOpenInAITab(q.question_text, data);
    } catch (e) {
      console.error('[SolutionsTab] Watch fetch failed', e);
    } finally {
      setLoadingId(null);
    }
  };

  if (qLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (questions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No questions available for this topic yet.
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <h2 className="font-semibold text-lg">Solutions</h2>
      {questions.map((q: any, i: number) => {
        const hasPregen = pregenMap.has(q.id);
        const isExpanded = expandedId === q.id;
        const isLoading = loadingId === q.id;
        const options = (q.options ?? {}) as Record<string, any>;
        const optionKeys = Object.keys(options);
        const presentation = responseMap.get(q.id);
        const slides =
          presentation?.presentationSlides ?? presentation?.presentation_slides ?? [];

        return (
          <div
            key={q.id}
            className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
          >
            <button
              className="w-full text-left p-4 flex items-start gap-3"
              onClick={() => setExpandedId(isExpanded ? null : q.id)}
            >
              <span className="mt-0.5 font-semibold text-muted-foreground text-sm min-w-[24px]">
                {i + 1}.
              </span>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium"><MathText>{q.question_text}</MathText></p>
                <div className="flex items-center gap-2 flex-wrap">
                  {q.difficulty && (
                    <Badge variant="outline" className="text-xs">
                      {q.difficulty}
                    </Badge>
                  )}
                  {q.marks && (
                    <Badge variant="outline" className="text-xs">
                      {q.marks} marks
                    </Badge>
                  )}
                  {hasPregen && onOpenInAITab && (
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWatch(q);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 transition-colors cursor-pointer border border-emerald-500/30 disabled:opacity-60"
                    >
                      {isLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <PlayCircle className="h-3 w-3" />
                      )}
                      {isLoading ? 'Loading…' : 'Watch Answer'}
                    </button>
                  )}
                </div>
              </div>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 shrink-0 mt-1" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0 mt-1" />
              )}
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
                {optionKeys.length > 0 && (
                  <div className="space-y-1.5">
                    {optionKeys.map((key) => {
                      const isCorrect =
                        q.correct_answer?.toString().toLowerCase() === key.toLowerCase();
                      return (
                        <div
                          key={key}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border ${
                            isCorrect
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-medium'
                              : 'border-border bg-muted/30'
                          }`}
                        >
                          {isCorrect && (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          )}
                          <span className="font-medium uppercase mr-1">{key})</span>
                          <MathText>
                            {typeof options[key] === 'string'
                              ? options[key]
                              : options[key]?.text ?? ''}
                          </MathText>
                        </div>
                      );
                    })}
                  </div>
                )}

                {optionKeys.length === 0 && q.correct_answer && (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">
                    <span className="font-semibold">Answer: </span>
                    <MathText>{q.correct_answer}</MathText>
                  </div>
                )}

                {q.explanation && (
                  <div className="rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">Explanation: </span>
                    <MathText>{q.explanation}</MathText>
                  </div>
                )}

                {slides.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-semibold text-primary flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> AI Presentation ({slides.length} slides)
                    </p>
                    {slides.map((slide: any, si: number) => {
                      const manimUrl =
                        slide.manim_video_url ||
                        slide.manimVideoUrl ||
                        presentation?.manimVideoUrls?.[si] ||
                        presentation?.manimVideoUrls?.[String(si)];
                      return (
                      <div
                        key={si}
                        className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1"
                      >
                        <p className="text-sm font-semibold"><MathText>{slide.title}</MathText></p>
                        {slide.narration && (
                          <p className="text-xs text-muted-foreground"><MathText>{slide.narration}</MathText></p>
                        )}
                        {Array.isArray(slide.key_points || slide.keyPoints) && (
                          <ul className="list-disc pl-4 text-xs space-y-0.5 text-muted-foreground">
                            {(slide.key_points || slide.keyPoints).map(
                              (kp: string, ki: number) => (
                                <li key={ki}><MathText>{kp}</MathText></li>
                              ),
                            )}
                          </ul>
                        )}
                        {manimUrl && (
                          <video
                            src={manimUrl}
                            controls
                            playsInline
                            preload="metadata"
                            className="rounded-md w-full max-h-64 mx-auto bg-black object-contain mt-1"
                          />
                        )}
                        {(slide.infographicUrl || slide.infographic_url) && (
                          <img
                            src={slide.infographicUrl || slide.infographic_url}
                            alt={slide.title}
                            className="rounded-md max-h-48 mx-auto mt-1"
                          />
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default SolutionsTab;
