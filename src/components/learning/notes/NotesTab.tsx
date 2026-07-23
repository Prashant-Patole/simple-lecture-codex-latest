import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  BookOpen,
  ChevronDown,
  Sparkles,
  FileQuestion,
  Loader2,
  Star,
} from "lucide-react";
import { useTopicNotes, type NotesSection, type TopicNotesQuestion } from "@/hooks/useTopicNotes";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { isBookPilot } from "@/lib/notesBookPilot";
import { NotesBookReader } from "./NotesBookReader";
import { toDisplayString, normalizeOptions } from "@/lib/toDisplayString";


interface NotesTabProps {
  topicId: string;
  chapterId?: string | null;
  subjectId?: string | null;
  topicTitle?: string;
}

const stripSpeechTokens = (t: string) =>
  (t || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

const stripInlineMcqOptions = (text: string, hasOptions: boolean): string => {
  if (!hasOptions) return text;
  return (text || "").replace(
    /\s*(?:[-–—]\s*)?(?:\([aA]\)|[aA][.)])\s+[\s\S]*?(?=(?:[-–—]\s*)?(?:\([bB]\)|[bB][.)])\s+)[\s\S]*$/u,
    ""
  ).trim();
};

const asArray = (v: any): string[] =>
  Array.isArray(v) ? v.map(String) : v ? [String(v)] : [];

export const NotesTab = ({ topicId, chapterId, subjectId, topicTitle }: NotesTabProps) => {
  const { data, isLoading, error } = useTopicNotes(topicId);
  const queryClient = useQueryClient();
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  // Pilot: render the book-style reader only for whitelisted topics.
  // Kept after hooks so hook order stays stable.
  if (isBookPilot(topicId)) {
    return <NotesBookReader topicId={topicId} topicTitle={topicTitle} />;
  }

  const sections = data?.sections || [];

  const handleGenerateQuestions = async (section: NotesSection) => {
    setGeneratingFor(section.section_id);
    try {
      const { data: res, error: fnErr } = await supabase.functions.invoke(
        "generate-topic-notes-questions",
        {
          body: {
            topic_id: topicId,
            chapter_id: chapterId,
            subject_id: subjectId,
            section_id: section.section_id,
            section_title: section.title,
            section_text:
              section.narration?.full_text ||
              (section.narration?.segments || []).map((s) => s.text).join(" "),
            key_points: (section.visual_beats || [])
              .flatMap((b) => asArray(b.display_text))
              .slice(0, 20),
            count: 5,
          },
        }
      );
      if (fnErr) throw fnErr;
      toast({
        title: "Practice questions ready",
        description: `${res?.inserted ?? 0} questions added to the Question Bank.`,
      });
      await queryClient.invalidateQueries({ queryKey: ["topic-notes", topicId] });
    } catch (err: any) {
      console.error("[NotesTab] generate questions failed", err);
      toast({
        title: "Couldn't generate questions",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingFor(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Couldn't load notes. Please try again.
        </CardContent>
      </Card>
    );
  }

  if (!data?.hasPublishedLecture || sections.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-2">
          <BookOpen className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium">Notes not available yet</p>
          <p className="text-sm text-muted-foreground">
            Notes appear once this topic has a published AI lecture.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="notes-tab space-y-4">
      {/* Sticky header */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3 print:hidden">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 rounded-lg bg-primary/10">
            <BookOpen className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">
              {topicTitle || "Topic Notes"}
            </p>
            <p className="text-xs text-muted-foreground">
              {sections.length} section{sections.length === 1 ? "" : "s"} · Generated from lecture
            </p>
          </div>
        </div>
      </div>

      {/* Quick-jump chips */}
      <div className="flex flex-wrap gap-2 print:hidden">
        {sections.map((s, i) => (
          <a
            key={s.section_id}
            href={`#note-${s.section_id}`}
            className="text-xs px-3 py-1 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
          >
            {i + 1}. {s.title}
          </a>
        ))}
      </div>

      {/* Section cards */}
      <div className="space-y-4">
        {sections.map((section, idx) => {
          const bullets = (section.visual_beats || [])
            .filter((b) => {
              const t = (b.visual_type || "").toLowerCase();
              return t.includes("bullet") || t === "list" || t === "key_points";
            })
            .flatMap((b) => asArray(b.display_text))
            .map(stripSpeechTokens)
            .filter(Boolean);

          const callouts = (section.visual_beats || []).filter((b) => {
            const t = (b.visual_type || "").toLowerCase();
            return t === "definition" || t === "formula" || t === "equation";
          });

          const images = (section.visual_beats || [])
            .map((b) => b.image_url)
            .filter(Boolean) as string[];

          const intro = stripSpeechTokens(
            section.narration?.full_text ||
              (section.narration?.segments || [])
                .filter((s) => !s.purpose || s.purpose === "introduce")
                .map((s) => s.text || "")
                .join(" ")
          );

          const allSecQ = data?.questionsBySection?.[section.section_id] || [];
          const importantQ = allSecQ.filter((q: any) => q.is_important === true);
          const questions = allSecQ.filter((q: any) => q.is_important !== true);


          return (
            <Card
              key={section.section_id}
              id={`note-${section.section_id}`}
              className="scroll-mt-24"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base sm:text-lg">
                    <span className="text-primary mr-2">{idx + 1}.</span>
                    {section.title}
                  </CardTitle>
                  {section.section_type && (
                    <Badge variant="outline" className="text-[10px] uppercase shrink-0">
                      {section.section_type}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {intro && (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath, remarkGfm]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {intro}
                    </ReactMarkdown>
                  </div>
                )}

                {bullets.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Key points
                    </p>
                    <ul className="space-y-1.5 list-disc pl-5">
                      {bullets.map((b, i) => (
                        <li key={i} className="text-sm leading-relaxed">
                          <ReactMarkdown
                            remarkPlugins={[remarkMath, remarkGfm]}
                            rehypePlugins={[rehypeKatex]}
                            components={{ p: ({ children }) => <span>{children}</span> }}
                          >
                            {b}
                          </ReactMarkdown>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {callouts.length > 0 && (
                  <div className="grid gap-2">
                    {callouts.map((c, i) => (
                      <div
                        key={i}
                        className="rounded-lg border-l-4 border-primary bg-primary/5 p-3 text-sm"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1">
                          {c.visual_type}
                        </p>
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <ReactMarkdown
                            remarkPlugins={[remarkMath, remarkGfm]}
                            rehypePlugins={[rehypeKatex]}
                          >
                            {asArray(c.display_text).join("\n\n") || c.latex || ""}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {images.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {images.map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        alt={`${section.title} figure ${i + 1}`}
                        className="w-full h-auto rounded-lg border object-contain bg-muted"
                        loading="lazy"
                      />
                    ))}
                  </div>
                )}

                {/* Important questions */}
                {importantQ.length > 0 && (
                  <Collapsible defaultOpen>
                    <CollapsibleTrigger className="flex items-center justify-between w-full rounded-lg border border-amber-400/50 bg-amber-500/10 hover:bg-amber-500/15 px-3 py-2 text-sm font-medium transition">
                      <span className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                        <Star className="h-4 w-4 fill-current" />
                        Important questions
                        <Badge variant="secondary" className="ml-1 text-[10px] bg-amber-500/20 text-amber-900 dark:text-amber-200">
                          {importantQ.length}
                        </Badge>
                      </span>
                      <ChevronDown className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3 space-y-3">
                      {importantQ.slice(0, 5).map((q) => (
                        <QuestionPreview key={q.id} q={q} important />
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Practice questions */}
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center justify-between w-full rounded-lg border bg-muted/40 hover:bg-muted px-3 py-2 text-sm font-medium transition">

                    <span className="flex items-center gap-2">
                      <FileQuestion className="h-4 w-4 text-primary" />
                      Practice questions
                      <Badge variant="secondary" className="ml-1 text-[10px]">
                        {questions.length}
                      </Badge>
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 space-y-3">
                    {questions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No questions in the Question Bank for this subtopic yet.
                      </p>
                    ) : (
                      questions.slice(0, 5).map((q) => (
                        <QuestionPreview key={q.id} q={q} />
                      ))
                    )}
                    {questions.length < 3 && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={generatingFor === section.section_id}
                        onClick={() => handleGenerateQuestions(section)}
                      >
                        {generatingFor === section.section_id ? (
                          <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Generating…</>
                        ) : (
                          <><Sparkles className="h-3 w-3 mr-1" /> Generate practice questions</>
                        )}
                      </Button>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <style>{`
        @media print {
          .notes-tab { color: #000; }
          .notes-tab a { color: inherit; text-decoration: none; }
          .notes-tab .print\\:hidden { display: none !important; }
          .notes-tab [data-radix-collapsible-content-state="closed"] { display: block !important; }
        }
      `}</style>
    </div>
  );
};

const QuestionPreview = ({ q, important }: { q: TopicNotesQuestion; important?: boolean }) => {
  const [showAnswer, setShowAnswer] = useState(false);
  const options = normalizeOptions(q.options);
  const questionText = stripInlineMcqOptions(toDisplayString(q.question_text), options.length > 0);
  const answerText = toDisplayString(q.correct_answer);
  const explanationText = toDisplayString(q.explanation);

  return (
    <div className={`rounded-lg border p-3 bg-background ${important ? "border-amber-400/50" : ""}`}>
      <div className="text-sm font-medium">
        <ReactMarkdown
          remarkPlugins={[remarkMath, remarkGfm]}
          rehypePlugins={[rehypeKatex]}
        >
          {questionText}
        </ReactMarkdown>
      </div>
      {options.length > 0 && (
        <ul className="mt-2 space-y-1">
          {options.map((opt, i) => (
            <li key={i} className="text-sm text-muted-foreground">
              <span className="font-mono mr-1">{opt.key}.</span> {opt.label}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex items-center gap-2 text-xs">
        {q.difficulty && (
          <Badge variant="outline" className="text-[10px] capitalize">
            {q.difficulty}
          </Badge>
        )}
        {q.is_ai_generated && (
          <Badge variant="secondary" className="text-[10px]">AI</Badge>
        )}
        <button
          className="ml-auto text-primary hover:underline"
          onClick={() => setShowAnswer((s) => !s)}
        >
          {showAnswer ? "Hide answer" : "Show answer"}
        </button>
      </div>
      {showAnswer && (
        <div className="mt-2 rounded-md bg-primary/5 p-2 text-xs">
          <p className="font-semibold text-primary">Answer</p>
          <div className="prose prose-xs max-w-none dark:prose-invert">
            <ReactMarkdown
              remarkPlugins={[remarkMath, remarkGfm]}
              rehypePlugins={[rehypeKatex]}
            >
              {answerText || "—"}
            </ReactMarkdown>
          </div>
          {explanationText && (
            <>
              <p className="font-semibold text-primary mt-2">Explanation</p>
              <div className="prose prose-xs max-w-none dark:prose-invert">
                <ReactMarkdown
                  remarkPlugins={[remarkMath, remarkGfm]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {explanationText}
                </ReactMarkdown>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};


export default NotesTab;
