import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, Trash2, RefreshCw, Terminal } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useGapPatcherHealth,
  useGapPatcherQueue,
  useGapPatcherSettings,
  useToggleGapPatcher,
  useRemoveGapQueueRow,
  gapProxy,
  refreshJobPresentation,
  type GapQueueRow,
} from "@/hooks/useGapPatcherQueue";

type JobMetaMap = Map<string, { subjectName: string; chapterTitle: string; topicTitle: string }>;

const statusVariant = (s: GapQueueRow["status"]) => {
  switch (s) {
    case "completed": return "default";
    case "failed": case "cancelled": return "destructive";
    case "running": case "refreshing_cdn": case "patch_done": return "secondary";
    default: return "outline";
  }
};

export default function GapPatcherQueuePanel({ jobMeta }: { jobMeta?: JobMetaMap }) {
  const health = useGapPatcherHealth();
  const queue = useGapPatcherQueue();
  const settings = useGapPatcherSettings();
  const toggle = useToggleGapPatcher();
  const removeRow = useRemoveGapQueueRow();
  const [viewLog, setViewLog] = useState<GapQueueRow | null>(null);

  const enabled = !!settings.data?.enabled;
  const rows = queue.data ?? [];

  // ----- Browser-side orchestrator -----
  // Always polls so in-flight jobs finish even when the toggle is OFF.
  // OFF only prevents picking up NEW queued rows.
  const busyRef = useRef(false);
  const enabledRef = useRef(enabled);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => {
    let cancelled = false;
    let timer: any;

    const tick = async () => {
      if (cancelled || busyRef.current) return;
      busyRef.current = true;
      try {
        // Fetch fresh rows to avoid race with react-query cache
        const { data: fresh, error } = await supabase
          .from("gap_patcher_queue")
          .select("*")
          .in("status", ["queued", "running", "patch_done", "refreshing_cdn"])
          .order("created_at", { ascending: true });
        if (error) throw error;
        const list = (fresh ?? []) as GapQueueRow[];

        // Advance any in-flight row first
        const running = list.find((r) => r.status === "running" || r.status === "refreshing_cdn");
        if (running) {
          if (running.status === "running" && running.patch_run_id) {
            const status = await gapProxy(`/api/patch/${running.patch_run_id}`);
            const tail = Array.isArray(status?.log) ? status.log.slice(-40).join("\n").slice(-2000) : null;
            if (status?.status === "done" && status?.exit_code === 0) {
              await supabase.from("gap_patcher_queue").update({
                status: "refreshing_cdn",
                last_log_tail: tail,
              }).eq("id", running.id);
              // Call refresh once
              try {
                await refreshJobPresentation(running.external_job_id);
                await supabase.from("gap_patcher_queue").update({
                  status: "completed",
                  finished_at: new Date().toISOString(),
                }).eq("id", running.id);
              } catch (e: any) {
                await supabase.from("gap_patcher_queue").update({
                  status: "failed",
                  error: `CDN refresh failed: ${e.message}`,
                  finished_at: new Date().toISOString(),
                }).eq("id", running.id);
              }
            } else if (status?.status === "failed" || status?.status === "error" || (status?.status === "done" && status?.exit_code && status.exit_code !== 0)) {
              await supabase.from("gap_patcher_queue").update({
                status: "failed",
                error: `Patch run ${status?.status} (exit ${status?.exit_code ?? "?"})`,
                last_log_tail: tail,
                finished_at: new Date().toISOString(),
              }).eq("id", running.id);
            } else {
              // Still running — just update log tail
              if (tail) {
                await supabase.from("gap_patcher_queue").update({ last_log_tail: tail }).eq("id", running.id);
              }
            }
          }
          return;
        }

        // Pick next queued — only when toggle is ON
        if (!enabledRef.current) return;
        const next = list.find((r) => r.status === "queued");
        if (!next) return;

        try {
          const res = await gapProxy("/api/patch", {
            method: "POST",
            body: JSON.stringify({ job_id: next.external_job_id }),
          });
          if (!res?.patch_run_id) throw new Error("no patch_run_id returned");
          await supabase.from("gap_patcher_queue").update({
            status: "running",
            patch_run_id: res.patch_run_id,
            started_at: new Date().toISOString(),
            error: null,
          }).eq("id", next.id);
        } catch (e: any) {
          await supabase.from("gap_patcher_queue").update({
            status: "failed",
            error: `Failed to start: ${e.message}`,
            finished_at: new Date().toISOString(),
          }).eq("id", next.id);
        }
      } catch (e) {
        console.error("[gap-patcher orchestrator]", e);
      } finally {
        busyRef.current = false;
        queue.refetch();
      }
    };

    tick();
    timer = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [queue]);

  const counts = {
    queued: rows.filter((r) => r.status === "queued").length,
    running: rows.filter((r) => ["running", "patch_done", "refreshing_cdn"].includes(r.status)).length,
    completed: rows.filter((r) => r.status === "completed").length,
    failed: rows.filter((r) => r.status === "failed").length,
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Gap Patcher Queue</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            OFF pauses starting new jobs. Any job already running will still finish and auto-refresh CDN.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={health.data?.status === "ok" ? "default" : "destructive"} className="gap-1">
            <Activity className="h-3 w-3" />
            {health.data?.status === "ok" ? "Patcher Online" : "Patcher Offline"}
          </Badge>
          <div className="flex items-center gap-2">
            <Label htmlFor="gp-toggle" className="text-sm">{enabled ? "ON" : "OFF"}</Label>
            <Switch
              id="gp-toggle"
              checked={enabled}
              onCheckedChange={(v) => toggle.mutate(v, {
                onSuccess: () => toast.success(v ? "Queue started — new jobs will be picked up." : "Queue paused — running job will still finish."),
              })}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">Queued: {counts.queued}</Badge>
          <Badge variant="secondary">Running: {counts.running}</Badge>
          <Badge variant="default">Done: {counts.completed}</Badge>
          <Badge variant="destructive">Failed: {counts.failed}</Badge>
          <Button size="sm" variant="ghost" className="ml-auto h-6" onClick={() => queue.refetch()}>
            <RefreshCw className="h-3 w-3 mr-1" /> Refresh
          </Button>
        </div>

        <div className="max-h-[420px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job ID</TableHead>
                <TableHead>Subject / Chapter / Topic</TableHead>
                <TableHead>Cov%</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const meta = jobMeta?.get(r.external_job_id);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs max-w-[280px] truncate" title={r.external_job_id}>
                      {r.external_job_id}
                    </TableCell>
                    <TableCell className="text-xs">
                      {meta ? `${meta.subjectName} › ${meta.chapterTitle} › ${meta.topicTitle}` : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{r.coverage_percent ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                      {r.error && <div className="text-[10px] text-destructive mt-1 max-w-[200px] truncate" title={r.error}>{r.error}</div>}
                    </TableCell>
                    <TableCell className="text-xs">{r.started_at ? new Date(r.started_at).toLocaleTimeString() : "—"}</TableCell>
                    <TableCell className="flex gap-1">
                      {r.patch_run_id && (
                        <Button size="sm" variant="ghost" title="View log" onClick={() => setViewLog(r)}>
                          <Terminal className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Remove"
                        onClick={() => removeRow.mutate(r.id)}
                        disabled={removeRow.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Queue is empty. Add jobs from a Saved Report.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {viewLog && (
          <div className="rounded border bg-muted p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium font-mono">{viewLog.external_job_id}</div>
              <Button size="sm" variant="ghost" onClick={() => setViewLog(null)}>Close</Button>
            </div>
            <pre className="text-[11px] whitespace-pre-wrap max-h-64 overflow-auto">{viewLog.last_log_tail || "(no log yet)"}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
