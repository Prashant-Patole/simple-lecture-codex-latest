import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AutoSubmissionItemStatus =
  | "queued"
  | "submitting"
  | "waiting"
  | "processing"
  | "completed"
  | "sanity_checking"
  | "passed"
  | "stopped";

export interface AutoSubmissionItem {
  documentId: string;
  displayName: string;
  sourceUrl?: string | null;
  fileName?: string | null;
  sourceType?: string | null;
  markdown?: string | null;
  status: AutoSubmissionItemStatus;
  externalJobId?: string;
  dbJobId?: string;
  progress?: number;
  currentStep?: string;
  currentPhase?: string;
  stopReason?: string;
  sanityDetail?: string;
  submittedAt?: string;
}

export interface AutoSubmissionRun {
  id: string;
  subject_id: string;
  subject_name: string;
  server_ip: string;
  status: "running" | "stopped" | "completed" | "failed";
  items: AutoSubmissionItem[];
  current_index: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  last_tick_at: string | null;
}

export function useActiveAutoSubmissionRun(subjectId: string | undefined, kind: string = "lecture") {
  const qc = useQueryClient();
  const key = ["active-auto-submission-run", subjectId, kind];

  const query = useQuery({
    queryKey: key,
    queryFn: async (): Promise<AutoSubmissionRun | null> => {
      if (!subjectId) return null;
      const { data } = await supabase
        .from("auto_submission_runs" as any)
        .select("*")
        .eq("subject_id", subjectId)
        .eq("kind", kind)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as any) ?? null;
    },
    enabled: !!subjectId,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!subjectId) return;
    const channel = supabase
      .channel(`auto_submission_runs_${subjectId}_${kind}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "auto_submission_runs", filter: `subject_id=eq.${subjectId}` },
        () => qc.invalidateQueries({ queryKey: key }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, kind]);

  const stopRun = async (id: string) => {
    await supabase.from("auto_submission_runs" as any).update({ status: "stopped" }).eq("id", id);
    qc.invalidateQueries({ queryKey: key });
  };

  const dismissRun = async (id: string) => {
    await supabase.from("auto_submission_runs" as any).delete().eq("id", id);
    qc.invalidateQueries({ queryKey: key });
  };

  const resumeRun = async (id: string) => {
    const { data } = await supabase
      .from("auto_submission_runs" as any)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const r: any = data;
    if (!r) return;
    const items: AutoSubmissionItem[] = Array.isArray(r.items) ? [...r.items] : [];

    // Find the first stopped item; fall back to current_index.
    let resumeIdx = items.findIndex((it) => it.status === "stopped");
    if (resumeIdx === -1) resumeIdx = r.current_index ?? 0;

    const target = items[resumeIdx];
    if (target) {
      // Strip dead handles so the tick treats it as a fresh submission
      // (re-submits a brand new external job from this point).
      items[resumeIdx] = {
        documentId: target.documentId,
        displayName: target.displayName,
        sourceUrl: target.sourceUrl,
        fileName: target.fileName,
        sourceType: target.sourceType,
        markdown: target.markdown,
        status: "queued",
        progress: 0,
      } as AutoSubmissionItem;
    }

    await supabase
      .from("auto_submission_runs" as any)
      .update({
        items,
        current_index: resumeIdx,
        status: "running",
        last_tick_at: null, // bypass the 25 s claim cooldown
      })
      .eq("id", id);

    // Poke the tick so the user sees progress immediately.
    try {
      await supabase.functions.invoke("auto-submission-tick", { body: {} });
    } catch { /* cron will pick up */ }

    qc.invalidateQueries({ queryKey: key });
  };

  return { run: query.data ?? null, isLoading: query.isLoading, stopRun, dismissRun, resumeRun };
}
