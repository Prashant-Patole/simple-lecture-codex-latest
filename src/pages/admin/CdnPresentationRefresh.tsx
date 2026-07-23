import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, RefreshCw, X, CheckCircle2, AlertCircle, SkipForward, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

type Run = {
  id: string;
  status: string;
  total_jobs: number;
  current_job_index: number;
  completed_jobs: number;
  failed_jobs: number;
  skipped_jobs: number;
  label: string | null;
  created_at: string;
  updated_at: string;
  job_queue: Array<{ external_job_id: string; status: string; error_message: string | null }>;
};

export default function CdnPresentationRefresh() {
  const qc = useQueryClient();
  const [starting, setStarting] = useState(false);
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const [publishedOnly, setPublishedOnly] = useState(false);
  const [singleJobId, setSingleJobId] = useState("");
  const [startingSingle, setStartingSingle] = useState(false);

  // Active run (processing)
  const { data: activeRun } = useQuery({
    queryKey: ["cdn-pres-run-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cdn_presentation_refresh_runs" as any)
        .select("*")
        .eq("status", "processing")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Run | null;
    },
    refetchInterval: 15000,
  });

  // Recent runs history
  const { data: recentRuns } = useQuery({
    queryKey: ["cdn-pres-run-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cdn_presentation_refresh_runs" as any)
        .select("id,status,total_jobs,completed_jobs,failed_jobs,skipped_jobs,label,created_at,updated_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval: 30000,
  });

  // Realtime updates for the active run
  useEffect(() => {
    if (!activeRun?.id) return;
    const channel = supabase
      .channel(`cdn-pres-run-${activeRun.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "cdn_presentation_refresh_runs", filter: `id=eq.${activeRun.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["cdn-pres-run-active"] });
          qc.invalidateQueries({ queryKey: ["cdn-pres-run-recent"] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeRun?.id, qc]);

  const progressPct = useMemo(() => {
    if (!activeRun || !activeRun.total_jobs) return 0;
    const done = activeRun.completed_jobs + activeRun.failed_jobs + activeRun.skipped_jobs;
    return Math.min(100, Math.round((done / activeRun.total_jobs) * 100));
  }, [activeRun]);

  const handleStart = async () => {
    setStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke("cdn-presentation-refresh-start", {
        body: { only_empty: onlyEmpty, published_only: publishedOnly },
      });
      if (error) throw error;
      if ((data as any)?.queued === 0) {
        toast.info((data as any)?.message ?? "No matching jobs");
      } else {
        toast.success(`Queued ${(data as any)?.queued} jobs. Worker will start within 60s.`);
      }
      qc.invalidateQueries({ queryKey: ["cdn-pres-run-active"] });
      qc.invalidateQueries({ queryKey: ["cdn-pres-run-recent"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to start");
    } finally {
      setStarting(false);
    }
  };

  const handleCancel = async () => {
    if (!activeRun) return;
    const { error } = await supabase
      .from("cdn_presentation_refresh_runs" as any)
      .update({ status: "cancelled" } as any)
      .eq("id", activeRun.id);
    if (error) return toast.error(error.message);
    toast.info("Cancelled");
    qc.invalidateQueries({ queryKey: ["cdn-pres-run-active"] });
  };

  const handleRunWorkerNow = async () => {
    const { error } = await supabase.functions.invoke("cdn-presentation-refresh-worker", { body: {} });
    if (error) toast.error(error.message);
    else toast.success("Worker triggered");
  };

  const handleStartSingle = async () => {
    const id = singleJobId.trim();
    if (!id) {
      toast.error("Enter an external_job_id");
      return;
    }
    if (activeRun) {
      toast.error("A run is already in progress");
      return;
    }
    setStartingSingle(true);
    try {
      const { data, error } = await supabase.functions.invoke("cdn-presentation-refresh-start", {
        body: { external_job_id: id },
      });
      if (error) throw error;
      if ((data as any)?.queued === 0) {
        toast.info((data as any)?.message ?? "Job not found");
      } else {
        toast.success(`Queued job ${id}. Triggering worker…`);
        await supabase.functions.invoke("cdn-presentation-refresh-worker", { body: {} });
      }
      setSingleJobId("");
      qc.invalidateQueries({ queryKey: ["cdn-pres-run-active"] });
      qc.invalidateQueries({ queryKey: ["cdn-pres-run-recent"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to queue job");
    } finally {
      setStartingSingle(false);
    }
  };

  const recentFailures = useMemo(() => {
    if (!activeRun?.job_queue) return [];
    return activeRun.job_queue.filter((j) => j.status === "failed" || j.status === "skipped").slice(-10);
  }, [activeRun]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">CDN Presentation Refresh</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bulk-fetches <code>presentation.json</code> from <code>server1.simplelecture.com</code> and updates every
          matching <code>video_generation_jobs</code> row. A background worker processes ~25 jobs per minute.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Refresh a single job</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Enter an <code>external_job_id</code> to fetch its <code>presentation.json</code> from the CDN and update just that job.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="external_job_id (e.g. job_abc123)"
              value={singleJobId}
              onChange={(e) => setSingleJobId(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleStartSingle(); }}
              className="font-mono"
            />
            <Button onClick={handleStartSingle} disabled={startingSingle || !!activeRun || !singleJobId.trim()}>
              {startingSingle ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Trigger job
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Queue a new run</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={onlyEmpty} onCheckedChange={(v) => setOnlyEmpty(!!v)} />
              Only jobs with empty <code>presentation_json.sections</code> (safe backfill)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={publishedOnly} onCheckedChange={(v) => setPublishedOnly(!!v)} />
              Only published jobs
            </label>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleStart} disabled={starting || !!activeRun}>
              {starting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              {activeRun ? "Run in progress…" : "Queue all completed jobs"}
            </Button>
            <Button variant="outline" onClick={handleRunWorkerNow}>Trigger worker now</Button>
          </div>
        </CardContent>
      </Card>

      {activeRun && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Active run</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {activeRun.label ?? "CDN refresh"} · started {new Date(activeRun.created_at).toLocaleString()}
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={handleCancel}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>
                  {activeRun.completed_jobs + activeRun.failed_jobs + activeRun.skipped_jobs} / {activeRun.total_jobs}
                </span>
                <span>{progressPct}%</span>
              </div>
              <Progress value={progressPct} />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> {activeRun.completed_jobs} updated
              </Badge>
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" /> {activeRun.failed_jobs} failed
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <SkipForward className="h-3 w-3" /> {activeRun.skipped_jobs} skipped
              </Badge>
            </div>

            {recentFailures.length > 0 && (
              <div className="text-xs">
                <div className="font-semibold mb-1">Recent failures/skips</div>
                <ul className="space-y-1 max-h-40 overflow-auto">
                  {recentFailures.map((j) => (
                    <li key={j.external_job_id} className="flex justify-between gap-4 border-b py-1">
                      <span className="font-mono truncate">{j.external_job_id}</span>
                      <span className="text-muted-foreground">{j.error_message ?? j.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Recent runs</CardTitle></CardHeader>
        <CardContent>
          {!recentRuns?.length ? (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-1">Started</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Updated</th>
                  <th>Failed</th>
                  <th>Skipped</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((r: any) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-1">{new Date(r.created_at).toLocaleString()}</td>
                    <td>{r.status}</td>
                    <td>{r.total_jobs}</td>
                    <td>{r.completed_jobs}</td>
                    <td>{r.failed_jobs}</td>
                    <td>{r.skipped_jobs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
