import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  AlertCircle,
  BookMarked,
  Brain,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ImageIcon,
  Lightbulb,
  ListChecks,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type ImportantNoteAnswer,
  type ImportantNoteImage,
  type ImportantNoteQuestion,
  type ImportantTopicNotes,
  useImportantNotes,
} from "@/hooks/useImportantNotes";

interface ImportantNotesTabProps {
  chapterId?: string | null;
  topicId?: string | null;
  topicTitle?: string;
}

const markdownPlugins = [remarkGfm, remarkMath];
const markdownRehypePlugins = [rehypeKatex];

const Markdown = ({ children, inline = false }: { children?: string; inline?: boolean }) => (
  <ReactMarkdown
    remarkPlugins={markdownPlugins}
    rehypePlugins={markdownRehypePlugins}
    components={inline ? { p: ({ children: value }) => <span>{value}</span> } : undefined}
  >
    {children || ""}
  </ReactMarkdown>
);

const getImageUrl = (image?: ImportantNoteImage) => image?.url || image?.local_url || "";

const getQuestionText = (question: ImportantNoteQuestion) => {
  const text = question.question_text || "";
  if (Object.keys(question.options || {}).length === 0) return text;

  const optionStart = text.search(/(?:\n|\s+-\s+)\s*(?:\([aA]\)|[aA][.)])\s+/);
  return optionStart >= 0 ? text.slice(0, optionStart).trim() : text;
};

const getFormulaText = (formula: unknown): string => {
  if (typeof formula === "string") return formula;
  if (!formula || typeof formula !== "object") return "";
  const item = formula as Record<string, unknown>;
  const value =
    item.latex || item.formula || item.expression || item.equation || item.content || item.text;
  return typeof value === "string" ? value : "";
};

const QuestionCard = ({
  question,
  answer,
  index,
}: {
  question: ImportantNoteQuestion;
  answer?: ImportantNoteAnswer;
  index: number;
}) => {
  const [open, setOpen] = useState(false);
  const options = Object.entries(question.options || {});

  return (
    <div className="rounded-xl border border-emerald-900/10 bg-white/70 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-900 text-xs font-bold text-white">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="prose prose-sm max-w-none text-stone-800">
            <Markdown>{getQuestionText(question)}</Markdown>
          </div>
          {options.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {options.map(([key, option]) => {
                const text = typeof option === "string" ? option : option?.text;
                return (
                  <div key={key} className="rounded-lg border bg-white px-3 py-2 text-sm">
                    <span className="mr-2 font-semibold text-emerald-800">{key}.</span>
                    <Markdown inline>{text}</Markdown>
                  </div>
                );
              })}
            </div>
          )}
          {answer?.answer && (
            <Collapsible open={open} onOpenChange={setOpen} className="mt-3">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-2 px-0 text-emerald-800">
                  {open ? "Hide answer" : "Show answer"}
                  <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 rounded-xl bg-emerald-50/80 p-4">
                  <div className="prose prose-sm max-w-none text-stone-700">
                    <Markdown>{answer.answer}</Markdown>
                  </div>
                  {answer.memory_tip && (
                    <div className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-semibold">Memory tip</p>
                        <Markdown>{answer.memory_tip}</Markdown>
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>
    </div>
  );
};

const TopicNotes = ({ topic }: { topic: ImportantTopicNotes }) => {
  const sections = topic.note_sections || [];
  const formulas = (topic.latex_formulas || []).map(getFormulaText).filter(Boolean);
  const images = (topic.note_images || []).filter((image) => getImageUrl(image));
  const answersByQuestion = new Map(
    (topic.question_answers || []).map((answer) => [answer.question_id, answer]),
  );

  return (
    <div className="space-y-5">
      {sections.map((section, index) => (
        <section
          key={`${topic.topic_note_id}-section-${index}`}
          className="overflow-hidden rounded-2xl border border-emerald-900/10 bg-[#fffdf7] shadow-sm"
        >
          <div className="border-b border-emerald-900/10 bg-gradient-to-r from-emerald-50 to-amber-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-900 text-sm font-bold text-white">
                {index + 1}
              </span>
              <h3 className="font-serif text-lg font-semibold text-emerald-950">
                {section.heading || `Section ${index + 1}`}
              </h3>
            </div>
          </div>
          <div className="space-y-5 p-5">
            {section.explanation && (
              <div className="prose prose-stone prose-sm max-w-none leading-relaxed">
                <Markdown>{section.explanation}</Markdown>
              </div>
            )}
            {(section.key_points?.length || 0) > 0 && (
              <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-4">
                <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">
                  <ListChecks className="h-4 w-4" />
                  Key points
                </p>
                <ul className="space-y-2.5">
                  {section.key_points!.map((point, pointIndex) => (
                    <li key={pointIndex} className="flex items-start gap-2.5 text-sm leading-relaxed text-stone-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <div className="min-w-0">
                        <Markdown inline>{point}</Markdown>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      ))}

      {formulas.length > 0 && (
        <section className="rounded-2xl border border-sky-200 bg-sky-50/60 p-5">
          <h3 className="mb-3 font-serif text-lg font-semibold text-sky-950">Important formulas</h3>
          <div className="grid gap-3">
            {formulas.map((formula, index) => (
              <div key={index} className="overflow-x-auto rounded-xl bg-white p-4 text-center shadow-sm">
                <Markdown>{`$$${formula.replace(/^\$+|\$+$/g, "")}$$`}</Markdown>
              </div>
            ))}
          </div>
        </section>
      )}

      {images.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 font-serif text-lg font-semibold text-emerald-950">
            <ImageIcon className="h-5 w-5" />
            Visual notes
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {images.map((image, index) => (
              <figure key={`${getImageUrl(image)}-${index}`} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                <img
                  src={getImageUrl(image)}
                  alt={`${topic.topic_title || "Topic"} visual note ${index + 1}`}
                  className="h-auto w-full object-contain"
                  loading="lazy"
                />
              </figure>
            ))}
          </div>
        </section>
      )}

      {(topic.questions?.length || 0) > 0 && (
        <section className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="rounded-lg bg-amber-100 p-2 text-amber-800">
              <Brain className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-serif text-lg font-semibold text-stone-900">Important questions</h3>
              <p className="text-xs text-stone-500">Review these after studying the notes</p>
            </div>
          </div>
          <div className="space-y-3">
            {topic.questions!.map((question, index) => (
              <QuestionCard
                key={question.id || index}
                question={question}
                answer={answersByQuestion.get(question.id)}
                index={index}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export const ImportantNotesTab = ({
  chapterId,
  topicId,
  topicTitle,
}: ImportantNotesTabProps) => {
  const { data, isLoading, error, refetch, isFetching } = useImportantNotes(chapterId);
  const visibleTopics = useMemo(() => {
    const topics = data?.topics || [];
    if (!topicId) return topics;
    return topics.filter((topic) => topic.topic_id === topicId);
  }, [data?.topics, topicId]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/20">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertCircle className="h-9 w-9 text-destructive" />
          <div>
            <p className="font-semibold">Couldn't load important notes</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Please try again."}
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (visibleTopics.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <BookMarked className="h-10 w-10 text-muted-foreground" />
          <p className="font-semibold">Important notes are not available yet</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {topicId
              ? `Generated notes for ${topicTitle || "this topic"} will appear here once they are ready.`
              : "Generated notes for this chapter will appear here once they are ready."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-2xl border border-emerald-900/10 bg-[#f5f0df] p-5 sm:p-6">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-amber-300/20" />
        <div className="absolute -bottom-16 right-20 h-32 w-32 rounded-full bg-emerald-500/10" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-900 text-white shadow-sm">
              <BookMarked className="h-6 w-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-xl font-bold text-emerald-950 sm:text-2xl">Important Notes</h2>
                <Sparkles className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-1 text-sm text-emerald-900/65">
                Carefully generated study notes, key points and revision questions
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-emerald-900/20 bg-white/60 text-emerald-900">
            {visibleTopics.length} topic{visibleTopics.length === 1 ? "" : "s"}
          </Badge>
        </div>
      </header>

      {visibleTopics.length === 1 ? (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {visibleTopics[0].topic_number && (
              <Badge className="bg-emerald-900">Topic {visibleTopics[0].topic_number}</Badge>
            )}
            <h3 className="font-serif text-xl font-semibold text-foreground">
              {visibleTopics[0].topic_title || topicTitle || "Topic notes"}
            </h3>
            {visibleTopics[0].generated_at && (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                Generated {new Date(visibleTopics[0].generated_at).toLocaleDateString()}
              </span>
            )}
          </div>
          <TopicNotes topic={visibleTopics[0]} />
        </div>
      ) : (
        <Accordion type="single" collapsible defaultValue={visibleTopics[0]?.topic_note_id} className="space-y-3">
          {visibleTopics.map((topic, index) => (
            <AccordionItem
              key={topic.topic_note_id}
              value={topic.topic_note_id}
              className="overflow-hidden rounded-2xl border bg-card px-4 shadow-sm"
            >
              <AccordionTrigger className="gap-3 py-4 text-left hover:no-underline">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 font-semibold text-emerald-900">
                    {topic.topic_number || index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-serif text-base font-semibold text-foreground">{topic.topic_title || `Topic ${index + 1}`}</p>
                    <p className="text-xs font-normal text-muted-foreground">
                      {topic.note_sections?.length || 0} sections · {topic.questions?.length || 0} questions
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-5">
                <TopicNotes topic={topic} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
};
