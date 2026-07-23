import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, PlayCircle, RefreshCw, Rocket, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const SERVER_78 = "204.12.237.78";
const SERVER_4 = "69.197.145.4";
const PAGE_SIZE = 25;

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
  created_at: string;
};

type QueueItem = {
  id: string;
  video_job_id: string;
  external_job_id: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  attempts: number;
  last_error: string | null;
  document_name: string | null;
  subject_name: string | null;
  chapter_number: number | null;
  topic_title: string | null;
  total_sections: number;
  missing_sections: number;
  enqueued_at: string;
};

function useServer4Jobs() {
  return useQuery({
    queryKey: ["server78-jobs-scan"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_kannada_coverage_scan" as any,
        { p_subject_name: null },
      );
      if (error) throw error;
      return ((data ?? []) as ScanRow[]).filter(
        (r) => r.server_ip !== SERVER_4 && r.coverage_status !== "full",
      );
    },
  });
}

function useServer4Queue() {
  return useQuery({
    queryKey: ["server78-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kannada_queue_items" as any)
        .select("*")
        .eq("server_ip", SERVER_78)
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
    console.error(e);
  }
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

export default function Server78Jobs() {
  const qc = useQueryClient();
  const scan = useServer4Jobs();
  const queue = useServer4Queue();
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("all");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [onlyMissingKannada, setOnlyMissingKannada] = useState(false);
  const [busy, setBusy] = useState(false);
  const enqueueLockRef = useRef(false);

  useEffect(() => {
    const ch = supabase
      .channel("server78-queue-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kannada_queue_items", filter: `server_ip=eq.${SERVER_78}` },
        () => {
          qc.invalidateQueries({ queryKey: ["server78-queue"] });
          qc.invalidateQueries({ queryKey: ["server78-jobs-scan"] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const subjects = useMemo(() => {
    const s = new Set<string>();
    (scan.data ?? []).forEach((r) => r.subject_name && s.add(r.subject_name));
    return Array.from(s).sort();
  }, [scan.data]);

  // Block only jobs currently in flight. Completed history must not block
  // re-enqueue because coverage can still be missing after a completed attempt.
  const blockedIds = useMemo(() => {
    const s = new Set<string>();
    (queue.data ?? []).forEach((q) => {
      if (q.status === "queued" || q.status === "processing") {
        s.add(q.video_job_id);
      }
    });
    return s;
  }, [queue.data]);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (scan.data ?? []).filter((r) => {
      if (subject !== "all" && r.subject_name !== subject) return false;
      if (onlyMissingKannada && r.coverage_status !== "missing") return false;
      if (!q) return true;
      return (
        r.document_name?.toLowerCase().includes(q) ||
        r.subject_name?.toLowerCase().includes(q) ||
        r.topic_title?.toLowerCase().includes(q) ||
        r.chapter_title?.toLowerCase().includes(q) ||
        r.external_job_id?.toLowerCase().includes(q)
      );
    });
  }, [scan.data, search, subject, onlyMissingKannada]);

  const visibleJobs = showAll ? filteredJobs : filteredJobs.slice(0, PAGE_SIZE);
  const selectedRows = filteredJobs.filter(
    (r) => selected[r.job_id] && !blockedIds.has(r.job_id) && r.external_job_id,
  );

  async function enqueue(rows: ScanRow[], mode: "single" | "selected" | "all") {
    if (busy || enqueueLockRef.current) return; // immediate guard before React state flips
    enqueueLockRef.current = true;
    const initialEligible = rows.filter(
      (r) => !blockedIds.has(r.job_id) && r.external_job_id,
    );
    if (!initialEligible.length) {
      toast({ title: "Nothing to enqueue", description: "All selected jobs are already queued or processing." });
      enqueueLockRef.current = false;
      return;
    }
    setBusy(true);
    try {
      // Server-side dedupe: re-check DB right before insert so a concurrent
      // click (this tab or another admin) can't sneak a second queued row in.
      const extIds = initialEligible.map((r) => r.external_job_id!);
      const { data: existing } = await supabase
        .from("kannada_queue_items" as any)
        .select("external_job_id, status")
        .eq("server_ip", SERVER_78)
        .in("external_job_id", extIds)
        .in("status", ["queued", "processing"]);
      const activeSet = new Set(((existing ?? []) as any[]).map((x) => x.external_job_id));
      const eligible = initialEligible.filter((r) => !activeSet.has(r.external_job_id!));
      const skipped = initialEligible.length - eligible.length;
      if (!eligible.length) {
        toast({
          title: "Already in queue",
          description: `${skipped} job(s) are already queued or processing on .78.`,
        });
        setSelected({});
        qc.invalidateQueries({ queryKey: ["server78-queue"] });
        return;
      }

      const user = (await supabase.auth.getUser()).data.user;
      const { data: run, error: runErr } = await supabase
        .from("kannada_queue_runs" as any)
        .insert({
          server_ip: SERVER_78,
          mode,
          total: eligible.length,
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (runErr) throw runErr;

      const payload = eligible.map((r) => ({
        run_id: (run as any).id,
        video_job_id: r.job_id,
        external_job_id: r.external_job_id!,
        server_ip: SERVER_78,
        subject_name: r.subject_name,
        chapter_number: r.chapter_number,
        document_name: r.document_name,
        topic_title: r.topic_title,
        total_sections: r.total_sections,
        missing_sections: Math.max(0, r.total_sections - r.kannada_sections),
        status: "queued",
        enqueued_by: user?.id ?? null,
      }));
      const { error } = await supabase
        .from("kannada_queue_items" as any)
        .insert(payload);
      if (error) {
        // Partial unique index (server_ip, external_job_id) WHERE status in
        // ('queued','processing') — race with another insert lands here.
        if ((error as any).code === "23505") {
          toast({
            title: "Duplicate skipped",
            description: "Some jobs were already enqueued by another action.",
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: `Enqueued ${eligible.length} job(s) on .78${skipped ? ` (${skipped} already active)` : ""}`,
        });
      }
      setSelected({});
      qc.invalidateQueries({ queryKey: ["server78-queue"] });
      qc.invalidateQueries({ queryKey: ["server78-jobs-scan"] });
      kickWorker();
    } catch (e: any) {
      toast({ title: "Enqueue failed", description: e.message, variant: "destructive" });
    } finally {
      enqueueLockRef.current = false;
      setBusy(false);
    }
  }

  async function retryItem(id: string) {
    await supabase
      .from("kannada_queue_items" as any)
      .update({ status: "queued", last_error: null, started_at: null, finished_at: null })
      .eq("id", id);
    qc.invalidateQueries({ queryKey: ["server78-queue"] });
    kickWorker();
  }

  async function deleteItem(id: string) {
    await supabase.from("kannada_queue_items" as any).delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["server78-queue"] });
  }

  async function stopAllProcessing() {
    if (!confirm("Cancel ALL queued & processing items on .78? In-flight GPU work may keep running until it finishes, but nothing new will be picked up.")) return;
    setBusy(true);
    try {
      const { error, count } = await supabase
        .from("kannada_queue_items" as any)
        .update({
          status: "cancelled",
          finished_at: new Date().toISOString(),
          last_error: "cancelled by admin (stop all)",
        }, { count: "exact" })
        .eq("server_ip", SERVER_78)
        .in("status", ["queued", "processing"]);
      if (error) throw error;
      toast({ title: `Stopped ${count ?? 0} item(s) on .78` });
      qc.invalidateQueries({ queryKey: ["server78-queue"] });
      qc.invalidateQueries({ queryKey: ["server78-jobs-scan"] });
    } catch (e: any) {
      toast({ title: "Stop failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const allVisibleSelected = visibleJobs.length > 0 &&
    visibleJobs.every((r) => selected[r.job_id] || blockedIds.has(r.job_id));

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Server .78 Cloud Jobs — Kannada Queue</h1>
        <p className="text-sm text-muted-foreground">
          All jobs <strong>except</strong> those generated on <code>{SERVER_4}</code> and
          jobs already fully covered in Kannada. All Kannada requests from this page
          are routed to the .78 Cloud Job API (FTP-backed).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Total (non-.4): {scan.data?.length ?? 0}</Badge>
        <Badge variant="secondary">Shown: {visibleJobs.length}/{filteredJobs.length}</Badge>
        <Badge className="bg-emerald-500">
          Active queue: {blockedIds.size}
        </Badge>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <Checkbox
              checked={onlyMissingKannada}
              onCheckedChange={(v) => setOnlyMissingKannada(!!v)}
            />
            Only without Kannada
          </label>
          <Input
            placeholder="Search doc / topic / job id..."
            className="w-56 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="border rounded px-2 py-1 text-sm bg-background"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          >
            <option value="all">All subjects</option>
            {subjects.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={() => { scan.refetch(); queue.refetch(); }}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button size="sm" variant="destructive" onClick={stopAllProcessing} disabled={busy}>
            Stop All Processing
          </Button>
          <Button size="sm" variant="outline" onClick={kickWorker}>
            <PlayCircle className="h-4 w-4 mr-1" /> Kick worker
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Jobs</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy || !selectedRows.length}
              onClick={() => enqueue(selectedRows, "selected")}
            >
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Rocket className="h-4 w-4 mr-1" />}
              Run Selected ({selectedRows.length})
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || !filteredJobs.length}
              onClick={() => enqueue(filteredJobs, "all")}
            >
              <Rocket className="h-4 w-4 mr-1" />
              Run All ({filteredJobs.filter((r) => !blockedIds.has(r.job_id) && r.external_job_id).length})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {scan.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              <div className="border rounded overflow-auto max-h-[600px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-8">
                        <Checkbox
                          checked={allVisibleSelected}
                          onCheckedChange={(v) => {
                            const next = { ...selected };
                            visibleJobs.forEach((r) => {
                              if (!blockedIds.has(r.job_id) && r.external_job_id) {
                                next[r.job_id] = !!v;
                              }
                            });
                            setSelected(next);
                          }}
                        />
                      </TableHead>
                      <TableHead>Job ID</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Ch</TableHead>
                      <TableHead>Topic</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>Kannada</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleJobs.map((r) => {
                      const blocked = blockedIds.has(r.job_id) || !r.external_job_id;
                      return (
                        <TableRow key={r.job_id} className={blocked ? "opacity-60" : ""}>
                          <TableCell>
                            <Checkbox
                              disabled={blocked}
                              checked={!!selected[r.job_id]}
                              onCheckedChange={(v) =>
                                setSelected((s) => ({ ...s, [r.job_id]: !!v }))
                              }
                            />
                          </TableCell>
                          <TableCell className="text-xs font-mono">{r.external_job_id ?? "—"}</TableCell>
                          <TableCell className="text-xs">{r.subject_name}</TableCell>
                          <TableCell className="text-xs">{r.chapter_number ?? "-"}</TableCell>
                          <TableCell className="text-xs truncate max-w-[180px]">{r.topic_title ?? "—"}</TableCell>
                          <TableCell className="text-xs truncate max-w-[240px]">{r.document_name}</TableCell>
                          <TableCell className="text-xs">
                            <Badge
                              variant={
                                r.coverage_status === "full"
                                  ? "default"
                                  : r.coverage_status === "partial"
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              {r.kannada_sections}/{r.total_sections}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {blocked ? (
                              <Badge variant="outline">in queue</Badge>
                            ) : (
                              <Badge variant="outline">eligible</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!visibleJobs.length && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                          No jobs found on server .78
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {!showAll && filteredJobs.length > PAGE_SIZE && (
                <div className="flex justify-center mt-3">
                  <Button variant="outline" onClick={() => setShowAll(true)}>
                    View all {filteredJobs.length} jobs
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Queue on .78 ({queue.data?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded overflow-auto max-h-96">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Topic</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(queue.data ?? []).map((q) => (
                  <TableRow key={q.id}>
                    <TableCell><StatusBadge s={q.status} /></TableCell>
                    <TableCell className="text-xs font-mono">{q.external_job_id}</TableCell>
                    <TableCell className="text-xs">{q.subject_name}</TableCell>
                    <TableCell className="text-xs truncate max-w-[160px]">{q.topic_title ?? "—"}</TableCell>
                    <TableCell className="text-xs truncate max-w-[220px]">{q.document_name}</TableCell>
                    <TableCell className="text-xs">{q.attempts}</TableCell>
                    <TableCell className="text-xs text-red-600 truncate max-w-[220px]" title={q.last_error ?? ""}>
                      {q.last_error}
                    </TableCell>
                    <TableCell className="flex gap-1">
                      {q.status === "failed" && (
                        <Button size="sm" variant="outline" onClick={() => retryItem(q.id)}>
                          Retry
                        </Button>
                      )}
                      {(q.status === "queued" || q.status === "cancelled" || q.status === "failed") && (
                        <Button size="icon" variant="ghost" onClick={() => deleteItem(q.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!(queue.data ?? []).length && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground text-sm py-6">
                      Queue is empty
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
