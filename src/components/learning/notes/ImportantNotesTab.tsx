import { useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookMarked,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
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
import "./important-notes-book.css";

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
                  {(answer.key_points?.length || 0) > 0 && (
                    <div className="mt-4 rounded-lg border border-emerald-200 bg-white/70 p-3">
                      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800">
                        <ListChecks className="h-4 w-4" /> Key points
                      </p>
                      <ul className="space-y-2 text-sm text-stone-700">
                        {answer.key_points!.map((point, pointIndex) => (
                          <li key={pointIndex} className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            <Markdown inline>{point}</Markdown>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(answer.formulas_used?.length || 0) > 0 && (
                    <div className="mt-3 rounded-lg border bg-white/80 p-3">
                      {answer.formulas_used!.map((formula, formulaIndex) => {
                        const formulaText = getFormulaText(formula);
                        return formulaText ? (
                          <Markdown key={formulaIndex}>{`$$${formulaText.replace(/^\$+|\$+$/g, "")}$$`}</Markdown>
                        ) : null;
                      })}
                    </div>
                  )}
                  {(answer.answer_images?.length || 0) > 0 && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {answer.answer_images!.map((image, imageIndex) => (
                        <img
                          key={`${getImageUrl(image)}-${imageIndex}`}
                          src={getImageUrl(image)}
                          alt={`${question.question_text || "Answer"} visual ${imageIndex + 1}`}
                          className="max-h-72 w-full rounded-lg border bg-white object-contain"
                          loading="lazy"
                        />
                      ))}
                    </div>
                  )}
                  {answer.memory_tip && (
                    <div className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-semibold">Memory tip</p>
                        <Markdown>{answer.memory_tip}</Markdown>
                      </div>
                    </div>
                  )}
                  {answer.estimated_study_time && (
                    <div className="mt-3 flex items-center gap-2 text-xs font-medium text-stone-500">
                      <Clock3 className="h-3.5 w-3.5" />
                      Estimated study time: {answer.estimated_study_time}
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

type SectionBookPage = {
  kind: "section";
  section: NonNullable<ImportantTopicNotes["note_sections"]>[number];
  sectionIndex: number;
  images: ImportantNoteImage[];
};

type FormulaBookPage = {
  kind: "formulas";
  formulas: string[];
  groupIndex: number;
};

type QuestionsBookPage = {
  kind: "questions";
  questions: ImportantNoteQuestion[];
  startIndex: number;
};

type BookPage = SectionBookPage | FormulaBookPage | QuestionsBookPage;

const chunk = <T,>(items: T[], size: number) => {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
};

const buildBookPages = (topic: ImportantTopicNotes): BookPage[] => {
  const sections = topic.note_sections || [];
  const images = (topic.note_images || []).filter((image) => getImageUrl(image));
  let imageCursor = 0;

  const sectionPages: SectionBookPage[] = sections.map((section, sectionIndex) => {
    const remainingImages = images.length - imageCursor;
    const remainingSections = sections.length - sectionIndex;
    const describedImages = section.image_descriptions?.length || 0;
    const imageCount =
      describedImages > 0 ? describedImages : remainingImages >= remainingSections ? 1 : 0;
    const sectionImages = images.slice(imageCursor, imageCursor + imageCount);
    imageCursor += imageCount;

    return {
      kind: "section",
      section,
      sectionIndex,
      images: sectionImages,
    };
  });

  if (imageCursor < images.length && sectionPages.length > 0) {
    sectionPages[sectionPages.length - 1].images.push(...images.slice(imageCursor));
  }

  const formulas = (topic.latex_formulas || []).map(getFormulaText).filter(Boolean);
  const formulaPages: FormulaBookPage[] = chunk(formulas, 4).map((group, groupIndex) => ({
    kind: "formulas",
    formulas: group,
    groupIndex,
  }));
  const questionPages: QuestionsBookPage[] = chunk(topic.questions || [], 2).map(
    (questions, groupIndex) => ({
      kind: "questions",
      questions,
      startIndex: groupIndex * 2,
    }),
  );

  return [...sectionPages, ...formulaPages, ...questionPages];
};

const SectionPage = ({
  page,
  topicTitle,
}: {
  page: SectionBookPage;
  topicTitle?: string;
}) => {
  const [activeImage, setActiveImage] = useState(0);
  const image = page.images[activeImage];
  const imageDescription = page.section.image_descriptions?.[activeImage];

  return (
    <div className={`important-book-grid ${image ? "" : "important-book-grid--text-only"}`}>
      <div className="important-book-copy">
        <p className="important-book-eyebrow">Lesson {String(page.sectionIndex + 1).padStart(2, "0")}</p>
        <h3>{page.section.heading || `Section ${page.sectionIndex + 1}`}</h3>
        {page.section.explanation && (
          <div className="important-book-explanation">
            <Markdown>{page.section.explanation}</Markdown>
          </div>
        )}
        {(page.section.key_points?.length || 0) > 0 && (
          <div className="important-book-keypoints">
            <p>
              <ListChecks className="h-4 w-4" />
              Remember
            </p>
            <ul>
              {page.section.key_points!.map((point, pointIndex) => (
                <li key={pointIndex}>
                  <CheckCircle2 className="h-4 w-4" />
                  <div>
                    <Markdown inline>{point}</Markdown>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {image && (
        <div className="important-book-visual">
          <div className="important-book-photo-frame">
            <img
              key={getImageUrl(image)}
              src={getImageUrl(image)}
              alt={imageDescription || `${topicTitle || "Topic"} visual note`}
              loading="eager"
            />
            <span className="important-book-tape important-book-tape--left" />
            <span className="important-book-tape important-book-tape--right" />
          </div>
          {imageDescription && <p className="important-book-caption">{imageDescription}</p>}
          {page.images.length > 1 && (
            <div className="important-book-image-nav" aria-label="Page illustrations">
              <button
                type="button"
                aria-label="Previous illustration"
                onClick={() =>
                  setActiveImage((current) =>
                    current === 0 ? page.images.length - 1 : current - 1,
                  )
                }
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div>
                {page.images.map((item, index) => (
                  <button
                    type="button"
                    key={`${getImageUrl(item)}-${index}`}
                    aria-label={`Show illustration ${index + 1}`}
                    aria-current={index === activeImage}
                    className={index === activeImage ? "is-active" : ""}
                    onClick={() => setActiveImage(index)}
                  />
                ))}
              </div>
              <button
                type="button"
                aria-label="Next illustration"
                onClick={() =>
                  setActiveImage((current) =>
                    current === page.images.length - 1 ? 0 : current + 1,
                  )
                }
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const TopicNotes = ({ topic }: { topic: ImportantTopicNotes }) => {
  const bookRef = useRef<HTMLDivElement>(null);
  const pages = useMemo(() => buildBookPages(topic), [topic]);
  const [pageIndex, setPageIndex] = useState(0);
  const [turnDirection, setTurnDirection] = useState<"forward" | "backward">("forward");
  const answersByQuestion = useMemo(
    () =>
      new Map(
        (topic.question_answers || []).map((answer) => [answer.question_id, answer]),
      ),
    [topic.question_answers],
  );
  const page = pages[pageIndex];

  const turnPage = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= pages.length || nextIndex === pageIndex) return;
    setTurnDirection(nextIndex > pageIndex ? "forward" : "backward");
    setPageIndex(nextIndex);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        bookRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  };

  if (!page) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        This topic does not have any generated note pages yet.
      </div>
    );
  }

  return (
    <div ref={bookRef} className="important-book-shell">
      <div className="important-book-cover-edge" />
      <div className="important-book-spine" aria-hidden="true" />
      <article
        key={`${topic.topic_note_id}-${pageIndex}-${turnDirection}`}
        className={`important-book-page important-book-page--${turnDirection}`}
        aria-live="polite"
      >
        <div className="important-book-page-header">
          <span>{topic.topic_title || "Important Notes"}</span>
          <span>Page {pageIndex + 1}</span>
        </div>

        <div className="important-book-page-content">
          {page.kind === "section" && (
            <SectionPage page={page} topicTitle={topic.topic_title} />
          )}

          {page.kind === "formulas" && (
            <div className="important-book-reference-page">
              <div className="important-book-reference-title">
                <span><Sparkles className="h-5 w-5" /></span>
                <div>
                  <p>Quick reference</p>
                  <h3>Important formulas</h3>
                </div>
              </div>
              <div className="important-book-formulas">
                {page.formulas.map((formula, index) => (
                  <div key={index}>
                    <Markdown>{`$$${formula.replace(/^\$+|\$+$/g, "")}$$`}</Markdown>
                  </div>
                ))}
              </div>
            </div>
          )}

          {page.kind === "questions" && (
            <div className="important-book-practice-page">
              <div className="important-book-reference-title">
                <span><Brain className="h-5 w-5" /></span>
                <div>
                  <p>Test yourself</p>
                  <h3>Important questions</h3>
                </div>
              </div>
              <div className="space-y-3">
                {page.questions.map((question, index) => (
                  <QuestionCard
                    key={question.id || index}
                    question={question}
                    answer={answersByQuestion.get(question.id)}
                    index={page.startIndex + index}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="important-book-page-number">{pageIndex + 1}</div>
      </article>

      <div className="important-book-controls">
        <Button
          type="button"
          variant="outline"
          onClick={() => turnPage(pageIndex - 1)}
          disabled={pageIndex === 0}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous page
        </Button>
        <div className="important-book-progress">
          <span>{pageIndex + 1} of {pages.length}</span>
          <div>
            {pages.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Open page ${index + 1}`}
                aria-current={index === pageIndex}
                className={index === pageIndex ? "is-active" : ""}
                onClick={() => turnPage(index)}
              />
            ))}
          </div>
        </div>
        <Button
          type="button"
          onClick={() => turnPage(pageIndex + 1)}
          disabled={pageIndex === pages.length - 1}
          className="gap-2 bg-emerald-900 hover:bg-emerald-800"
        >
          Next page
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export const ImportantNotesPresentation = ({ topic }: { topic: ImportantTopicNotes }) => (
  <TopicNotes topic={topic} />
);

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
