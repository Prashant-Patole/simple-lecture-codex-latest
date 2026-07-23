import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL } from "@/lib/supabaseUrl";

export type GapQueueRow = {
  id: string;
  external_job_id: string;
  source: string;
  coverage_percent: number | null;
  status: "queued" | "running" | "patch_done" | "refreshing_cdn" | "completed" | "failed" | "cancelled";
  patch_run_id: string | null;
  last_log_tail: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

const FN = `${SUPABASE_URL}/functions/v1`;

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  return {
    "Content-Type": "application/json",
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

export async function gapProxy(path: string, init: RequestInit = {}) {
  const res = await fetch(`${FN}/gap-patcher-proxy${path}`, {
    ...init,
    headers: { ...(await authHeaders()), ...(init.headers || {}) },
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body;
}

export async function refreshJobPresentation(externalJobId: string) {
  const res = await fetch(`${FN}/admin-refresh-job-presentation`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ external_job_id: externalJobId }),
  });
  const t = await res.text();
  let body: any = null;
  try { body = t ? JSON.parse(t) : null; } catch { body = t; }
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body;
}

export const useGapPatcherHealth = () =>
  useQuery({
    queryKey: ["gap-patcher", "health"],
    queryFn: () => gapProxy("/api/health"),
    refetchInterval: 30_000,
    retry: 1,
  });

export const useGapPatcherQueue = () => {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["gap-patcher", "queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gap_patcher_queue")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as GapQueueRow[];
    },
  });
  useEffect(() => {
    const ch = supabase
      .channel("gap_patcher_queue_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "gap_patcher_queue" }, () => {
        qc.invalidateQueries({ queryKey: ["gap-patcher", "queue"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
  return q;
};

export const useGapPatcherSettings = () => {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["gap-patcher", "settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gap_patcher_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data as { id: number; enabled: boolean } | null;
    },
  });
  useEffect(() => {
    const ch = supabase
      .channel("gap_patcher_settings_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "gap_patcher_settings" }, () => {
        qc.invalidateQueries({ queryKey: ["gap-patcher", "settings"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
  return q;
};

export const useToggleGapPatcher = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from("gap_patcher_settings")
        .upsert({ id: 1, enabled }, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gap-patcher", "settings"] }),
  });
};

export const useAddToGapQueue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: { external_job_id: string; coverage_percent?: number | null; source?: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("gap_patcher_queue")
        .insert({
          external_job_id: row.external_job_id,
          coverage_percent: row.coverage_percent ?? null,
          source: row.source ?? "manual",
          created_by: userData.user?.id ?? null,
          status: "queued",
        });
      if (error && !/duplicate|unique/i.test(error.message)) throw error;
      return !error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gap-patcher", "queue"] }),
  });
};

export const useBulkQueueBelow75 = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: { external_job_id: string; coverage_percent: number | null }[]) => {
      const { data: userData } = await supabase.auth.getUser();
      const created_by = userData.user?.id ?? null;
      // Fetch existing to compute skipped count
      const ids = rows.map((r) => r.external_job_id);
      const { data: existing } = await supabase
        .from("gap_patcher_queue")
        .select("external_job_id")
        .in("external_job_id", ids);
      const existingSet = new Set((existing ?? []).map((r: any) => r.external_job_id));
      const toInsert = rows
        .filter((r) => !existingSet.has(r.external_job_id))
        .map((r) => ({
          external_job_id: r.external_job_id,
          coverage_percent: r.coverage_percent,
          source: "bulk_below_75",
          created_by,
          status: "queued" as const,
        }));
      if (toInsert.length) {
        const { error } = await supabase.from("gap_patcher_queue").insert(toInsert);
        if (error) throw error;
      }
      return { added: toInsert.length, skipped: rows.length - toInsert.length };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gap-patcher", "queue"] }),
  });
};

export const useRemoveGapQueueRow = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gap_patcher_queue").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gap-patcher", "queue"] }),
  });
};
