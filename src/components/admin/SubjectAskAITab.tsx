import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Send,
  Copy,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Pause,
  Play,
  LayoutDashboard,
  Layers,
  Square,
  CheckCircle2,
  XCircle,
  MinusCircle,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { SUPABASE_DIRECT_URL } from "@/lib/supabaseUrl";
import { AskAIJobsDashboard } from "./AskAIJobsDashboard";

interface Props {
  subjectId?: string;
  subjectName?: string;
  subjectSlug?: string;
}

const LS_KEY = "ai_teaching_api_base";
const DEFAULT_BASE = "http://116.202.230.124:8000";
const PROXY_URL = `${SUPABASE_DIRECT_URL}/functions/v1/ai-teaching-proxy`;
const POLL_MS = 3000;

// Wraps any upstream call through the edge-function proxy so the browser
// (HTTPS) can reach the plain-HTTP AI Teaching API without mixed-content errors.
const proxyFetch = (apiBase: string, path: string, init?: RequestInit) => {
  const url = `${PROXY_URL}?path=${encodeURIComponent(path)}&base=${encodeURIComponent(apiBase.replace(/\/+$/, ""))}`;
  return fetch(url, init);
};

const toApiFormat = (format?: string) => {
  switch (format) {
    case "single_choice":
    case "multiple_choice":
    case "mcq":
      return "mcq";
    case "true_false":
      return "true_false";
    case "short_answer":
      return "short_answer";
    case "subjective":
    case "long_answer":
      return "long_answer";
    default:
      return "mcq";
  }
};

const toApiDifficulty = (difficulty?: string) => {
  const value = difficulty?.toLowerCase();
  if (value === "low" || value === "easy") return "Easy";
  if (value === "hard" || value === "advanced") return "Hard";
  if (value === "medium" || value === "intermediate") return "Medium";
  return "Medium";
};
function extractContentMarkdown(docRow: any, topic: any) {
  const fc = docRow?.full_content;
  const parsedJson = fc && typeof fc === "object" && !Array.isArray(fc) ? fc : null;
  return (
    (parsedJson?.content_markdown as string) ||
    (parsedJson?.markdown as string) ||
    (parsedJson?.content as string) ||
    (parsedJson?.text as string) ||
    (typeof fc === "string" ? fc : "") ||
    topic?.content_markdown ||
    topic?.notes_markdown ||
    ""
  );
}

function buildAutoPayload({
  subject,
  chapter,
  topic,
  docRow,
  questions,
}: {
  subject: { id: string; name?: string; slug?: string };
  chapter: { id: string; chapter_number?: any; title?: string };
  topic: { id: string; topic_number?: any; title?: string; content_markdown?: string; notes_markdown?: string };
  docRow?: any;
  questions: any[];
}) {
  const fc = docRow?.full_content;
  const parsedJson = fc && typeof fc === "object" && !Array.isArray(fc) ? fc : null;
  const contentMarkdown = extractContentMarkdown(docRow, topic);
  const body: any = {
    subject: { id: subject.id, name: subject.name || "", slug: subject.slug || "" },
    chapter: { id: chapter.id, chapter_number: chapter.chapter_number, title: chapter.title },
    topic: { id: topic.id, topic_number: topic.topic_number, title: topic.title },
  };
  if (contentMarkdown || parsedJson || docRow) {
    body.document = {
      id: docRow?.id,
      display_name: docRow?.display_name || `${topic.title}.md`,
      source_type: docRow?.source_type || "markdown",
      source_url: docRow?.source_url,
      status: docRow?.status,
      created_at: docRow?.created_at,
      parsed_json: { ...(parsedJson ?? {}), content_markdown: contentMarkdown },
    };
  }
  body.questions = (questions || []).map((q) => ({
    id: q.id,
    question_text: q.question_text,
    question_format: toApiFormat(q.question_format),
    options: q.options ?? {},
    correct_answer: q.correct_answer ?? "",
    difficulty: toApiDifficulty(q.difficulty),
    marks: q.marks ?? 1,
  }));
  return body;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));


export function SubjectAskAITab({ subjectId, subjectName, subjectSlug }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") === "jobs" ? "jobs" : "form";
  const [chapterId, setChapterId] = useState<string>("");
  const [topicId, setTopicId] = useState<string>("");
  const [apiBase, setApiBase] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_BASE;
    const stored = localStorage.getItem(LS_KEY);
    // Migrate stale values: old GPU IP and localhost — proxy can't reach them.
    if (
      !stored ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(stored) ||
      /69\.197\.145\.4/.test(stored)
    ) {
      try { localStorage.setItem(LS_KEY, DEFAULT_BASE); } catch { /* ignore */ }
      return DEFAULT_BASE;
    }
    return stored;
  });
  const [payloadText, setPayloadText] = useState<string>("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // status polling state
  const [polling, setPolling] = useState(false);
  const [statusData, setStatusData] = useState<any>(null);
  const [jobData, setJobData] = useState<any>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const editedRef = useRef(false);
  const lastSelectionKeyRef = useRef("");

  // ── Bulk send state ──────────────────────────────────────────────
  type BulkMode = "single" | "selected" | "chapter" | "subject";
  const [bulkMode, setBulkMode] = useState<BulkMode>("single");
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(new Set());
  const [bulkDelayMs, setBulkDelayMs] = useState<number>(1500);
  type QueueItem = {
    topicId: string;
    topicTitle: string;
    topicNumber: any;
    chapterId: string;
    chapterTitle: string;
    chapterNumber: any;
    status: "pending" | "running" | "success" | "error" | "skipped";
    error?: string;
    jobId?: string;
  };
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueRunning, setQueueRunning] = useState(false);
  const [queuePaused, setQueuePaused] = useState(false);
  const [queueIndex, setQueueIndex] = useState<number>(-1);
  const pauseRef = useRef(false);
  const stopRef = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, apiBase);
    } catch {}
  }, [apiBase]);

  const { data: chapters = [] } = useQuery({
    queryKey: ["ask-ai-chapters", subjectId],
    enabled: !!subjectId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subject_chapters")
        .select("id, chapter_number, title")
        .eq("subject_id", subjectId!)
        .order("chapter_number", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: topics = [] } = useQuery({
    queryKey: ["ask-ai-topics", chapterId],
    enabled: !!chapterId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subject_topics")
        .select("id, topic_number, title, content_markdown, notes_markdown")
        .eq("chapter_id", chapterId)
        .order("topic_number", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const selectedChapter = chapters.find((c: any) => c.id === chapterId);
  const selectedTopic = topics.find((t: any) => t.id === topicId);

  const { data: docRow } = useQuery({
    queryKey: ["ask-ai-doc", topicId],
    enabled: !!topicId,
    staleTime: 5 * 60 * 1000,
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

  const { data: questions = [] } = useQuery({
    queryKey: ["ask-ai-questions", topicId],
    enabled: !!topicId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id, question_text, question_format, options, correct_answer, difficulty, marks")
        .eq("topic_id", topicId);
      if (error) throw error;
      return data ?? [];
    },
  });

  // `full_content` in ai_assistant_documents is jsonb — it IS the parsed_json blob.
  // Shapes seen: { content_markdown }, { markdown }, { content }, { text }, or plain string.
  const parsedJson = useMemo(() => {
    const fc: any = (docRow as any)?.full_content;
    if (fc && typeof fc === "object" && !Array.isArray(fc)) return fc;
    return null;
  }, [docRow]);

  const contentMarkdown = useMemo(() => {
    const fc: any = (docRow as any)?.full_content;
    return (
      (parsedJson?.content_markdown as string) ||
      (parsedJson?.markdown as string) ||
      (parsedJson?.content as string) ||
      (parsedJson?.text as string) ||
      (typeof fc === "string" ? fc : "") ||
      (selectedTopic as any)?.content_markdown ||
      (selectedTopic as any)?.notes_markdown ||
      ""
    );
  }, [selectedTopic, docRow, parsedJson]);

  const autoPayload = useMemo(() => {
    if (!subjectId || !selectedChapter || !selectedTopic) return null;
    return buildAutoPayload({
      subject: { id: subjectId, name: subjectName, slug: subjectSlug },
      chapter: selectedChapter as any,
      topic: selectedTopic as any,
      docRow,
      questions: questions as any[],
    });
  }, [subjectId, subjectName, subjectSlug, selectedChapter, selectedTopic, questions, docRow]);



  const serializedAutoPayload = useMemo(
    () => (autoPayload ? JSON.stringify(autoPayload, null, 2) : ""),
    [autoPayload],
  );

  // Reset textarea whenever the actual subject/chapter/topic selection changes
  useEffect(() => {
    const selectionKey = `${subjectId || ""}|${chapterId}|${topicId}`;
    if (selectionKey === lastSelectionKeyRef.current) return;
    lastSelectionKeyRef.current = selectionKey;
    editedRef.current = false;
    setPayloadText(serializedAutoPayload);
    setJsonError(null);
  }, [subjectId, chapterId, topicId, serializedAutoPayload]);

  // If async questions/document data arrives for the current selection, refresh only untouched payloads
  useEffect(() => {
    if (!editedRef.current) {
      setPayloadText(serializedAutoPayload);
      setJsonError(null);
    }
  }, [serializedAutoPayload]);

  // Live validate payload
  useEffect(() => {
    if (!payloadText.trim()) {
      setJsonError(null);
      return;
    }
    try {
      JSON.parse(payloadText);
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e?.message || "Invalid JSON");
    }
  }, [payloadText]);

  const resetPayload = () => {
    editedRef.current = false;
    setPayloadText(serializedAutoPayload);
    setJsonError(null);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(payloadText);
    toast({ title: "Payload copied" });
  };

  const fetchStatus = async () => {
    if (!subjectId) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const [pendingRes, jobRes] = await Promise.allSettled([
        proxyFetch(apiBase, `/pregen/pending-count?subject_id=${encodeURIComponent(subjectId)}`),
        proxyFetch(apiBase, `/pregen/status`),
      ]);
      if (pendingRes.status === "fulfilled" && pendingRes.value.ok) {
        setStatusData(await pendingRes.value.json());
        setStatusError(null);
      } else if (pendingRes.status === "fulfilled") {
        setStatusError(`pending-count ${pendingRes.value.status}`);
      } else {
        setStatusError(pendingRes.reason?.message || "Network error");
      }
      if (jobRes.status === "fulfilled" && jobRes.value.ok) {
        setJobData(await jobRes.value.json());
      } else if (jobRes.status === "fulfilled") {
        setStatusError(`pregen/status ${jobRes.value.status}`);
      }
    } finally {
      inFlightRef.current = false;
    }
  };

  // Polling loop
  useEffect(() => {
    if (!polling || !subjectId) return;
    fetchStatus();
    const t = setInterval(fetchStatus, POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling, subjectId, apiBase]);

  // Stop polling when the documented endpoints report no active job and no pending items
  useEffect(() => {
    if (!polling || !statusData || !jobData) return;
    const pending = Number(statusData.pending ?? 0);
    if (jobData.running === false && pending === 0) {
      setPolling(false);
      toast({ title: "No pending pre-generation items" });
    }
  }, [statusData, jobData, polling]);

  // Stop polling on topic change
  useEffect(() => {
    setPolling(false);
    setStatusData(null);
    setJobData(null);
  }, [topicId, subjectId]);

  // ── All-chapters-with-topics for bulk mode ─────────────────────
  const bulkNeedsAll = bulkMode !== "single";
  const { data: allChapters = [] } = useQuery({
    queryKey: ["ask-ai-all-chapters-topics", subjectId],
    enabled: !!subjectId && bulkNeedsAll,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: chs, error: e1 } = await supabase
        .from("subject_chapters")
        .select("id, chapter_number, title")
        .eq("subject_id", subjectId!)
        .order("chapter_number", { ascending: true });
      if (e1) throw e1;
      const chapterIds = (chs ?? []).map((c: any) => c.id);
      if (chapterIds.length === 0) return [];
      const { data: tps, error: e2 } = await supabase
        .from("subject_topics")
        .select("id, topic_number, title, chapter_id")
        .in("chapter_id", chapterIds)
        .order("topic_number", { ascending: true });
      if (e2) throw e2;
      const byChapter = new Map<string, any[]>();
      (tps ?? []).forEach((t: any) => {
        const arr = byChapter.get(t.chapter_id) ?? [];
        arr.push(t);
        byChapter.set(t.chapter_id, arr);
      });
      return (chs ?? []).map((c: any) => ({ ...c, topics: byChapter.get(c.id) ?? [] }));
    },
  });

  const buildQueueFromMode = (): QueueItem[] => {
    const items: QueueItem[] = [];
    const pushTopic = (ch: any, t: any) =>
      items.push({
        topicId: t.id,
        topicTitle: t.title,
        topicNumber: t.topic_number,
        chapterId: ch.id,
        chapterTitle: ch.title,
        chapterNumber: ch.chapter_number,
        status: "pending",
      });
    if (bulkMode === "subject") {
      (allChapters as any[]).forEach((ch) => ch.topics.forEach((t: any) => pushTopic(ch, t)));
    } else if (bulkMode === "chapter") {
      const ch = (allChapters as any[]).find((c) => c.id === chapterId);
      if (ch) ch.topics.forEach((t: any) => pushTopic(ch, t));
    } else if (bulkMode === "selected") {
      (allChapters as any[]).forEach((ch) =>
        ch.topics.forEach((t: any) => selectedTopicIds.has(t.id) && pushTopic(ch, t)),
      );
    }
    return items;
  };

  const totalBulkTopics =
    bulkMode === "subject"
      ? (allChapters as any[]).reduce((n, ch) => n + ch.topics.length, 0)
      : bulkMode === "chapter"
        ? ((allChapters as any[]).find((c) => c.id === chapterId)?.topics.length ?? 0)
        : bulkMode === "selected"
          ? selectedTopicIds.size
          : 0;

  const runQueue = async (items: QueueItem[]) => {
    if (!subjectId || items.length === 0) return;
    setQueue(items);
    setQueueRunning(true);
    setQueuePaused(false);
    pauseRef.current = false;
    stopRef.current = false;
    let firstSuccess = false;

    for (let i = 0; i < items.length; i++) {
      if (stopRef.current) break;
      while (pauseRef.current) {
        await sleep(300);
        if (stopRef.current) break;
      }
      if (stopRef.current) break;
      setQueueIndex(i);
      setQueue((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: "running" } : it)));

      try {
        const it = items[i];
        // Fetch document + questions for this topic on demand
        const [docRes, qRes] = await Promise.all([
          supabase
            .from("ai_assistant_documents")
            .select("id, display_name, source_type, source_url, status, created_at, full_content")
            .eq("topic_id", it.topicId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("questions")
            .select("id, question_text, question_format, options, correct_answer, difficulty, marks")
            .eq("topic_id", it.topicId),
        ]);
        if (docRes.error) throw docRes.error;
        if (qRes.error) throw qRes.error;

        const payload = buildAutoPayload({
          subject: { id: subjectId, name: subjectName, slug: subjectSlug },
          chapter: { id: it.chapterId, chapter_number: it.chapterNumber, title: it.chapterTitle },
          topic: { id: it.topicId, topic_number: it.topicNumber, title: it.topicTitle },
          docRow: docRes.data,
          questions: qRes.data ?? [],
        });

        if ((!payload.questions || payload.questions.length === 0) && !payload.document) {
          setQueue((prev) =>
            prev.map((x, idx) =>
              idx === i ? { ...x, status: "skipped", error: "No questions and no document" } : x,
            ),
          );
          await sleep(bulkDelayMs);
          continue;
        }

        const res = await proxyFetch(apiBase, `/questions/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const text = await res.text();
        let parsed: any = text;
        try { parsed = JSON.parse(text); } catch {}
        if (!res.ok) {
          throw new Error(typeof parsed === "string" ? parsed : JSON.stringify(parsed));
        }
        const jobId = parsed?.job_id || parsed?.batch_id || parsed?.run_id;
        setQueue((prev) =>
          prev.map((x, idx) => (idx === i ? { ...x, status: "success", jobId } : x)),
        );
        if (!firstSuccess) {
          firstSuccess = true;
          setPolling(true);
        }
      } catch (e: any) {
        setQueue((prev) =>
          prev.map((x, idx) =>
            idx === i ? { ...x, status: "error", error: e?.message || String(e) } : x,
          ),
        );
      }
      await sleep(bulkDelayMs);
    }

    setQueueRunning(false);
    setQueuePaused(false);
    stopRef.current = false;
    pauseRef.current = false;
    setQueueIndex(-1);
  };

  const handleStartBulk = () => {
    if (!subjectId) return;
    const items = buildQueueFromMode();
    if (items.length === 0) {
      toast({ title: "Nothing to send", description: "No topics matched your selection.", variant: "destructive" });
      return;
    }
    if (bulkMode === "subject" && items.length > 10) {
      const ok = window.confirm(`Send ${items.length} topics for the whole subject? They will be processed one by one.`);
      if (!ok) return;
    }
    void runQueue(items);
  };

  const handlePauseResume = () => {
    if (queuePaused) {
      pauseRef.current = false;
      setQueuePaused(false);
    } else {
      pauseRef.current = true;
      setQueuePaused(true);
    }
  };
  const handleStopQueue = () => {
    stopRef.current = true;
    pauseRef.current = false;
    setQueuePaused(false);
  };

  const toggleTopicSelected = (tid: string) =>
    setSelectedTopicIds((prev) => {
      const next = new Set(prev);
      next.has(tid) ? next.delete(tid) : next.add(tid);
      return next;
    });
  const toggleChapterAll = (ch: any) => {
    setSelectedTopicIds((prev) => {
      const next = new Set(prev);
      const allIn = ch.topics.every((t: any) => next.has(t.id));
      ch.topics.forEach((t: any) => (allIn ? next.delete(t.id) : next.add(t.id)));
      return next;
    });
  };

  const queueSummary = useMemo(() => {
    const s = { total: queue.length, success: 0, error: 0, skipped: 0, done: 0 };
    queue.forEach((q) => {
      if (q.status === "success") s.success++;
      if (q.status === "error") s.error++;
      if (q.status === "skipped") s.skipped++;
      if (q.status !== "pending" && q.status !== "running") s.done++;
    });
    return s;
  }, [queue]);



  const handleSend = async () => {
    if (!payloadText || jsonError) return;
    let parsedBody: any;
    try {
      parsedBody = JSON.parse(payloadText);
    } catch (e: any) {
      setJsonError(e?.message || "Invalid JSON");
      return;
    }
    setSending(true);
    setResult(null);
    setError(null);
    try {
      const res = await proxyFetch(apiBase, `/questions/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedBody),
      });
      const text = await res.text();
      let parsed: any = text;
      try {
        parsed = JSON.parse(text);
      } catch {}
      if (!res.ok) {
        setError(typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2));
        toast({ title: `Request failed (${res.status})`, variant: "destructive" });
      } else {
        setResult(parsed);
        const jid = parsed?.job_id || parsed?.batch_id || parsed?.run_id;
        toast({
          title: "Sent to AI Teaching API",
          description: jid ? `Job ID: ${jid}` : undefined,
        });
        setPolling(true);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
      toast({ title: "Network error", description: e?.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const pendingCount = Number(statusData?.pending ?? 0);
  const jobPct = jobData?.total ? ((jobData.done ?? 0) / jobData.total) * 100 : 0;

  if (view === "jobs") {
    return (
      <AskAIJobsDashboard
        subjectId={subjectId}
        subjectName={subjectName}
        apiBase={apiBase}
        onBack={() => {
          const next = new URLSearchParams(searchParams);
          next.delete("view");
          setSearchParams(next, { replace: true });
        }}
      />
    );
  }

  const openJobsDashboard = () => {
    const next = new URLSearchParams(searchParams);
    next.set("view", "jobs");
    setSearchParams(next, { replace: true });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle>Ask AI — Send topic to AI Teaching API</CardTitle>
            <CardDescription>
              Pick a chapter and topic. Edit the JSON payload as needed, then send it to{" "}
              <code>/questions/import</code>. Track progress in the Jobs Dashboard.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={openJobsDashboard}>
            <LayoutDashboard className="h-4 w-4" /> Open Jobs Dashboard
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Chapter</Label>
            <Select
              value={chapterId}
              onValueChange={(v) => {
                setChapterId(v);
                setTopicId("");
                setResult(null);
                setError(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select chapter" />
              </SelectTrigger>
              <SelectContent>
                {chapters.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.chapter_number}. {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Topic</Label>
            <Select
              value={topicId}
              onValueChange={(v) => {
                setTopicId(v);
                setResult(null);
                setError(null);
              }}
              disabled={!chapterId}
            >
              <SelectTrigger>
                <SelectValue placeholder={chapterId ? "Select topic" : "Select chapter first"} />
              </SelectTrigger>
              <SelectContent>
                {topics.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.topic_number} {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>AI Teaching API base URL</Label>
          <Input
            value={apiBase}
            onChange={(e) => setApiBase(e.target.value)}
            placeholder="http://116.202.230.124:8000"
          />
          <p className="text-xs text-muted-foreground">
            Saved locally. POSTs to <code>{apiBase.replace(/\/+$/, "")}/questions/import</code>;
            polls <code>/pregen/pending-count</code> and <code>/pregen/status</code>.
          </p>
        </div>

        {/* ── Bulk send ─────────────────────────────────────────── */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            <div className="text-sm font-medium">Bulk send</div>
            <span className="text-xs text-muted-foreground">
              Queue topics and send them one by one to the AI Teaching API.
            </span>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            {([
              ["single", "This topic only"],
              ["chapter", "Whole chapter"],
              ["selected", "Selected topics"],
              ["subject", "Whole subject"],
            ] as [BulkMode, string][]).map(([val, label]) => (
              <label key={val} className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="bulk-mode"
                  value={val}
                  checked={bulkMode === val}
                  onChange={() => setBulkMode(val)}
                  disabled={queueRunning}
                />
                {label}
              </label>
            ))}
          </div>

          {bulkMode === "selected" && (
            <ScrollArea className="h-56 rounded border bg-background">
              <div className="p-2 space-y-2">
                {(allChapters as any[]).length === 0 && (
                  <div className="text-xs text-muted-foreground p-2">Loading topics…</div>
                )}
                {(allChapters as any[]).map((ch) => {
                  const total = ch.topics.length;
                  const chosen = ch.topics.filter((t: any) => selectedTopicIds.has(t.id)).length;
                  return (
                    <div key={ch.id} className="rounded border">
                      <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/40">
                        <Checkbox
                          checked={total > 0 && chosen === total}
                          onCheckedChange={() => toggleChapterAll(ch)}
                        />
                        <div className="text-xs font-medium flex-1">
                          Ch {ch.chapter_number}. {ch.title}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {chosen}/{total}
                        </div>
                      </div>
                      <div className="p-2 space-y-1">
                        {ch.topics.map((t: any) => (
                          <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer">
                            <Checkbox
                              checked={selectedTopicIds.has(t.id)}
                              onCheckedChange={() => toggleTopicSelected(t.id)}
                            />
                            <span className="text-muted-foreground">{t.topic_number}</span>
                            <span className="truncate">{t.title}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {bulkMode !== "single" && (
            <div className="flex items-end gap-3 flex-wrap">
              <div className="text-xs text-muted-foreground">
                {totalBulkTopics} topic(s) will be queued
                {bulkMode === "chapter" && !chapterId && (
                  <span className="text-amber-600"> · select a chapter above</span>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Delay between (ms)</Label>
                <Input
                  type="number"
                  min={0}
                  step={100}
                  value={bulkDelayMs}
                  onChange={(e) => setBulkDelayMs(Math.max(0, Number(e.target.value) || 0))}
                  className="h-8 w-28 text-xs"
                  disabled={queueRunning}
                />
              </div>
              <div className="flex gap-2 ml-auto">
                {!queueRunning ? (
                  <Button
                    size="sm"
                    onClick={handleStartBulk}
                    disabled={
                      !subjectId ||
                      totalBulkTopics === 0 ||
                      (bulkMode === "chapter" && !chapterId)
                    }
                  >
                    <Send className="h-4 w-4" /> Start bulk send
                  </Button>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={handlePauseResume}>
                      {queuePaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                      {queuePaused ? "Resume" : "Pause"}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={handleStopQueue}>
                      <Square className="h-4 w-4" /> Stop
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {queue.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span>
                  {queueSummary.done} / {queueSummary.total} processed
                  {queueSummary.success > 0 && <span className="text-emerald-600"> · {queueSummary.success} ok</span>}
                  {queueSummary.error > 0 && <span className="text-destructive"> · {queueSummary.error} failed</span>}
                  {queueSummary.skipped > 0 && <span className="text-muted-foreground"> · {queueSummary.skipped} skipped</span>}
                </span>
                {queueRunning && (
                  <span className="text-muted-foreground inline-flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {queuePaused ? "paused" : "running"}
                  </span>
                )}
              </div>
              <Progress
                value={queueSummary.total ? (queueSummary.done / queueSummary.total) * 100 : 0}
              />
              <ScrollArea className="h-48 rounded border bg-background">
                <div className="p-2 space-y-1">
                  {queue.map((it, idx) => (
                    <div
                      key={`${it.topicId}-${idx}`}
                      className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${
                        idx === queueIndex ? "bg-muted" : ""
                      }`}
                    >
                      {it.status === "success" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                      {it.status === "error" && <XCircle className="h-3.5 w-3.5 text-destructive" />}
                      {it.status === "skipped" && <MinusCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                      {it.status === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {it.status === "pending" && <span className="h-3.5 w-3.5 rounded-full border" />}
                      <span className="text-muted-foreground shrink-0">
                        Ch{it.chapterNumber}·{it.topicNumber}
                      </span>
                      <span className="truncate flex-1">{it.topicTitle}</span>
                      {it.error && (
                        <span
                          className="text-destructive truncate max-w-[40%]"
                          title={it.error}
                        >
                          {it.error}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>


        {topicId && (
          <div className="rounded-md border p-3 text-sm space-y-1">
            <div>
              <span className="font-medium">{(questions as any[]).length}</span> question(s) ·{" "}
              <span className="font-medium">{contentMarkdown.length}</span> chars markdown
              {!contentMarkdown && (
                <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5" /> no markdown — document will be omitted
                </span>
              )}
            </div>
            <div className={jsonError ? "text-destructive" : "text-emerald-600"}>
              {jsonError ? `Invalid JSON: ${jsonError}` : "✓ Valid JSON — ready to send"}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Payload (editable)</Label>
            <span className="text-xs text-muted-foreground">{payloadText.length} chars</span>
          </div>
          <Textarea
            value={payloadText}
            onChange={(e) => {
              editedRef.current = true;
              setPayloadText(e.target.value);
            }}
            spellCheck={false}
            className="font-mono text-xs min-h-[420px] whitespace-pre"
            placeholder="Select a chapter and topic to generate the payload..."
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSend} disabled={!payloadText || !!jsonError || sending || queueRunning || bulkMode !== "single"}>
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send to AI Teaching API
          </Button>
          <Button variant="outline" onClick={handleCopy} disabled={!payloadText}>
            <Copy className="h-4 w-4" />
            Copy
          </Button>
          <Button variant="outline" onClick={resetPayload} disabled={!autoPayload}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <div className="text-sm font-medium text-destructive mb-1">Error</div>
            <pre className="text-xs whitespace-pre-wrap break-all">{error}</pre>
          </div>
        )}

        {result && (
          <div className="rounded-md border bg-muted/40 p-3 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm font-medium">Import response</div>
              {(result?.job_id || result?.batch_id || result?.run_id) && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Job ID:</span>
                  <code className="text-xs px-2 py-0.5 rounded bg-background border font-mono">
                    {result.job_id || result.batch_id || result.run_id}
                  </code>
                  <Button size="sm" variant="outline" onClick={openJobsDashboard}>
                    <LayoutDashboard className="h-3.5 w-3.5" /> View in dashboard
                  </Button>
                </div>
              )}
            </div>
            <pre className="text-xs whitespace-pre-wrap break-all">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}


        {/* Live status */}
        {(polling || statusData) && (
          <div className="rounded-md border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium flex items-center gap-2">
                Live pre-generation status
                {polling && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={fetchStatus}>
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </Button>
                {polling ? (
                  <Button size="sm" variant="outline" onClick={() => setPolling(false)}>
                    <Pause className="h-3.5 w-3.5" /> Stop
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setPolling(true)}>
                    <Play className="h-3.5 w-3.5" /> Resume
                  </Button>
                )}
              </div>
            </div>

            {statusError && (
              <div className="text-xs text-amber-600 inline-flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> {statusError}
              </div>
            )}

            {jobData?.running && (
              <div className="rounded border bg-muted/40 p-2 text-xs space-y-0.5">
                <div className="font-medium">
                  Job running · step: {jobData.current_step ?? "—"} ·{" "}
                  {Math.round(jobData.elapsed_seconds ?? 0)}s elapsed
                </div>
                <div className="text-muted-foreground truncate">
                  {jobData.current_question ?? ""}
                </div>
                <div>
                  {jobData.done ?? 0} / {jobData.total ?? 0} done, {jobData.failed ?? 0} failed
                </div>
              </div>
            )}

            {statusData && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs mb-1">
                  <span>Subject pending: {pendingCount}</span>
                  <span>
                    {jobData?.total ? `${jobData.done ?? 0}/${jobData.total} done` : "No active total"}
                    {(jobData?.failed ?? 0) > 0 && (
                      <span className="text-destructive"> · {jobData.failed} failed</span>
                    )}
                  </span>
                </div>
                <Progress value={jobPct} />
                <div className="text-[11px] text-muted-foreground">
                  Pending count comes from <code>/pregen/pending-count?subject_id=...</code>.
                  Job progress comes from <code>/pregen/status</code>.
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SubjectAskAITab;
