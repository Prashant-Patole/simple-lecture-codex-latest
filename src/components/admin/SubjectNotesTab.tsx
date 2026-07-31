import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  BookOpenText,
  CheckCircle2,
  ClipboardCopy,
  FileJson,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Square,
  WandSparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_DIRECT_URL } from "@/lib/supabaseUrl";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

interface SubjectNotesTabProps {
  subjectId: string;
  subjectName?: string;
  subjectSlug?: string;
}

interface ImportantQuestion {
  question_type: "mcq" | "normal";
  question_text: string;
}

const API_STORAGE_KEY = "ai_teaching_api_base";
const DEFAULT_API_BASE = "http://116.202.230.124:8000";
const PROXY_URL = `${SUPABASE_DIRECT_URL}/functions/v1/ai-teaching-proxy`;

const proxyFetch = (apiBase: string, path: string, init?: RequestInit) => {
  const base = apiBase.replace(/\/+$/, "");
  const url = `${PROXY_URL}?path=${encodeURIComponent(path)}&base=${encodeURIComponent(base)}`;
  return fetch(url, init);
};

const parseResponse = async (response: Response) => {
  const text = await response.text();
  let body: any = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    // Preserve upstream text errors.
  }
  if (!response.ok) {
    throw new Error(
      typeof body === "string"
        ? body
        : body?.detail || body?.error || body?.message || `Request failed (${response.status})`,
    );
  }
  return body;
};

const apiRequest = async (
  apiBase: string,
  path: string,
  method: "GET" | "POST" = "GET",
  body?: unknown,
) =>
  parseResponse(
    await proxyFetch(apiBase, path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }),
  );

const toApiFormat = (format?: string) => {
  if (["single_choice", "multiple_choice", "mcq"].includes(format || "")) return "mcq";
  if (format === "true_false") return "true_false";
  if (format === "short_answer") return "short_answer";
  return "long_answer";
};

const toApiDifficulty = (difficulty?: string) => {
  const value = difficulty?.toLowerCase();
  if (value === "easy" || value === "low") return "Easy";
  if (value === "hard" || value === "advanced") return "Hard";
  return "Medium";
};

const extractContentMarkdown = (docRow: any, topic: any) => {
  const content = docRow?.full_content;
  const parsed = content && typeof content === "object" && !Array.isArray(content) ? content : null;
  return (
    parsed?.content_markdown ||
    parsed?.markdown ||
    parsed?.content ||
    parsed?.text ||
    (typeof content === "string" ? content : "") ||
    topic?.content_markdown ||
    topic?.notes_markdown ||
    ""
  );
};

const findDocumentId = (value: any): string | null => {
  if (!value || typeof value !== "object") return null;
  for (const key of ["document_id", "doc_id", "id"]) {
    if (typeof value[key] === "string" && value[key]) return value[key];
  }
  for (const key of ["document", "result", "data"]) {
    const nested = findDocumentId(value[key]);
    if (nested) return nested;
  }
  return null;
};

const JsonView = ({ value, empty = "No data loaded." }: { value: unknown; empty?: string }) => (
  <ScrollArea className="h-[440px] rounded-md border bg-slate-950">
    <pre className="p-4 text-xs text-slate-100 whitespace-pre-wrap break-words">
      {value ? JSON.stringify(value, null, 2) : empty}
    </pre>
  </ScrollArea>
);

export function SubjectNotesTab({
  subjectId,
  subjectName,
  subjectSlug,
}: SubjectNotesTabProps) {
  const [chapterId, setChapterId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [apiBase, setApiBase] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_API_BASE;
    return localStorage.getItem(API_STORAGE_KEY) || DEFAULT_API_BASE;
  });
  const [payloadText, setPayloadText] = useState("");
  const [payloadEdited, setPayloadEdited] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [generationResult, setGenerationResult] = useState<any>(null);
  const [statusResult, setStatusResult] = useState<any>(null);
  const [documentNotes, setDocumentNotes] = useState<any>(null);
  const [chapterNotes, setChapterNotes] = useState<any>(null);
  const [topicNotes, setTopicNotes] = useState<any>(null);
  const [documentsResult, setDocumentsResult] = useState<any>(null);
  const [batchStatus, setBatchStatus] = useState<any>(null);
  const [logsResult, setLogsResult] = useState<any>(null);
  const [logName, setLogName] = useState("notes");
  const [logTail, setLogTail] = useState("200");

  useEffect(() => {
    localStorage.setItem(API_STORAGE_KEY, apiBase);
  }, [apiBase]);

  const { data: chapters = [], isLoading: chaptersLoading } = useQuery({
    queryKey: ["subject-notes-chapters", subjectId],
    enabled: !!subjectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subject_chapters")
        .select("id, chapter_number, title")
        .eq("subject_id", subjectId)
        .order("chapter_number", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: topics = [], isLoading: topicsLoading } = useQuery({
    queryKey: ["subject-notes-topics", chapterId],
    enabled: !!chapterId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subject_topics")
        .select("id, topic_number, title, content_markdown, notes_markdown")
        .eq("chapter_id", chapterId)
        .order("topic_number", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const selectedChapter = chapters.find((chapter: any) => chapter.id === chapterId);
  const selectedTopic = topics.find((topic: any) => topic.id === topicId);

  const {
    data: docRow,
    isLoading: documentLoading,
  } = useQuery({
    queryKey: ["subject-notes-document", topicId],
    enabled: !!topicId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_assistant_documents")
        .select("id, display_name, source_type, source_url, status, created_at, full_content")
        .eq("topic_id", topicId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const {
    data: questions = [],
    isLoading: questionsLoading,
  } = useQuery({
    queryKey: ["subject-notes-questions", topicId],
    enabled: !!topicId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id, question_text, question_format, options, correct_answer, difficulty, marks")
        .eq("topic_id", topicId);
      if (error) throw error;
      return data || [];
    },
  });

  const contentMarkdown = useMemo(
    () => extractContentMarkdown(docRow, selectedTopic),
    [docRow, selectedTopic],
  );

  const importantQuery = useQuery({
    queryKey: ["subject-notes-important-pyqs", subjectId, chapterId, topicId],
    enabled:
      !!subjectId &&
      !!chapterId &&
      !!topicId &&
      !documentLoading &&
      !questionsLoading,
    staleTime: 30 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("allocate-topic-pyqs", {
        body: {
          subject_id: subjectId,
          chapter_id: chapterId,
          chapter_title: selectedChapter?.title,
          topic_id: topicId,
          topic_title: selectedTopic?.title,
          content_markdown: contentMarkdown,
          questions: questions.map((question: any) => ({
            question_text: question.question_text,
          })),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as {
        important_questions: ImportantQuestion[];
        allocated_count: number;
        newly_allocated_count: number;
        candidates_checked: number;
        model?: string;
      };
    },
  });

  const payload = useMemo(() => {
    if (!selectedChapter || !selectedTopic) return null;
    const parsed =
      docRow?.full_content &&
      typeof docRow.full_content === "object" &&
      !Array.isArray(docRow.full_content)
        ? docRow.full_content
        : {};
    return {
      subject: {
        id: subjectId,
        name: subjectName || "",
        slug: subjectSlug || "",
      },
      chapter: {
        id: selectedChapter.id,
        chapter_number: selectedChapter.chapter_number,
        title: selectedChapter.title,
      },
      topic: {
        id: selectedTopic.id,
        topic_number: selectedTopic.topic_number,
        title: selectedTopic.title,
      },
      ...(docRow || contentMarkdown
        ? {
            document: {
              id: docRow?.id,
              display_name: docRow?.display_name || `${selectedTopic.title}.md`,
              source_type: docRow?.source_type || "markdown",
              source_url: docRow?.source_url,
              status: docRow?.status,
              created_at: docRow?.created_at,
              parsed_json: {
                ...parsed,
                content_markdown: contentMarkdown,
              },
            },
          }
        : {}),
      questions: questions.map((question: any) => ({
        id: question.id,
        question_text: question.question_text,
        question_format: toApiFormat(question.question_format),
        options: question.options || {},
        correct_answer: question.correct_answer || "",
        difficulty: toApiDifficulty(question.difficulty),
        marks: question.marks || 1,
      })),
      important_questions: importantQuery.data?.important_questions || [],
    };
  }, [
    selectedChapter,
    selectedTopic,
    subjectId,
    subjectName,
    subjectSlug,
    docRow,
    contentMarkdown,
    questions,
    importantQuery.data,
  ]);

  const serializedPayload = useMemo(
    () => (payload ? JSON.stringify(payload, null, 2) : ""),
    [payload],
  );

  useEffect(() => {
    setPayloadEdited(false);
    setPayloadText("");
    setGenerationResult(null);
    setStatusResult(null);
    setDocumentNotes(null);
    setChapterNotes(null);
    setTopicNotes(null);
  }, [chapterId, topicId]);

  useEffect(() => {
    if (!payloadEdited) setPayloadText(serializedPayload);
  }, [serializedPayload, payloadEdited]);

  const runAction = async (name: string, action: () => Promise<void>) => {
    setBusyAction(name);
    try {
      await action();
    } catch (error: any) {
      toast({
        title: "Notes request failed",
        description: error?.message || String(error),
        variant: "destructive",
      });
    } finally {
      setBusyAction("");
    }
  };

  const documentId = findDocumentId(generationResult) || docRow?.id || null;

  const importAndGenerate = () =>
    runAction("generate", async () => {
      if (!topicId || !payloadText) throw new Error("Select a chapter and topic first");
      let body: any;
      try {
        body = JSON.parse(payloadText);
      } catch {
        throw new Error("The payload JSON is invalid");
      }
      const importResult = await apiRequest(apiBase, "/questions/import", "POST", body);
      const importedDocumentId = findDocumentId(importResult) || body?.document?.id;
      if (!importedDocumentId) {
        throw new Error("Question import succeeded but no document ID was available");
      }
      const generated = await apiRequest(
        apiBase,
        `/notes/generate/${encodeURIComponent(importedDocumentId)}`,
        "POST",
      );
      setGenerationResult({ import: importResult, generation: generated, document_id: importedDocumentId });
      setStatusResult(null);
      toast({ title: "Notes generation queued", description: generated?.message || importedDocumentId });
    });

  const refreshStatus = () =>
    runAction("status", async () => {
      if (!documentId) throw new Error("No document ID is available");
      setStatusResult(
        await apiRequest(apiBase, `/notes/status/${encodeURIComponent(documentId)}`),
      );
    });

  const retryGeneration = () =>
    runAction("retry", async () => {
      if (!documentId) throw new Error("No document ID is available");
      const result = await apiRequest(
        apiBase,
        `/notes/retry/${encodeURIComponent(documentId)}`,
        "POST",
      );
      setGenerationResult((current: any) => ({ ...current, retry: result }));
      await refreshStatus();
    });

  const resetGeneration = () =>
    runAction("reset", async () => {
      if (!documentId) throw new Error("No document ID is available");
      const result = await apiRequest(
        apiBase,
        `/notes/reset/${encodeURIComponent(documentId)}`,
        "POST",
      );
      setGenerationResult({ reset: result, document_id: documentId });
      setStatusResult(null);
      setDocumentNotes(null);
      setChapterNotes(null);
      setTopicNotes(null);
    });

  const loadGeneratedNotes = () =>
    runAction("load-notes", async () => {
      if (!chapterId) throw new Error("Select a chapter first");
      const [chapterData, documentData, documentsData] = await Promise.all([
        apiRequest(apiBase, `/notes/chapter/${encodeURIComponent(chapterId)}`),
        documentId
          ? apiRequest(apiBase, `/notes/document/${encodeURIComponent(documentId)}`)
          : Promise.resolve(null),
        apiRequest(
          apiBase,
          `/notes/documents?subject_id=${encodeURIComponent(subjectId)}`,
        ),
      ]);
      setChapterNotes(chapterData);
      setDocumentNotes(documentData);
      setDocumentsResult(documentsData);
      const topicSummary = chapterData?.topics?.find(
        (item: any) => item.topic_id === topicId,
      );
      if (topicSummary?.topic_note_id) {
        setTopicNotes(
          await apiRequest(
            apiBase,
            `/notes/topic/${encodeURIComponent(topicSummary.topic_note_id)}`,
          ),
        );
      }
    });

  const loadBatchStatus = () =>
    runAction("batch-status", async () => {
      setBatchStatus(await apiRequest(apiBase, "/notes/batch/status"));
    });

  const startBatch = () =>
    runAction("batch-start", async () => {
      setBatchStatus(
        await apiRequest(apiBase, "/notes/batch/start", "POST", {
          subject_id: subjectId,
          delay_ms: 2000,
          reset_stuck: true,
        }),
      );
    });

  const stopBatch = () =>
    runAction("batch-stop", async () => {
      setBatchStatus(await apiRequest(apiBase, "/notes/batch/stop", "POST"));
    });

  const loadLogs = () =>
    runAction("logs", async () => {
      setLogsResult(
        await apiRequest(
          apiBase,
          `/notes/logs?name=${encodeURIComponent(logName)}&tail=${encodeURIComponent(logTail)}`,
        ),
      );
    });

  const dataLoading = documentLoading || questionsLoading || importantQuery.isLoading;

  return (
    <div className="space-y-6">
      <Card className="border-emerald-200/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpenText className="h-5 w-5 text-emerald-600" />
            Notes Generation
          </CardTitle>
          <CardDescription>
            Select a chapter and topic to assemble parsed textbook content, normal questions,
            and context-matched PYQs into the Notes import payload.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Chapter</Label>
              <Select
                value={chapterId}
                onValueChange={(value) => {
                  setChapterId(value);
                  setTopicId("");
                }}
                disabled={chaptersLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select chapter" />
                </SelectTrigger>
                <SelectContent>
                  {chapters.map((chapter: any) => (
                    <SelectItem key={chapter.id} value={chapter.id}>
                      {chapter.chapter_number}. {chapter.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Topic</Label>
              <Select
                value={topicId}
                onValueChange={setTopicId}
                disabled={!chapterId || topicsLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select topic" />
                </SelectTrigger>
                <SelectContent>
                  {topics.map((topic: any) => (
                    <SelectItem key={topic.id} value={topic.id}>
                      {topic.topic_number} {topic.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes API base URL</Label>
            <Input value={apiBase} onChange={(event) => setApiBase(event.target.value)} />
          </div>

          {topicId && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">Parsed document</div>
                <div className="mt-1 font-semibold">
                  {documentLoading ? "Loading..." : docRow ? "Available" : "Not found"}
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">Normal questions</div>
                <div className="mt-1 font-semibold">
                  {questionsLoading ? "Loading..." : questions.length}
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">Relevant PYQs</div>
                <div className="mt-1 flex items-center gap-2 font-semibold">
                  {importantQuery.isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : importantQuery.isError ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    importantQuery.data?.allocated_count || 0
                  )}
                  {!importantQuery.isLoading && importantQuery.data && (
                    <Badge variant="outline">
                      +{importantQuery.data.newly_allocated_count} allocated
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          {importantQuery.isError && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <span>{(importantQuery.error as Error)?.message || "Unable to match PYQs"}</span>
              <Button variant="outline" size="sm" onClick={() => importantQuery.refetch()}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {topicId && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileJson className="h-5 w-5" />
                  Import Payload
                </CardTitle>
                <CardDescription>
                  Important questions contain only type and question text, without answers or marks.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(payloadText);
                    toast({ title: "Payload copied" });
                  }}
                  disabled={!payloadText}
                >
                  <ClipboardCopy className="mr-2 h-4 w-4" />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  onClick={() => importantQuery.refetch()}
                  disabled={importantQuery.isFetching}
                >
                  {importantQuery.isFetching ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <WandSparkles className="mr-2 h-4 w-4" />
                  )}
                  Re-match PYQs
                </Button>
                <Button onClick={importAndGenerate} disabled={dataLoading || busyAction === "generate"}>
                  {busyAction === "generate" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Import & Generate
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              className="min-h-[420px] font-mono text-xs"
              value={payloadText}
              onChange={(event) => {
                setPayloadText(event.target.value);
                setPayloadEdited(true);
              }}
              placeholder="Payload will appear after data is loaded"
            />
          </CardContent>
        </Card>
      )}

      {(generationResult || documentId) && (
        <Card>
          <CardHeader>
            <CardTitle>Generation Controls</CardTitle>
            <CardDescription>
              Document: <span className="font-mono">{documentId || "unknown"}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={refreshStatus} disabled={!!busyAction}>
                {busyAction === "status" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh status
              </Button>
              <Button variant="outline" onClick={retryGeneration} disabled={!!busyAction}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Retry failed topics
              </Button>
              <Button variant="destructive" onClick={resetGeneration} disabled={!!busyAction}>
                <Square className="mr-2 h-4 w-4" />
                Reset notes
              </Button>
              <Button onClick={loadGeneratedNotes} disabled={!!busyAction}>
                {busyAction === "load-notes" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <BookOpenText className="mr-2 h-4 w-4" />
                )}
                Load generated notes
              </Button>
            </div>
            {statusResult && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <Badge>{statusResult.document_status || statusResult.status || "unknown"}</Badge>
                <span className="text-sm">
                  Done {statusResult.topics_done || 0} / Pending {statusResult.topics_pending || 0}
                  {" / "}Failed {statusResult.topics_failed || 0}
                </span>
              </div>
            )}
            <JsonView value={{ generation: generationResult, status: statusResult }} />
          </CardContent>
        </Card>
      )}

      {(chapterNotes || documentNotes || topicNotes || documentsResult) && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Notes Data</CardTitle>
            <CardDescription>
              Complete API responses for the selected topic, document, chapter, and subject.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="topic">
              <TabsList className="flex h-auto flex-wrap">
                <TabsTrigger value="topic">Topic</TabsTrigger>
                <TabsTrigger value="document">Document</TabsTrigger>
                <TabsTrigger value="chapter">Chapter</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
              </TabsList>
              <TabsContent value="topic"><JsonView value={topicNotes} /></TabsContent>
              <TabsContent value="document"><JsonView value={documentNotes} /></TabsContent>
              <TabsContent value="chapter"><JsonView value={chapterNotes} /></TabsContent>
              <TabsContent value="documents"><JsonView value={documentsResult} /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Batch Operations & Logs</CardTitle>
          <CardDescription>
            Run the documented subject batch processor and inspect Notes service logs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Button onClick={startBatch} disabled={!!busyAction}>
              <Play className="mr-2 h-4 w-4" />
              Start subject batch
            </Button>
            <Button variant="destructive" onClick={stopBatch} disabled={!!busyAction}>
              <Square className="mr-2 h-4 w-4" />
              Stop batch
            </Button>
            <Button variant="outline" onClick={loadBatchStatus} disabled={!!busyAction}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Batch status
            </Button>
          </div>
          {batchStatus && <JsonView value={batchStatus} />}

          <div className="grid gap-3 md:grid-cols-[180px_140px_auto]">
            <Select value={logName} onValueChange={setLogName}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["uploads", "notes", "pregen", "errors"].map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={1}
              max={2000}
              value={logTail}
              onChange={(event) => setLogTail(event.target.value)}
            />
            <Button variant="outline" onClick={loadLogs} disabled={!!busyAction}>
              {busyAction === "logs" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Load logs
            </Button>
          </div>
          {logsResult && <JsonView value={logsResult} />}
        </CardContent>
      </Card>
    </div>
  );
}
