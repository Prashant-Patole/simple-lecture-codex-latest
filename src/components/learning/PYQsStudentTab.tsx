import { useState, useMemo, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DifficultyBadge } from "@/components/admin/DifficultyBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText } from "lucide-react";
import { usePYQQuestionsPage } from "@/hooks/usePYQQuestions";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { convertMathpixToStandard } from "@/components/learning/player/utils/latexNormalizer";
import { isBareFilename, resolveQuestionImageUrl } from "@/lib/imageResolver";
import "katex/dist/katex.min.css";

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
      alt={alt || ""}
      className="max-w-full w-auto h-auto rounded-md my-2 block"
      onError={() => setHasError(true)}
      {...props}
    />
  );
};

interface PYQsStudentTabProps {
  subjectId?: string | null;
  chapterId?: string;
  topicId?: string;
}

const PYQ_TYPES = [
  { value: "consolidated", label: "Consolidated" },
  { value: "important", label: "Important" },
  { value: "predictive", label: "Predictive" },
] as const;

const getOptionText = (opt: any): string => {
  if (typeof opt === "string") return opt;
  if (opt?.text) return opt.text;
  return String(opt);
};

const MathText = ({ text, className }: { text: string; className?: string }) => {
  const normalized = useMemo(() => convertMathpixToStandard(text), [text]);
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex, rehypeRaw]}
      components={{
        p: ({ children }) => <span className={className}>{children}</span>,
        img: ({ node, ...imgProps }: any) => <SilentResolvedImage {...imgProps} />,
      }}
    >
      {normalized}
    </ReactMarkdown>
  );
};

const getPageWindow = (current: number, total: number): (number | "ellipsis")[] => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result: (number | "ellipsis")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("ellipsis");
    result.push(sorted[i]);
  }
  return result;
};

export const PYQsStudentTab = ({ subjectId, chapterId, topicId }: PYQsStudentTabProps) => {
  const [activeType, setActiveType] = useState("consolidated");
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeType, subjectId, chapterId, topicId]);

  const { data, isLoading } = usePYQQuestionsPage(
    subjectId || undefined,
    activeType,
    chapterId,
    topicId,
    currentPage,
  );

  const questions = data?.questions ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    setCurrentPage(page);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">PYQ's</h3>
      </div>

      <Tabs value={activeType} onValueChange={setActiveType}>
        <TabsList>
          {PYQ_TYPES.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>

        {PYQ_TYPES.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
              </div>
            ) : !questions.length ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No {t.label.toLowerCase()} questions available yet.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                <div
                  key={currentPage}
                  className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300"
                >
                  {questions.map((q, idx) => (
                    <Card key={q.id}>
                      <CardContent className="py-3 px-4">
                        <div className="text-sm font-medium leading-relaxed">
                          <span className="text-primary font-semibold mr-1">
                            Q{(currentPage - 1) * 10 + idx + 1}.
                          </span>
                          <MathText text={q.question_text} />
                        </div>
                        {q.question_image_url && (
                          <img src={q.question_image_url} alt="Question" className="mt-2 max-h-48 rounded border object-contain" />
                        )}
                        {q.question_format === "mcq" && q.options && (
                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {Object.entries(q.options).map(([key, val]) => (
                              <div key={key} className="flex items-start gap-2 p-2 rounded-md bg-muted/50 text-sm">
                                <span className="font-semibold text-primary shrink-0">{key}.</span>
                                <MathText text={getOptionText(val)} />
                              </div>
                            ))}
                          </div>
                        )}
                        {q.question_format === "true_false" && (
                          <div className="mt-2 flex gap-2">
                            <div className="p-2 rounded-md bg-muted/50 text-sm px-4">True</div>
                            <div className="p-2 rounded-md bg-muted/50 text-sm px-4">False</div>
                          </div>
                        )}
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          <Badge variant="outline" className="text-xs capitalize">{q.question_format.replace("_", "/")}</Badge>
                          <DifficultyBadge level={q.difficulty} className="text-xs" />
                          <Badge variant="secondary" className="text-xs">{q.marks} mark{q.marks !== 1 ? "s" : ""}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex flex-col items-center gap-2 pt-2">
                  <p className="text-xs text-muted-foreground">
                    Page {currentPage} of {totalPages} • {totalCount} question{totalCount !== 1 ? "s" : ""}
                  </p>
                  {totalPages > 1 && (
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={(e) => {
                              e.preventDefault();
                              handlePageChange(currentPage - 1);
                            }}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        {getPageWindow(currentPage, totalPages).map((p, i) =>
                          p === "ellipsis" ? (
                            <PaginationItem key={`e-${i}`}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          ) : (
                            <PaginationItem key={p}>
                              <PaginationLink
                                isActive={p === currentPage}
                                onClick={(e) => {
                                  e.preventDefault();
                                  handlePageChange(p);
                                }}
                                className="cursor-pointer"
                              >
                                {p}
                              </PaginationLink>
                            </PaginationItem>
                          )
                        )}
                        <PaginationItem>
                          <PaginationNext
                            onClick={(e) => {
                              e.preventDefault();
                              handlePageChange(currentPage + 1);
                            }}
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
