import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BookOpenText,
  CheckCircle2,
  ClipboardCopy,
  FileJson,
  ListChecks,
  Loader2,
  PauseCircle,
  Play,
  PlayCircle,
  Presentation,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { ImportantNotesPresentation } from "@/components/learning/notes/ImportantNotesTab";
import type { ImportantTopicNotes } from "@/hooks/useImportantNotes";

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

const safeJsonStringify = (value: unknown) => {
  const depths = new WeakMap<object, number>();
  const seen = new WeakSet<object>();
  return JSON.stringify(
    value,
    function (_key, nestedValue) {
      if (!nestedValue || typeof nestedValue !== "object") return nestedValue;
      if (seen.has(nestedValue)) return "[Circular data omitted]";
      const parentDepth = this && typeof this === "object" ? depths.get(this) || 0 : 0;
      if (parentDepth >= 8) return "[Deeply nested data omitted]";
      seen.add(nestedValue);
      depths.set(nestedValue, parentDepth + 1);
      return nestedValue;
    },
    2,
  );
};

const jobStatusLabel = (status: string) => {
  if (status === "submitted") return "Completed";
  if (status === "processing") return "Generating";
  if (status === "queued") return "Queued";
  if (status === "failed") return "Failed";
  if (status === "stopped") return "Stopped";
  return status;
};

const getPresentationTopic = (job: any): ImportantTopicNotes | null => {
  const storedTopics = Array.isArray(job?.final_response?.topics) ? job.final_response.topics : [];
  const response = storedTopics.find((item: any) => item?.response)?.response;
  if (!response || typeof response !== "object") return null;
  const answers = Array.isArray(response.question_answers) ? response.question_answers : [];
  const questions = Array.isArray(response.questions) && response.questions.length > 0
    ? response.questions
    : answers.map((answer: any, index: number) => ({
        id: answer.question_id || `generated-question-${index}`,
        question_text: answer.question_text || `Question ${index + 1}`,
        question_format: answer.format || "long_answer",
        difficulty: answer.difficulty,
      }));
  return {
    ...response,
    topic_note_id: response.topic_note_id || storedTopics[0]?.topic_note_id || job.id,
    topic_id: response.topic_id || job.topic_id,
    topic_number: response.topic_number || job.topic_number,
    topic_title: response.topic_title || job.topic_title,
    questions,
    question_answers: answers,
  } as ImportantTopicNotes;
};

const JsonView = ({ value, empty = "No data loaded." }: { value: unknown; empty?: string }) => (
  <ScrollArea className="h-[440px] rounded-md border bg-slate-950">
    <pre className="p-4 text-xs text-slate-100 whitespace-pre-wrap break-words">
      {value ? safeJsonStringify(value) : empty}
    </pre>
  </ScrollArea>
);

export function SubjectNotesTab({
  subjectId,
  subjectName,
  subjectSlug,
}: SubjectNotesTabProps) {
  const queryClient = useQueryClient();
  const [chapterId, setChapterId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [pipelineTopicIds, setPipelineTopicIds] = useState<string[]>([]);
  const [jobsOpen, setJobsOpen] = useState(false);
  const [presentationJob, setPresentationJob] = useState<any>(null);
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

  useEffect(() => {
    setPipelineTopicIds([]);
  }, [subjectId]);

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
      const list = data || [];
      return [...list].sort((a: any, b: any) =>
        String(a.topic_number || "").localeCompare(String(b.topic_number || ""), undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
    },
  });

  const pipelineRunsQuery = useQuery({
    queryKey: ["notes-auto-pipeline-runs", subjectId],
    enabled: !!subjectId,
    refetchInterval: 3000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes_auto_pipeline_runs" as any)
        .select("*")
        .eq("subject_id", subjectId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const pipelineJobsQuery = useQuery({
    queryKey: ["notes-auto-pipeline-jobs", subjectId],
    enabled: !!subjectId,
    // Keep polling while on this tab so Pause/Resume controls stay accurate after revisit.
    refetchInterval: 3000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes_auto_pipeline_items" as any)
        .select("*, run:notes_auto_pipeline_runs!inner(id, status, api_base, created_at, completed_at, error_message)")
        .eq("subject_id", subjectId)
        .order("created_at", { ascending: false })
        .order("sequence_order", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const activePipelineRun = pipelineRunsQuery.data?.find(
    (run: any) => run.status === "running" || run.status === "paused",
  );
  const isPipelinePaused = activePipelineRun?.status === "paused";
  const latestPipelineRun = pipelineRunsQuery.data?.[0];
  // Prefer the live run so revisiting the page always shows the active pipeline, not a stale finished one.
  const displayPipelineRun = activePipelineRun || latestPipelineRun;
  const activePipelineJobs = useMemo(() => {
    if (!activePipelineRun?.id || !pipelineJobsQuery.data) return [];
    return pipelineJobsQuery.data.filter((job: any) => job.run_id === activePipelineRun.id);
  }, [activePipelineRun?.id, pipelineJobsQuery.data]);
  const currentPipelineJob =
    activePipelineJobs.find((job: any) => job.status === "processing") ||
    activePipelineJobs.find((job: any) => job.status === "queued");

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

  const documentId = findDocumentId(generationResult);

  const importAndGenerate = () =>
    runAction("generate", async () => {
      if (!topicId || !payloadText) throw new Error("Select a chapter and topic first");
      let body: any;
      try {
        body = JSON.parse(payloadText);
      } catch {
        throw new Error("The payload JSON is invalid");
      }
      let importResult: any;
      try {
        importResult = await apiRequest(apiBase, "/documents/import-json", "POST", body);
      } catch (error: any) {
        throw new Error(`Document import failed: ${error?.message || String(error)}`);
      }
      const importedDocumentId = findDocumentId(importResult) || body?.document?.id;
      if (!importedDocumentId) {
        throw new Error("Document import succeeded but no document ID was available");
      }
      setGenerationResult({ import: importResult, document_id: importedDocumentId });
      let generated: any;
      try {
        generated = await apiRequest(
          apiBase,
          `/notes/generate/${encodeURIComponent(importedDocumentId)}`,
          "POST",
        );
      } catch (error: any) {
        throw new Error(`Notes generation failed: ${error?.message || String(error)}`);
      }
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
      setStatusResult(
        await apiRequest(apiBase, `/notes/status/${encodeURIComponent(documentId)}`),
      );
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

  const togglePipelineTopic = (selectedTopicId: string) => {
    setPipelineTopicIds((current) =>
      current.includes(selectedTopicId)
        ? current.filter((id) => id !== selectedTopicId)
        : [...current, selectedTopicId],
    );
  };

  const selectCurrentChapterTopics = () => {
    setPipelineTopicIds((current) => [
      ...current,
      ...topics
        .map((topic: any) => topic.id)
        .filter((currentTopicId: string) => !current.includes(currentTopicId)),
    ]);
  };

  const clearCurrentChapterTopics = () => {
    const currentChapterTopicIds = new Set(topics.map((topic: any) => topic.id));
    setPipelineTopicIds((current) =>
      current.filter((selectedTopicId) => !currentChapterTopicIds.has(selectedTopicId)),
    );
  };

  const startSelectedTopicsPipeline = () =>
    runAction("auto-pipeline-start", async () => {
      if (pipelineTopicIds.length === 0) throw new Error("Select at least one topic");
      const { data, error } = await supabase.functions.invoke("notes-auto-pipeline", {
        body: {
          action: "start",
          subject_id: subjectId,
          topic_ids: pipelineTopicIds,
          api_base: apiBase,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPipelineTopicIds([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notes-auto-pipeline-runs", subjectId] }),
        queryClient.invalidateQueries({ queryKey: ["notes-auto-pipeline-jobs", subjectId] }),
      ]);
      toast({
        title: "Server pipeline started",
        description: data?.message || `${pipelineTopicIds.length} topics queued.`,
      });
    });

  const pauseSelectedTopicsPipeline = () =>
    runAction("auto-pipeline-pause", async () => {
      if (!activePipelineRun?.id) throw new Error("No Notes pipeline is currently active");
      const runId = activePipelineRun.id;
      const { data, error } = await supabase.functions.invoke("notes-auto-pipeline", {
        body: {
          action: "pause",
          run_id: runId,
          subject_id: subjectId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      // Optimistic UI update so Resume appears immediately after a successful pause.
      queryClient.setQueryData(["notes-auto-pipeline-runs", subjectId], (current: any) => {
        if (!Array.isArray(current)) return current;
        return current.map((run: any) =>
          run.id === runId
            ? { ...run, status: "paused", updated_at: new Date().toISOString() }
            : run,
        );
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notes-auto-pipeline-runs", subjectId] }),
        queryClient.invalidateQueries({ queryKey: ["notes-auto-pipeline-jobs", subjectId] }),
      ]);
      toast({
        title: "Pipeline paused",
        description: "Current in-progress job will finish generation, but next jobs will not be submitted until resumed.",
      });
    });

  const resumeSelectedTopicsPipeline = () =>
    runAction("auto-pipeline-resume", async () => {
      if (!activePipelineRun?.id) throw new Error("No Notes pipeline is currently active");
      const runId = activePipelineRun.id;
      const { data, error } = await supabase.functions.invoke("notes-auto-pipeline", {
        body: {
          action: "resume",
          run_id: runId,
          subject_id: subjectId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      queryClient.setQueryData(["notes-auto-pipeline-runs", subjectId], (current: any) => {
        if (!Array.isArray(current)) return current;
        return current.map((run: any) =>
          run.id === runId
            ? { ...run, status: "running", updated_at: new Date().toISOString() }
            : run,
        );
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notes-auto-pipeline-runs", subjectId] }),
        queryClient.invalidateQueries({ queryKey: ["notes-auto-pipeline-jobs", subjectId] }),
      ]);
      toast({
        title: "Pipeline resumed",
        description: "Queued jobs will now resume submitting one by one.",
      });
    });

  const stopSelectedTopicsPipeline = () =>
    runAction("auto-pipeline-stop", async () => {
      if (!activePipelineRun?.id) throw new Error("No Notes pipeline is currently running");
      const { data, error } = await supabase.functions.invoke("notes-auto-pipeline", {
        body: {
          action: "stop",
          run_id: activePipelineRun.id,
          subject_id: subjectId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notes-auto-pipeline-runs", subjectId] }),
        queryClient.invalidateQueries({ queryKey: ["notes-auto-pipeline-jobs", subjectId] }),
      ]);
      toast({ title: "Pipeline stopped", description: "Queued topics will not be submitted." });
    });

  const dataLoading = documentLoading || questionsLoading || importantQuery.isLoading;
  const pipelineProgress = displayPipelineRun?.total_items
    ? Math.round((Number(displayPipelineRun.completed_items || 0) / Number(displayPipelineRun.total_items)) * 100)
    : 0;

  const pipelineControlButtons = (
    <div className="flex flex-wrap gap-2">
      {activePipelineRun ? (
        isPipelinePaused ? (
          <Button
            onClick={resumeSelectedTopicsPipeline}
            disabled={busyAction === "auto-pipeline-resume"}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            {busyAction === "auto-pipeline-resume" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="mr-2 h-4 w-4" />
            )}
            Resume pipeline
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={pauseSelectedTopicsPipeline}
            disabled={busyAction === "auto-pipeline-pause"}
            className="border-amber-500/60 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-600 font-medium"
          >
            {busyAction === "auto-pipeline-pause" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PauseCircle className="mr-2 h-4 w-4 text-amber-600 dark:text-amber-400" />
            )}
            Pause pipeline
          </Button>
        )
      ) : null}

      <Button
        variant="destructive"
        onClick={stopSelectedTopicsPipeline}
        disabled={!activePipelineRun || busyAction === "auto-pipeline-stop"}
      >
        {busyAction === "auto-pipeline-stop" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Square className="mr-2 h-4 w-4" />
        )}
        Stop pipeline
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card className="border-emerald-200/70">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpenText className="h-5 w-5 text-emerald-600" />
                Notes Generation
              </CardTitle>
              <CardDescription className="mt-1">
                Select a chapter and topic to inspect one payload, or queue multiple topics below.
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => setJobsOpen(true)}>
              <ListChecks className="mr-2 h-4 w-4" />
              View all jobs
              {!!pipelineJobsQuery.data?.length && (
                <Badge variant="secondary" className="ml-2">
                  {pipelineJobsQuery.data.length}
                </Badge>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {displayPipelineRun && (
            <div
              className={`space-y-3 rounded-xl border p-4 ${
                activePipelineRun
                  ? isPipelinePaused
                    ? "border-amber-300 bg-amber-50/70"
                    : "border-emerald-300 bg-emerald-50/70"
                  : "border-border bg-muted/30"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-foreground">
                      {activePipelineRun
                        ? isPipelinePaused
                          ? "Notes pipeline is paused"
                          : "Notes pipeline is running"
                        : "Latest Notes pipeline"}
                    </h3>
                    <Badge
                      variant={
                        displayPipelineRun.status === "failed"
                          ? "destructive"
                          : displayPipelineRun.status === "completed"
                            ? "default"
                            : displayPipelineRun.status === "paused"
                              ? "outline"
                              : "secondary"
                      }
                      className={
                        displayPipelineRun.status === "paused"
                          ? "border-amber-500 text-amber-700 bg-amber-50"
                          : displayPipelineRun.status === "running"
                            ? "bg-emerald-600 text-white hover:bg-emerald-600"
                            : ""
                      }
                    >
                      {displayPipelineRun.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {displayPipelineRun.completed_items}/{displayPipelineRun.total_items} completed
                    </span>
                  </div>
                  {currentPipelineJob && (
                    <p className="text-sm text-muted-foreground">
                      {currentPipelineJob.status === "processing" ? "Generating now:" : "Next up:"}{" "}
                      <span className="font-medium text-foreground">
                        {currentPipelineJob.topic_number ? `${currentPipelineJob.topic_number} · ` : ""}
                        {currentPipelineJob.topic_title}
                      </span>
                    </p>
                  )}
                  {displayPipelineRun.error_message && (
                    <p className="text-sm text-destructive">{displayPipelineRun.error_message}</p>
                  )}
                  {isPipelinePaused && (
                    <p className="text-xs font-medium text-amber-700">
                      Click Resume pipeline to continue submitting the remaining queued topics.
                    </p>
                  )}
                </div>
                {activePipelineRun ? pipelineControlButtons : null}
              </div>
              <Progress value={pipelineProgress} className="h-2" />
              {isPipelinePaused && (
                <Button
                  onClick={resumeSelectedTopicsPipeline}
                  disabled={busyAction === "auto-pipeline-resume"}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium sm:w-auto"
                >
                  {busyAction === "auto-pipeline-resume" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PlayCircle className="mr-2 h-4 w-4" />
                  )}
                  Resume paused pipeline
                </Button>
              )}
            </div>
          )}

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

          {chapterId && (
            <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-emerald-950">Selected-topic auto pipeline</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Topics run sequentially on Supabase. The queue stops immediately if an import or
                    generation request does not return HTTP 200.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectCurrentChapterTopics}
                    disabled={topics.length === 0 || !!activePipelineRun}
                  >
                    Select all
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearCurrentChapterTopics}
                    disabled={
                      !topics.some((topic: any) => pipelineTopicIds.includes(topic.id)) ||
                      !!activePipelineRun
                    }
                  >
                    Clear chapter
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPipelineTopicIds([])}
                    disabled={pipelineTopicIds.length === 0 || !!activePipelineRun}
                  >
                    Clear all
                  </Button>
                </div>
              </div>

              <ScrollArea className="max-h-[600px] rounded-lg border bg-background">
                <div className="grid gap-1 p-2 sm:grid-cols-2">
                  {topics.map((topic: any) => (
                    <label
                      key={topic.id}
                      className="flex cursor-pointer items-start gap-3 rounded-md p-3 hover:bg-muted/60"
                    >
                      <Checkbox
                        checked={pipelineTopicIds.includes(topic.id)}
                        onCheckedChange={() => togglePipelineTopic(topic.id)}
                        disabled={!!activePipelineRun}
                      />
                      <span className="text-sm leading-tight">
                        <strong className="mr-1">{topic.topic_number}</strong>
                        {topic.title}
                      </span>
                    </label>
                  ))}
                </div>
              </ScrollArea>

              {displayPipelineRun && (
                <div className="space-y-2 rounded-lg border bg-background p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          displayPipelineRun.status === "failed"
                            ? "destructive"
                            : displayPipelineRun.status === "completed"
                              ? "default"
                              : displayPipelineRun.status === "paused"
                                ? "outline"
                                : "secondary"
                        }
                        className={
                          displayPipelineRun.status === "paused"
                            ? "border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/50"
                            : ""
                        }
                      >
                        {displayPipelineRun.status}
                      </Badge>
                      <span>
                        {displayPipelineRun.completed_items}/{displayPipelineRun.total_items} completed
                      </span>
                    </div>
                    {displayPipelineRun.error_message && (
                      <span className="text-sm text-destructive">{displayPipelineRun.error_message}</span>
                    )}
                  </div>
                  <Progress value={pipelineProgress} className="h-2" />
                  {displayPipelineRun.status === "paused" && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium pt-1">
                      Pipeline is paused. The currently generating job will finish, but remaining queued jobs will not be submitted until you click Resume.
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-medium">
                  {pipelineTopicIds.length} topics selected across chapters
                </span>
                <div className="flex flex-wrap gap-2">
                  {pipelineControlButtons}
                  <Button
                    onClick={startSelectedTopicsPipeline}
                    disabled={
                      pipelineTopicIds.length === 0 ||
                      !!activePipelineRun ||
                      busyAction === "auto-pipeline-start"
                    }
                  >
                    {busyAction === "auto-pipeline-start" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="mr-2 h-4 w-4" />
                    )}
                    Start pipeline
                  </Button>
                </div>
              </div>
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
                  Submit and Generate
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

      <Dialog open={jobsOpen} onOpenChange={setJobsOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-5">
            <div className="flex items-start justify-between gap-4 pr-8">
              <div>
                <DialogTitle>All Notes jobs - {subjectName || "Subject"}</DialogTitle>
                <DialogDescription className="mt-1">
                  Every selected topic, the exact payload sent, HTTP statuses, and final API responses.
                </DialogDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {activePipelineRun ? pipelineControlButtons : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await supabase.functions.invoke("notes-auto-pipeline", {
                      body: { action: "tick" },
                    });
                    await Promise.all([
                      pipelineJobsQuery.refetch(),
                      pipelineRunsQuery.refetch(),
                    ]);
                  }}
                  disabled={pipelineJobsQuery.isFetching}
                >
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${pipelineJobsQuery.isFetching ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="h-[72vh] px-6 py-4">
            {pipelineJobsQuery.isLoading && (
              <div className="grid min-h-48 place-items-center">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              </div>
            )}
            {!pipelineJobsQuery.isLoading && !pipelineJobsQuery.data?.length && (
              <div className="grid min-h-48 place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">
                No Notes pipeline jobs have been submitted for this subject.
              </div>
            )}
            <div className="space-y-3 pb-4">
              {pipelineJobsQuery.data?.map((job: any) => {
                const progressStatus =
                  job.generation_response?.latest_status ||
                  job.generation_response?.final_status ||
                  null;
                const topicsDone = Number(progressStatus?.topics_done || 0);
                const topicsPending = Number(progressStatus?.topics_pending || 0);
                const topicsFailed = Number(progressStatus?.topics_failed || 0);
                const progressTotal = topicsDone + topicsPending + topicsFailed;
                const progressValue = progressTotal > 0 ? (topicsDone / progressTotal) * 100 : 0;
                return (
                <article key={job.id} className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            job.status === "failed"
                              ? "destructive"
                              : job.status === "submitted"
                                ? "default"
                                : "secondary"
                          }
                        >
                          {jobStatusLabel(job.status)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Run #{String(job.run_id).slice(0, 8)} / Item {job.sequence_order}
                        </span>
                      </div>
                      <h3 className="mt-2 font-semibold">
                        {job.chapter_number}. {job.chapter_title}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {job.topic_number} {job.topic_title}
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>{new Date(job.created_at).toLocaleString()}</div>
                      <div className="mt-1 font-mono">Document: {job.external_document_id || "pending"}</div>
                    </div>
                  </div>

                  {job.status === "processing" && (
                    <div className="mt-4 space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-blue-900">
                        <span className="flex items-center gap-2 font-medium">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Notes generation is in progress
                        </span>
                        <span>
                          Done {topicsDone} / Pending {topicsPending} / Failed {topicsFailed}
                        </span>
                      </div>
                      <Progress value={progressValue} className="h-2" />
                    </div>
                  )}

                  {job.status === "queued" && (
                    <div className="mt-4 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                      Waiting in queue. This topic starts after the current job completes.
                    </div>
                  )}

                  {job.status === "submitted" && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Job completed. The generated Notes response is available below.
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-emerald-800 text-white hover:bg-emerald-700"
                        disabled={!getPresentationTopic(job)}
                        onClick={() => {
                          setJobsOpen(false);
                          setPresentationJob(job);
                        }}
                      >
                        <Presentation className="mr-2 h-4 w-4" />
                        View presentation
                      </Button>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">
                      Import HTTP: {job.import_http_status ?? "-"}
                    </Badge>
                    <Badge variant="outline">
                      Generate HTTP: {job.generation_http_status ?? "-"}
                    </Badge>
                    <Badge variant="outline">Attempts: {job.attempts}</Badge>
                  </div>

                  {job.error_message && (
                    <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                      {job.error_message}
                    </div>
                  )}

                  <details className="mt-3 rounded-lg border bg-muted/20">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                      View payload, progress and generated response
                    </summary>
                    <div className="grid gap-3 border-t p-3 lg:grid-cols-2">
                      <div>
                        <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                          Submitted payload
                        </div>
                        <pre className="max-h-80 overflow-auto rounded-md bg-slate-950 p-3 text-[11px] text-slate-100 whitespace-pre-wrap break-words">
                          {job.payload ? safeJsonStringify(job.payload) : "Payload not built yet."}
                        </pre>
                      </div>
                      <div>
                        <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                          Import response
                        </div>
                        <pre className="max-h-80 overflow-auto rounded-md bg-slate-950 p-3 text-[11px] text-slate-100 whitespace-pre-wrap break-words">
                          {job.import_response
                            ? safeJsonStringify(job.import_response)
                            : "No import response yet."}
                        </pre>
                      </div>
                      <div>
                        <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                          Generation status
                        </div>
                        <pre className="max-h-80 overflow-auto rounded-md bg-slate-950 p-3 text-[11px] text-slate-100 whitespace-pre-wrap break-words">
                          {job.generation_response
                            ? safeJsonStringify(job.generation_response)
                            : "No generation response yet."}
                        </pre>
                      </div>
                      <div className="lg:col-span-2">
                        <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold uppercase text-muted-foreground">
                          <span>Complete generated Notes response</span>
                          <Badge variant="outline">
                            HTTP {job.final_response_http_status ?? "-"}
                          </Badge>
                        </div>
                        <pre className="max-h-[520px] overflow-auto rounded-md bg-slate-950 p-3 text-[11px] text-slate-100 whitespace-pre-wrap break-words">
                          {job.final_response
                            ? safeJsonStringify(job.final_response)
                            : job.status === "submitted"
                              ? "The completed response is being synchronized from the Notes server."
                              : "The generated response will appear here after the job completes."}
                        </pre>
                      </div>
                    </div>
                  </details>
                </article>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!presentationJob}
        onOpenChange={(open) => {
          if (!open) {
            setPresentationJob(null);
            setJobsOpen(true);
          }
        }}
      >
        <DialogContent className="h-[96vh] w-[96vw] max-w-[1500px] overflow-hidden p-0">
          <DialogHeader className="border-b bg-emerald-950 px-6 py-4 text-white">
            <DialogTitle className="flex items-center gap-2 text-xl text-white">
              <Presentation className="h-5 w-5" />
              {presentationJob?.topic_number} {presentationJob?.topic_title}
            </DialogTitle>
            <DialogDescription className="text-emerald-100">
              Generated notes, illustrations, formulas, questions, answers, and memory tips.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[calc(96vh-86px)] bg-[#f4f0e4] p-4 sm:p-6">
            {presentationJob && getPresentationTopic(presentationJob) ? (
              <ImportantNotesPresentation topic={getPresentationTopic(presentationJob)!} />
            ) : (
              <div className="grid min-h-96 place-items-center text-sm text-muted-foreground">
                Presentation data is unavailable for this job.
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
