import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, PlayCircle, RefreshCw, Rocket, Trash2, XCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const SERVERS = ["69.197.145.4", "204.12.237.78"] as const;
type Server = typeof SERVERS[number];

type ScanRow = {
  job_id: string;
  external_job_id: string | null;
  document_name: string | null;
  subject_name: string;
  chapter_number: number | null;
  chapter_title: string | null;
  topic_title: string | null;
  total_sections: number;
  kannada_sections: number;
  coverage_status: "full" | "partial" | "missing";
  server_ip: string | null;
};

type QueueItem = {
  id: string;
  run_id: string | null;
  video_job_id: string;
  external_job_id: string;
  server_ip: string;
  subject_name: string | null;
  chapter_number: number | null;
  document_name: string | null;
  topic_title: string | null;
  total_sections: number;
  missing_sections: number;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  attempts: number;
  last_error: string | null;
  enqueued_at: string;
  started_at: string | null;
  finished_at: string | null;
};

function useActiveRun(server: Server) {
  return useQuery({
    queryKey: ["kannada-active-run", server],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kannada_queue_runs" as any)
        .select("*")
        .eq("server_ip", server)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}


function StatusBadge({ s }: { s: QueueItem["status"] }) {
  const map: Record<string, string> = {
    queued: "bg-slate-500",
    processing: "bg-blue-500",
    completed: "bg-emerald-500",
    failed: "bg-red-500",
    cancelled: "bg-gray-400",
  };
  return <Badge className={map[s]}>{s}</Badge>;
}

function useScanAll() {
  return useQuery({
    queryKey: ["kannada-scan-all"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_kannada_coverage_scan" as any, { p_subject_name: null });
      if (error) throw error;
      return (data ?? []) as ScanRow[];
    },
  });
}

function useQueue(server: Server) {
  return useQuery({
    queryKey: ["kannada-queue", server],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kannada_queue_items" as any)
        .select("*")
        .eq("server_ip", server)
        .order("enqueued_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as QueueItem[];
    },
  });
}

async function kickWorker() {
  try {
    await supabase.functions.invoke("kannada-queue-worker", { body: {} });
  } catch (e) {
    console.error("worker kick failed", e);
  }
}

function ServerPanel({ server }: { server: Server }) {
  const qc = useQueryClient();
  const scan = useScanAll();
  const queue = useQueue(server);
  const activeRun = useActiveRun(server);
  const [subject, setSubject] = useState("all");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // Realtime: on any queue item change, refresh queue + active run + coverage scan
  // (so completed jobs drop out of the "not-full" list without a manual reload).
  useEffect(() => {
    const ch = supabase
      .channel(`kannada-queue-${server}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kannada_queue_items", filter: `server_ip=eq.${server}` }, () => {
        qc.invalidateQueries({ queryKey: ["kannada-queue", server] });
        qc.invalidateQueries({ queryKey: ["kannada-active-run", server] });
        qc.invalidateQueries({ queryKey: ["kannada-scan-all"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [server, qc]);

  const subjects = useMemo(() => {
    const s = new Set<string>();
    (scan.data ?? []).forEach(r => r.subject_name && s.add(r.subject_name));
    return Array.from(s).sort();
  }, [scan.data]);

  const serverRows = useMemo(() => {
    return (scan.data ?? []).filter(r => {
      const belongs = server === "69.197.145.4"
        ? r.server_ip === "69.197.145.4"
        : r.server_ip !== "69.197.145.4"; // all other servers (incl. null) roll up to 204.12.237.78
      return belongs &&
        r.coverage_status !== "full" &&
        (subject === "all" || r.subject_name === subject);
    });
  }, [scan.data, server, subject]);

  // Block only jobs currently in flight. Completed queue history must not block
  // re-enqueue because a completed attempt can still leave Kannada coverage missing.
  const blockedIds = useMemo(() => {
    const s = new Set<string>();
    (queue.data ?? []).forEach(q => {
      if (q.status === "queued" || q.status === "processing") {
        s.add(q.video_job_id);
      }
    });
    return s;
  }, [queue.data]);
  const enqueueable = serverRows.filter(r => !blockedIds.has(r.job_id) && r.external_job_id);

  // Counts scoped to the CURRENT active run (avoids double-counting jobs that
  // appear in older cancelled runs too).
  const counts = useMemo(() => {
    const c = { queued: 0, processing: 0, completed: 0, failed: 0 };
    const runId = activeRun.data?.id;
    (queue.data ?? []).forEach(q => {
      if (runId && q.run_id !== runId) return;
      if (q.status in c) (c as any)[q.status]++;
    });
    return c;
  }, [queue.data, activeRun.data?.id]);

  async function enqueue(rows: ScanRow[], mode: "single" | "selected" | "all") {
    if (!rows.length) { toast({ title: "Nothing to enqueue" }); return; }

    // Defensive server-side dedupe: skip only jobs already active on this server
    // (protects against stale UI / race). Completed history can be re-enqueued
    // when the coverage scan still reports missing Kannada.
    const jobIds = rows.map(r => r.job_id);
    const { data: activeRows } = await supabase
      .from("kannada_queue_items" as any)
      .select("video_job_id")
      .eq("server_ip", server)
      .in("status", ["queued", "processing"])
      .in("video_job_id", jobIds);
    const activeSet = new Set(((activeRows ?? []) as any[]).map(d => d.video_job_id));
    const filtered = rows.filter(r => !activeSet.has(r.job_id));
    const skipped = rows.length - filtered.length;
    if (!filtered.length) {
      toast({ title: `All ${rows.length} job(s) already queued or processing — nothing to enqueue` });
      return;
    }

    const user = (await supabase.auth.getUser()).data.user;
    const { data: run, error: runErr } = await supabase
      .from("kannada_queue_runs" as any)
      .insert({ server_ip: server, mode, total: filtered.length, created_by: user?.id ?? null })
      .select().single();
    if (runErr) { toast({ title: "Failed", description: runErr.message, variant: "destructive" }); return; }

    const payload = filtered.map(r => ({
      run_id: (run as any).id,
      video_job_id: r.job_id,
      external_job_id: r.external_job_id!,
      server_ip: server,
      subject_name: r.subject_name,
      chapter_number: r.chapter_number,
      document_name: r.document_name,
      topic_title: r.topic_title,
      total_sections: r.total_sections,
      missing_sections: r.total_sections - r.kannada_sections,
      status: "queued",
      enqueued_by: user?.id ?? null,
    }));
    const { error } = await supabase.from("kannada_queue_items" as any).insert(payload);
    if (error) { toast({ title: "Enqueue failed", description: error.message, variant: "destructive" }); return; }
    toast({
      title: `Enqueued ${filtered.length} job(s)`,
      description: skipped > 0 ? `Skipped ${skipped} already active` : undefined,
    });
    setSelected({});
    qc.invalidateQueries({ queryKey: ["kannada-queue", server] });
    qc.invalidateQueries({ queryKey: ["kannada-active-run", server] });
    qc.invalidateQueries({ queryKey: ["kannada-scan-all"] });
    kickWorker();
  }


  async function cancelQueued() {
    const { error } = await supabase
      .from("kannada_queue_items" as any)
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .eq("server_ip", server).eq("status", "queued");
    if (error) toast({ title: "Cancel failed", description: error.message, variant: "destructive" });
    else toast({ title: "Queued items cancelled" });
    qc.invalidateQueries({ queryKey: ["kannada-queue", server] });
  }

  async function retryItem(id: string) {
    await supabase.from("kannada_queue_items" as any).update({ status: "queued", last_error: null, started_at: null, finished_at: null }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["kannada-queue", server] });
    kickWorker();
  }

  async function deleteItem(id: string) {
    await supabase.from("kannada_queue_items" as any).delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["kannada-queue", server] });
  }

  const selectedRows = enqueueable.filter(r => selected[r.job_id]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Server: {server}</Badge>
        <Badge className="bg-slate-500">Queued: {counts.queued}</Badge>
        <Badge className="bg-blue-500">Processing: {counts.processing}</Badge>
        <Badge className="bg-emerald-500">
          Done: {counts.completed}{activeRun.data?.total ? ` / ${activeRun.data.total}` : ""}
        </Badge>
        <Badge className="bg-red-500">Failed: {counts.failed}</Badge>

        <div className="ml-auto flex gap-2">
          <select className="border rounded px-2 py-1 text-sm bg-background" value={subject} onChange={e => setSubject(e.target.value)}>
            <option value="all">All subjects</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={() => { scan.refetch(); queue.refetch(); }}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={kickWorker}>
            <PlayCircle className="h-4 w-4 mr-1" /> Kick worker
          </Button>
        </div>
      </div>

      {/* Scan / enqueue section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Missing Kannada — {enqueueable.length} job(s) ready to enqueue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-3">
            <Button size="sm" disabled={!enqueueable[0]} onClick={() => enqueueable[0] && enqueue([enqueueable[0]], "single")}>
              <Rocket className="h-4 w-4 mr-1" /> Run One (next)
            </Button>
            <Button size="sm" disabled={!selectedRows.length} onClick={() => enqueue(selectedRows, "selected")}>
              <Rocket className="h-4 w-4 mr-1" /> Run Selected ({selectedRows.length})
            </Button>
            <Button size="sm" variant="secondary" disabled={!enqueueable.length} onClick={() => enqueue(enqueueable, "all")}>
              <Rocket className="h-4 w-4 mr-1" /> Run All ({enqueueable.length})
            </Button>
            <Button size="sm" variant="destructive" onClick={cancelQueued}>
              <XCircle className="h-4 w-4 mr-1" /> Cancel Queued
            </Button>
          </div>
          <div className="max-h-72 overflow-auto border rounded">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Origin</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Ch</TableHead>
                  <TableHead>Topic</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Coverage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enqueueable.map(r => (
                  <TableRow key={r.job_id}>
                    <TableCell>
                      <Checkbox checked={!!selected[r.job_id]} onCheckedChange={v => setSelected(s => ({ ...s, [r.job_id]: !!v }))} />
                    </TableCell>
                    <TableCell className="text-xs font-mono">{r.external_job_id ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.server_ip ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.subject_name}</TableCell>
                    <TableCell className="text-xs">{r.chapter_number ?? "-"}</TableCell>
                    <TableCell className="text-xs truncate max-w-[180px]">{r.topic_title ?? "—"}</TableCell>
                    <TableCell className="text-xs truncate max-w-[240px]">{r.document_name}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant={r.coverage_status === "partial" ? "secondary" : "destructive"}>
                        {r.kannada_sections}/{r.total_sections}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {!enqueueable.length && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground text-sm py-6">All jobs on this server are either full or already queued/processing</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Queue table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Queue ({queue.data?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-auto border rounded">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Ch</TableHead>
                  <TableHead>Topic</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Sections</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(queue.data ?? []).map(q => (
                  <TableRow key={q.id}>
                    <TableCell><StatusBadge s={q.status} /></TableCell>
                    <TableCell className="text-xs font-mono">{q.external_job_id}</TableCell>
                    <TableCell className="text-xs">{q.subject_name}</TableCell>
                    <TableCell className="text-xs">{q.chapter_number ?? "-"}</TableCell>
                    <TableCell className="text-xs truncate max-w-[160px]">{q.topic_title ?? "—"}</TableCell>
                    <TableCell className="text-xs truncate max-w-[200px]">{q.document_name}</TableCell>
                    <TableCell className="text-xs">{q.missing_sections}/{q.total_sections}</TableCell>
                    <TableCell className="text-xs">{q.attempts}</TableCell>
                    <TableCell className="text-xs text-red-600 truncate max-w-[220px]" title={q.last_error ?? ""}>{q.last_error}</TableCell>
                    <TableCell className="flex gap-1">
                      {q.status === "failed" && (
                        <Button size="sm" variant="outline" onClick={() => retryItem(q.id)}>Retry</Button>
                      )}
                      {(q.status === "queued" || q.status === "cancelled" || q.status === "failed") && (
                        <Button size="icon" variant="ghost" onClick={() => deleteItem(q.id)}><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!(queue.data ?? []).length && (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground text-sm py-6">Queue is empty</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function KannadaQueue() {
  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Kannada Generation Queue</h1>
        <p className="text-sm text-muted-foreground">Per-server queues. Each server runs one job at a time; both servers work in parallel.</p>
      </div>
      <Tabs defaultValue={SERVERS[0]}>
        <TabsList>
          {SERVERS.map(s => <TabsTrigger key={s} value={s}>{s}</TabsTrigger>)}
        </TabsList>
        {SERVERS.map(s => (
          <TabsContent key={s} value={s} className="mt-4">
            <ServerPanel server={s} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
