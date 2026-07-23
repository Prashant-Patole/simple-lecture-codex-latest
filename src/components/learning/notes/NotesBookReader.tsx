import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNotesResponsive } from "./useNotesResponsive";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  List,
  Star,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTopicNotes, type NotesSection, type TopicNotesQuestion } from "@/hooks/useTopicNotes";
import { toDisplayString, normalizeOptions } from "@/lib/toDisplayString";
import { cn } from "@/lib/utils";

interface Props {
  topicId: string;
  topicTitle?: string;
  chapterLabel?: string;
}

interface Spread {
  sectionIndex: number;
  sectionTitle: string;
  left: {
    kind: "intro";
    text: string;
    bullets: string[];
    isFirstPage: boolean;
  };
  right: {
    callouts: { type: string; text: string }[];
    images: string[];
    importantQuestions: TopicNotesQuestion[];
    practiceQuestions: TopicNotesQuestion[];
  };
}

const stripSpeech = (t: string) =>
  (t || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

const stripInlineMcqOptions = (text: string, hasOptions: boolean): string => {
  if (!hasOptions) return text;
  return (text || "").replace(
    /\s*(?:[-–—]\s*)?(?:\([aA]\)|[aA][.)])\s+[\s\S]*?(?=(?:[-–—]\s*)?(?:\([bB]\)|[bB][.)])\s+)[\s\S]*$/u,
    ""
  ).trim();
};

/**
 * Preserve paragraph breaks so the reader isn't a wall of text.
 * - Strips SSML/HTML tags.
 * - Collapses runs of spaces/tabs but KEEPS newlines.
 * - If the source has no breaks, splits on sentence boundaries into
 *   ~2-sentence paragraphs.
 */
const cleanNarrationText = (raw: string): string => {
  let t = (raw || "").replace(/<[^>]+>/g, "");
  t = t.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!t) return "";
  if (t.includes("\n\n")) {
    return t
      .split(/\n{2,}/)
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n\n");
  }
  // No explicit breaks — group every ~2 sentences into a paragraph.
  const sentences = t
    .replace(/\s+/g, " ")
    .match(/[^.!?]+[.!?]+["')\]]?|\S+$/g) || [t];
  const paras: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    paras.push(sentences.slice(i, i + 2).join(" ").trim());
  }
  return paras.filter(Boolean).join("\n\n");
};


const pickSectionQuestions = (
  bucket: TopicNotesQuestion[] | undefined
): { important: TopicNotesQuestion[]; practice: TopicNotesQuestion[] } => {
  const seen = new Set<string>();
  const clean = (bucket || []).filter((q) => {
    const t = stripSpeech(toDisplayString(q.question_text));
    if (!t || seen.has(t)) return false;
    seen.add(t);
    return true;
  });
  const important = clean.filter((q: any) => q.is_important === true).slice(0, 2);
  const practice = clean
    .filter((q: any) => q.is_important !== true)
    .sort((a, b) => Number(!!b.is_verified) - Number(!!a.is_verified))
    .slice(0, 3);
  return { important, practice };
};

const buildSpreads = (
  sections: NotesSection[],
  questionsBySection: Record<string, TopicNotesQuestion[]>
): Spread[] => {
  const spreads: Spread[] = [];
  sections.forEach((section, si) => {
    const segmentJoined = (section.narration?.segments || [])
      .map((s) => toDisplayString(s.text).trim())
      .filter(Boolean)
      .join("\n\n");
    const introRaw = segmentJoined || toDisplayString(section.narration?.full_text);
    const intro = cleanNarrationText(introRaw);

    const bullets = (section.visual_beats || [])
      .filter((b) => {
        const t = (b.visual_type || "").toLowerCase();
        return t.includes("bullet") || t === "list" || t === "key_points";
      })
      .flatMap((b) =>
        Array.isArray(b.display_text)
          ? b.display_text.map((x) => toDisplayString(x))
          : [toDisplayString(b.display_text)]
      )
      .map(stripSpeech)
      .filter(Boolean);

    const callouts = (section.visual_beats || [])
      .filter((b) => {
        const t = (b.visual_type || "").toLowerCase();
        return t === "definition" || t === "formula" || t === "equation";
      })
      .map((b) => ({
        type: b.visual_type || "note",
        text: toDisplayString(b.display_text) || toDisplayString(b.latex),
      }))
      .filter((c) => c.text);

    const images = (section.visual_beats || [])
      .map((b) => b.image_url)
      .filter(Boolean) as string[];

    // Paginate: aim for ~900 chars per page so each page shows 2-4 short
    // paragraphs instead of one dense block.
    const PAGE_CHAR_LIMIT = 900;
    const paragraphs = intro.split(/\n{2,}/).filter(Boolean);

    const pages: string[] = [];
    let buf = "";
    for (const p of paragraphs) {
      if ((buf + "\n\n" + p).length > PAGE_CHAR_LIMIT && buf) {
        pages.push(buf.trim());
        buf = p;
      } else {
        buf = buf ? buf + "\n\n" + p : p;
      }
    }
    if (buf) pages.push(buf.trim());
    if (pages.length === 0) pages.push("");

    const { important, practice } = pickSectionQuestions(
      questionsBySection[section.section_id]
    );

    // Distribute bullets/callouts/images/questions across the section's pages.
    pages.forEach((pageText, pi) => {
      const isLast = pi === pages.length - 1;
      spreads.push({
        sectionIndex: si,
        sectionTitle: section.title,
        left: {
          kind: "intro",
          text: pageText,
          bullets: isLast ? bullets : [],
          isFirstPage: pi === 0,
        },
        right: {
          callouts: pi === 0 ? callouts : [],
          images: isLast ? images : [],
          importantQuestions: isLast ? important : [],
          practiceQuestions: isLast ? practice : [],
        },
      });
    });
  });
  return spreads;
};

export const NotesBookReader = ({ topicId, topicTitle, chapterLabel }: Props) => {
  const { data, isLoading, error } = useTopicNotes(topicId);
  const [page, setPage] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  const layout = useNotesResponsive();
  const isSmall = layout !== "desktop";
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const spreads = useMemo(
    () => buildSpreads(data?.sections || [], data?.questionsBySection || {}),
    [data]
  );

  const total = spreads.length;

  const go = useCallback(
    (delta: number) => {
      setPage((p) => Math.max(0, Math.min(total - 1, p + delta)));
    },
    [total]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") go(1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
      if (e.key === "Home") setPage(0);
      if (e.key === "End") setPage(Math.max(0, total - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, total]);

  if (isLoading) {
    return <Skeleton className="h-[600px] w-full rounded-2xl" />;
  }

  if (error || !data?.hasPublishedLecture || total === 0) {
    return (
      <div className="rounded-2xl border bg-card p-10 text-center space-y-2">
        <BookOpen className="h-8 w-8 mx-auto text-muted-foreground" />
        <p className="font-medium">Notes not available yet</p>
        <p className="text-sm text-muted-foreground">
          Book will appear once this topic has a published AI lecture.
        </p>
      </div>
    );
  }

  const current = spreads[page];
  const sectionPagesForToc = spreads.reduce<Record<number, number>>((acc, s, idx) => {
    if (acc[s.sectionIndex] === undefined) acc[s.sectionIndex] = idx;
    return acc;
  }, {});

  return (
    <div className="notes-book">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 rounded-t-2xl border border-b-0 bg-[hsl(var(--book-ink))] px-4 py-2.5 text-[hsl(var(--book-page))] print:hidden">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{topicTitle || "Notes"}</p>
            {chapterLabel && (
              <p className="text-[11px] opacity-70 truncate">{chapterLabel}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Sheet open={tocOpen} onOpenChange={setTocOpen}>
            <SheetTrigger asChild>
              <Button size="sm" variant="ghost" className="text-[hsl(var(--book-page))] hover:bg-white/10">
                <List className="h-4 w-4 mr-1" /> Contents
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetHeader>
                <SheetTitle>Table of contents</SheetTitle>
              </SheetHeader>
              <ul className="mt-4 space-y-1">
                {(data?.sections || []).map((s, i) => (
                  <li key={s.section_id}>
                    <button
                      onClick={() => {
                        setPage(sectionPagesForToc[i] ?? 0);
                        setTocOpen(false);
                      }}
                      className={cn(
                        "w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-muted transition",
                        current.sectionIndex === i && "bg-primary/10 text-primary font-medium"
                      )}
                    >
                      <span className="text-muted-foreground mr-2">{i + 1}.</span>
                      {s.title}
                    </button>
                  </li>
                ))}
              </ul>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Book body */}
      <div
        className="book-spread border border-t-0 rounded-b-2xl overflow-hidden"
        onPointerDown={(e) => {
          if (e.pointerType !== "touch") return;
          swipeStart.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const s = swipeStart.current;
          swipeStart.current = null;
          if (!s || e.pointerType !== "touch") return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            go(dx < 0 ? 1 : -1);
          }
        }}
      >
        <div className={cn("grid grid-cols-1 lg:grid-cols-2", !isSmall && "min-h-[70vh]")}>
          {/* Left page */}
          <article className={cn(
            "book-page book-page--left book-serif",
            isSmall ? "px-4 sm:px-6 py-5" : "px-6 sm:px-10 py-8"
          )}>
            {current.left.isFirstPage && (
              <header className="mb-4">
                <p className="text-[10px] uppercase tracking-[0.2em] opacity-60">
                  Section {current.sectionIndex + 1}
                </p>
                <h2 className="text-xl sm:text-2xl font-semibold mt-1 leading-snug">
                  {current.sectionTitle}
                </h2>
                <div className="mt-3 h-[2px] w-12 bg-[hsl(var(--book-accent))]" />
              </header>
            )}
            <div
              className={cn(
                "prose prose-base sm:prose-lg max-w-[62ch] book-prose leading-[1.8]",
                current.left.isFirstPage && "first-letter:float-left first-letter:mr-2 first-letter:text-5xl first-letter:font-bold first-letter:leading-[0.9] first-letter:text-[hsl(var(--book-accent))]"
              )}
            >
              <ReactMarkdown
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[rehypeKatex]}
              >
                {current.left.text || "\u00A0"}
              </ReactMarkdown>
            </div>

            {current.left.bullets.length > 0 && (
              <div className="mt-5">
                <p className="text-[10px] uppercase tracking-[0.2em] opacity-60 mb-2">
                  Key points
                </p>
                <ul className="space-y-1.5 list-disc pl-5 book-prose">
                  {current.left.bullets.map((b, i) => (
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
          </article>

          {/* Right page */}
          <aside className={cn(
            "book-page book-page--right book-serif border-[hsl(var(--book-accent))]/25",
            isSmall
              ? "px-4 sm:px-6 py-5 border-t"
              : "px-6 sm:px-10 py-8 border-t md:border-t-0 lg:border-l lg:max-h-[80vh] lg:overflow-y-auto"
          )}>
            {current.right.callouts.length === 0 &&
            current.right.images.length === 0 &&
            current.right.importantQuestions.length === 0 &&
            current.right.practiceQuestions.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center opacity-40">
                <p className="text-xs italic">— continued —</p>
              </div>
            ) : (
              <div className="space-y-5">
                {current.right.callouts.map((c, i) => (
                  <figure
                    key={i}
                    className="rounded-md border-l-4 border-[hsl(var(--book-accent))] bg-[hsl(var(--book-accent))]/10 px-4 py-3"
                  >
                    <figcaption className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--book-accent))] mb-1">
                      {c.type}
                    </figcaption>
                    <div className="prose prose-sm max-w-none book-prose">
                      <ReactMarkdown
                        remarkPlugins={[remarkMath, remarkGfm]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {c.text}
                      </ReactMarkdown>
                    </div>
                  </figure>
                ))}
                {current.right.images.length > 0 && (
                  <div className="grid grid-cols-1 gap-3">
                    {current.right.images.map((src, i) => (
                      <figure key={i} className="border border-[hsl(var(--book-accent))]/25 rounded-md p-2 bg-white/40">
                        <img
                          src={src}
                          alt={`${current.sectionTitle} figure ${i + 1}`}
                          className="w-full h-auto rounded object-contain"
                          loading="lazy"
                        />
                        <figcaption className="text-[10px] text-center mt-1 opacity-70 italic">
                          Fig {current.sectionIndex + 1}.{i + 1}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}

                {current.right.importantQuestions.length > 0 && (
                  <QuestionBlock
                    title="Important questions"
                    icon="star"
                    accent="amber"
                    questions={current.right.importantQuestions}
                  />
                )}
                {current.right.practiceQuestions.length > 0 && (
                  <QuestionBlock
                    title="Practice from this topic"
                    accent="primary"
                    questions={current.right.practiceQuestions}
                  />
                )}
              </div>
            )}
          </aside>
        </div>


        {/* Footer / pager */}
        <div className={cn(
          "flex items-center justify-between border-t border-[hsl(var(--book-accent))]/25 bg-[hsl(var(--book-page))] px-4 py-2 text-[hsl(var(--book-ink))] print:hidden",
          isSmall && "sticky bottom-0 z-10 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]"
        )}>
          <Button
            size="sm"
            variant="ghost"
            disabled={page === 0}
            onClick={() => go(-1)}
            className="hover:bg-[hsl(var(--book-accent))]/10"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Prev
          </Button>
          <div className="text-xs opacity-70 book-serif">
            Page {page + 1} of {total}
          </div>
          <Button
            size="sm"
            variant="ghost"
            disabled={page === total - 1}
            onClick={() => go(1)}
            className="hover:bg-[hsl(var(--book-accent))]/10"
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      <style>{`
        .book-page {
          background: hsl(var(--book-page));
          color: hsl(var(--book-ink));
          background-image:
            radial-gradient(hsl(var(--book-ink) / 0.04) 1px, transparent 1px);
          background-size: 3px 3px;
        }
        .book-serif {
          font-family: 'Georgia', 'Cambria', 'Times New Roman', serif;
        }
        .book-prose, .book-prose p, .book-prose li {
          color: hsl(var(--book-ink));
        }
        .book-prose p {
          margin: 0 0 1.1em 0;
          line-height: 1.8;
          text-align: justify;
          hyphens: auto;
        }
        .book-prose p + p { text-indent: 1.4em; }
        .book-prose strong { color: hsl(var(--book-ink)); }

        @media print {
          .notes-book .print\\:hidden { display: none !important; }
          .book-page { break-inside: avoid; }
          /* Force two-page book layout when printing, regardless of viewport. */
          .notes-book .book-spread > .grid { grid-template-columns: 1fr 1fr !important; }
          .notes-book .book-page--right {
            border-top: 0 !important;
            border-left: 1px solid hsl(var(--book-accent) / 0.25) !important;
            max-height: none !important;
            overflow: visible !important;
          }
        }
      `}</style>
    </div>
  );
};

export default NotesBookReader;

/* -------------------------- Question blocks -------------------------- */

interface QuestionBlockProps {
  title: string;
  accent: "amber" | "primary";
  icon?: "star";
  questions: TopicNotesQuestion[];
}

const MD = ({ children }: { children: string }) => (
  <ReactMarkdown
    remarkPlugins={[remarkMath, remarkGfm]}
    rehypePlugins={[rehypeKatex]}
    components={{ p: ({ children }) => <span>{children}</span> }}
  >
    {children}
  </ReactMarkdown>
);

const QuestionBlock = ({ title, accent, icon, questions }: QuestionBlockProps) => {
  const accentClass =
    accent === "amber"
      ? "border-amber-500/60 bg-amber-500/5"
      : "border-[hsl(var(--book-accent))]/50 bg-[hsl(var(--book-accent))]/5";
  const headClass =
    accent === "amber" ? "text-amber-700" : "text-[hsl(var(--book-accent))]";

  return (
    <section className={cn("rounded-md border-l-4 px-4 py-3", accentClass)}>
      <header className={cn("flex items-center gap-1.5 mb-3", headClass)}>
        {icon === "star" && <Star className="h-3.5 w-3.5 fill-current" />}
        <h3 className="text-[10px] font-semibold uppercase tracking-widest">
          {title}
        </h3>
      </header>

      <ol className="space-y-3 list-decimal pl-4 text-sm">
        {questions.map((q, idx) => {
          const options = normalizeOptions(q.options);
          const text = stripInlineMcqOptions(
            stripSpeech(toDisplayString(q.question_text)),
            options.length > 0
          );
          const answer = stripSpeech(toDisplayString(q.correct_answer));
          const explanation = stripSpeech(toDisplayString(q.explanation));
          return (
            <li key={q.id || idx} className="leading-relaxed">
              <div className="book-prose">
                <MD>{text}</MD>
              </div>

              {options.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 pl-2 text-[13px] opacity-90">
                  {options.map((o) => (
                    <li key={o.key}>
                      <span className="font-semibold mr-1">{o.key}.</span>
                      <span className="inline"><MD>{o.label}</MD></span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {q.difficulty && (
                  <Badge variant="outline" className="h-4 px-1.5 text-[9px] uppercase">
                    {q.difficulty}
                  </Badge>
                )}
                {(q as any).marks ? (
                  <Badge variant="outline" className="h-4 px-1.5 text-[9px]">
                    {(q as any).marks}m
                  </Badge>
                ) : null}
              </div>

              {(answer || explanation) && (
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 mt-1.5 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Show solution <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-1.5 rounded border bg-background/60 px-2.5 py-2 text-[13px] space-y-1.5">
                    {answer && (
                      <div>
                        <span className="font-semibold text-emerald-700">Answer: </span>
                        <span className="inline"><MD>{answer}</MD></span>
                      </div>
                    )}
                    {explanation && (
                      <div className="opacity-90">
                        <span className="font-semibold">Explanation: </span>
                        <span className="inline"><MD>{explanation}</MD></span>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
};
