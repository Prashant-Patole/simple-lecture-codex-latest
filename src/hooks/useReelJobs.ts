import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ReelJob {
  id: string;
  subject_id: string;
  document_id: string | null;
  file_name: string | null;
  job_id: string;
  server_ip: string | null;
  target_port: number | null;
  status: string;
  status_message: string | null;
  progress: number;
  error: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

const TERMINAL = new Set(["completed", "failed", "error", "cancelled"]);

export function useReelJobs(subjectId: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["reel-jobs", subjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reel_jobs")
        .select("*")
        .eq("subject_id", subjectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ReelJob[];
    },
    enabled: !!subjectId,
    refetchInterval: 5000,
  });

  // Poll the upstream /jobs endpoint for any non-terminal job and persist updates
  useEffect(() => {
    if (!query.data) return;
    const active = query.data.filter((j) => !TERMINAL.has(j.status));
    if (active.length === 0) return;

    let cancelled = false;
    (async () => {
      // Group by server_ip + port so we fetch /jobs once per server.
      // Never fall back to a default — a mis-bound origin will silently
      // return the wrong manifest. Skip rows without server info.
      const buckets = new Map<string, ReelJob[]>();
      for (const j of active) {
        if (!j.server_ip || !j.target_port) {
          console.warn(
            `[useReelJobs] skipping poll for job ${j.job_id} — missing server_ip/target_port. Rebind it in the admin UI.`,
          );
          continue;
        }
        const key = `${j.server_ip}:${j.target_port}`;
        const arr = buckets.get(key) || [];
        arr.push(j);
        buckets.set(key, arr);
      }


      for (const [key, jobs] of buckets) {
        const [server_ip, portStr] = key.split(":");
        const target_port = Number(portStr);
        try {
          const { data, error } = await supabase.functions.invoke(
            "video-generation-proxy",
            {
              body: {
                action: "list_jobs",
                server_ip,
                target_port,
              },
            }
          );
          if (error || cancelled) continue;
          const remoteJobs: any[] = data?.jobs || [];
          for (const local of jobs) {
            const remote = remoteJobs.find((r) => r.job_id === local.job_id);
            if (!remote) continue;
            const status = String(remote.status || local.status);
            const status_message = remote.status_message ?? null;
            const progress =
              typeof remote.progress === "number"
                ? Math.round(remote.progress)
                : local.progress;
            const error_text = remote.error ?? null;
            const completed_at =
              TERMINAL.has(status) && !local.completed_at
                ? new Date().toISOString()
                : local.completed_at;

            const changed =
              status !== local.status ||
              status_message !== local.status_message ||
              progress !== local.progress ||
              error_text !== local.error;

            if (!changed) continue;

            await supabase
              .from("reel_jobs")
              .update({
                status,
                status_message,
                progress,
                error: error_text,
                completed_at,
              })
              .eq("id", local.id);
          }
        } catch (e) {
          console.warn("[useReelJobs] poll failed", e);
        }
      }
      if (!cancelled) {
        qc.invalidateQueries({ queryKey: ["reel-jobs", subjectId] });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [query.data, qc, subjectId]);

  return query;
}
