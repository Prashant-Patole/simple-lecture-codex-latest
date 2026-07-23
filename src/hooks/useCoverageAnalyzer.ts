import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL } from "@/lib/supabaseUrl";

const FUNCTION_BASE = `${SUPABASE_URL}/functions/v1/coverage-analyzer-proxy`;

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function proxyCall(path: string, init: RequestInit = {}) {
  const res = await fetch(`${FUNCTION_BASE}${path}`, {
    ...init,
    headers: { ...(await authHeaders()), ...(init.headers || {}) },
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body;
}

export const useAnalyzerHealth = () =>
  useQuery({
    queryKey: ["analyzer", "health"],
    queryFn: () => proxyCall("/api/health"),
    refetchInterval: 30_000,
    retry: 1,
  });

export const useAnalyzerJobs = (prefix?: string) =>
  useQuery({
    queryKey: ["analyzer", "jobs", prefix],
    queryFn: () => proxyCall(`/api/jobs${prefix ? `?type=${encodeURIComponent(prefix)}` : ""}`),
    enabled: true,
  });

export const useStartAnalyzerRun = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      type?: string;
      job_ids?: string[];
      all?: boolean;
      action?: "publish" | "unpublish" | "analyze";
    }) =>
      proxyCall("/api/analyze", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coverage-reports"] }),
  });
};

export const useAnalyzerRunStatus = (runId: string | null) =>
  useQuery({
    queryKey: ["analyzer", "run", runId],
    queryFn: () => proxyCall(`/api/analyze/${runId}`),
    enabled: !!runId,
    refetchInterval: (q) => {
      const s = (q.state.data as any)?.status;
      return s && ["done", "failed", "error", "completed"].includes(s) ? false : 3000;
    },
  });

export const useSavedCoverageReports = (filters: { subject?: string; status?: string }) =>
  useQuery({
    queryKey: ["coverage-reports", filters],
    queryFn: async () => {
      let q = supabase
        .from("coverage_analyzer_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (filters.subject) q = q.eq("subject_prefix", filters.subject);
      if (filters.status) q = q.eq("status", filters.status);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

export const useDeleteCoverageReport = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("coverage_analyzer_reports")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coverage-reports"] }),
  });
};

export const useMarkCoverageReportCompleted = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("coverage_analyzer_reports")
        .update({ status: "completed" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coverage-reports"] }),
  });
};
