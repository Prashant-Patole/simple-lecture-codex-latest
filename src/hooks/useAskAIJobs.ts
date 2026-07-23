import { useQuery } from "@tanstack/react-query";
import { SUPABASE_DIRECT_URL } from "@/lib/supabaseUrl";

const PROXY_URL = `${SUPABASE_DIRECT_URL}/functions/v1/ai-teaching-proxy`;
const DEFAULT_BASE = "http://116.202.230.124:8000";

export interface AskAIJobRow {
  id?: string;
  job_id?: string;
  question_id?: string;
  question_text?: string;
  subject_id?: string;
  chapter_id?: string;
  chapter_number?: number | string;
  chapter_title?: string;
  topic_id?: string;
  topic_number?: number | string;
  topic_title?: string;
  status?: string;
  is_pregen_done?: boolean;
  pregen_status?: string;
  created_at?: string;
  updated_at?: string;
  error_message?: string;
  [k: string]: any;
}

export interface AskAIJobsFilters {
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  status?: "all" | "pending" | "ready" | "failed";
  apiBase?: string;
}

const proxyFetch = (apiBase: string, path: string) => {
  const url = `${PROXY_URL}?path=${encodeURIComponent(path)}&base=${encodeURIComponent(apiBase.replace(/\/+$/, ""))}`;
  return fetch(url);
};

const normalizeRow = (raw: any): AskAIJobRow => {
  const chapter = raw.chapter ?? raw.chapters ?? {};
  const topic = raw.topic ?? raw.topics ?? {};
  return {
    ...raw,
    id: raw.id ?? raw.question_id ?? raw.job_id,
    job_id: raw.job_id ?? raw.import_job_id ?? raw.batch_id ?? raw.run_id,
    question_id: raw.question_id ?? raw.id,
    question_text: raw.question_text ?? raw.question ?? "",
    chapter_id: raw.chapter_id ?? chapter.id,
    chapter_number: raw.chapter_number ?? chapter.chapter_number,
    chapter_title: raw.chapter_title ?? chapter.title,
    topic_id: raw.topic_id ?? topic.id,
    topic_number: raw.topic_number ?? topic.topic_number,
    topic_title: raw.topic_title ?? topic.title,
    is_pregen_done: raw.is_pregen_done ?? raw.pregen_done ?? false,
    pregen_status: raw.pregen_status ?? raw.status,
  };
};

export const useAskAIJobs = (filters: AskAIJobsFilters) => {
  const { subjectId, chapterId, topicId, status, apiBase = DEFAULT_BASE } = filters;

  return useQuery({
    queryKey: ["ask-ai-jobs", subjectId, chapterId, topicId, status, apiBase],
    enabled: !!subjectId,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (subjectId) params.set("subject_id", subjectId);
      if (chapterId) params.set("chapter_id", chapterId);
      if (topicId) params.set("topic_id", topicId);
      if (status && status !== "all") params.set("status", status);
      const path = `/questions?${params.toString()}`;
      const res = await proxyFetch(apiBase, path);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Upstream ${res.status}`);
      }
      const data = await res.json();
      const list: any[] = Array.isArray(data) ? data : data?.questions ?? data?.items ?? data?.data ?? [];
      let rows = list.map(normalizeRow);

      // Client-side fallback in case upstream ignores filters
      if (chapterId) rows = rows.filter((r) => !r.chapter_id || r.chapter_id === chapterId);
      if (topicId) rows = rows.filter((r) => !r.topic_id || r.topic_id === topicId);
      if (status && status !== "all") {
        rows = rows.filter((r) => {
          if (status === "ready") return r.is_pregen_done === true;
          if (status === "pending") return r.is_pregen_done === false && (r.pregen_status ?? "pending") !== "failed";
          if (status === "failed") return (r.pregen_status ?? "").toLowerCase() === "failed";
          return true;
        });
      }
      return rows;
    },
    refetchInterval: (q) => {
      const rows = (q.state.data as AskAIJobRow[] | undefined) ?? [];
      const anyPending = rows.some(
        (r) => !r.is_pregen_done && (r.pregen_status ?? "").toLowerCase() !== "failed",
      );
      return anyPending ? 3000 : false;
    },
  });
};
