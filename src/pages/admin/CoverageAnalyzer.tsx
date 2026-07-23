import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { SUPABASE_URL } from "@/lib/supabaseUrl";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Play, RefreshCw, Trash2, Activity, FileJson, Search, ChevronDown, ChevronRight, Download, AlertTriangle, CheckCircle2, Plus, ListPlus } from "lucide-react";
import GapPatcherQueuePanel from "@/components/admin/GapPatcherQueuePanel";
import { useAddToGapQueue, useBulkQueueBelow75, useGapPatcherQueue } from "@/hooks/useGapPatcherQueue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ---- helpers -------------------------------------------------------------
type CovResult = {
  job_id: string;
  title?: string;
  status?: string;
  error?: string;
  coverage?: {
    coverage_percent?: number;
    coverage_rating?: string;
    coverage_summary?: string;
    topics_covered?: string[];
    topics_missing?: string[];
    topics_under_covered?: string[];
    recommendations?: string[];
    suggested_additional_sections?: { title: string; reason: string }[];
  };
  section_stats?: {
    total_sections?: number;
    total_narration_words?: number;
    sections_detail?: any[];
  };
};

function coverageBadgeVariant(pct?: number): "default" | "secondary" | "destructive" {
  if (pct == null) return "secondary";
  if (pct >= 85) return "default";
  if (pct >= 60) return "secondary";
  return "destructive";
}

function coverageInfo(r?: CovResult) {
  const pct = r?.coverage?.coverage_percent;
  const hasCov = r && r.coverage && Object.keys(r.coverage).length > 0 && pct != null;
  return {
    pct,
    rating: r?.coverage?.coverage_rating,
    hasCov: !!hasCov,
    isError: r?.status && r.status !== "ok",
    reason: r?.error || (r && r.status === "ok" && !hasCov ? "Analyzer returned no coverage data (likely presentation/markdown schema mismatch). Re-run this job to retry." : undefined),
  };
}

function buildResultMap(report: any): Map<string, CovResult> {
  const m = new Map<string, CovResult>();
  const results: CovResult[] = Array.isArray(report?.results) ? report.results : [];
  results.forEach((r) => { if (r?.job_id) m.set(r.job_id, r); });
  return m;
}

function aggregateStats(report: any) {
  const results: CovResult[] = Array.isArray(report?.results) ? report.results : [];
  if (!results.length) return null;
  const withPct = results.filter((r) => r.coverage?.coverage_percent != null);
  const avg = withPct.length
    ? Math.round(withPct.reduce((s, r) => s + (r.coverage!.coverage_percent as number), 0) / withPct.length)
    : null;
  const missing = results.filter((r) => (r.status && r.status !== "ok") || r.coverage?.coverage_percent == null);
  return { total: results.length, avg, missingCount: missing.length, missingJobs: missing.map((r) => r.job_id) };
}

function CoverageBadge({ r }: { r?: CovResult }) {
  const info = coverageInfo(r);
  if (info.isError || !info.hasCov) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <AlertTriangle className="h-3 w-3" /> no data
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{info.reason || "No coverage data"}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return (
    <Badge variant={coverageBadgeVariant(info.pct)}>
      {info.pct}%{info.rating ? ` · ${info.rating}` : ""}
    </Badge>
  );
}
import {
  useAnalyzerHealth,
  useStartAnalyzerRun,
  useAnalyzerRunStatus,
  useSavedCoverageReports,
  useDeleteCoverageReport,
  useMarkCoverageReportCompleted,
} from "@/hooks/useCoverageAnalyzer";

type PublishFilter = "all" | "published" | "unpublished";

export default function CoverageAnalyzer() {
  const [subjectId, setSubjectId] = useState<string>("all");
  const [publishFilter, setPublishFilter] = useState<PublishFilter>("published");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<"publish" | "unpublish" | "analyze">("analyze");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [viewReport, setViewReport] = useState<any>(null);

  const subjectsQ = useQuery({
    queryKey: ["cov-analyzer-subjects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("popular_subjects")
        .select("id,name")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const topicsQ = useQuery({
    queryKey: ["cov-analyzer-topics"],
    queryFn: async () => {
      const subjects = ["Social Science", "Maths", "Science", "English", "Kannada", "Hindi"];
      const { data, error } = await supabase.rpc(
        "scan_video_generation_coverage" as any,
        { p_subject_names: subjects },
      );
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const candidates = useMemo(() => {
    if (!topicsQ.data) return [];
    return topicsQ.data
      .filter((r: any) => r.latest_external_job_id)
      .map((r: any) => ({
        externalJobId: r.latest_external_job_id as string,
        subjectName: r.subject_name ?? "",
        chapterTitle: r.chapter_title ?? "",
        topicTitle: r.topic_title ?? "",
        isPublished: (r.published_completed_jobs ?? 0) > 0,
      }));
  }, [topicsQ.data]);

  const filtered = useMemo(() => {
    const subjName = subjectsQ.data?.find((s: any) => s.id === subjectId)?.name;
    return candidates.filter((c) => {
      if (subjectId !== "all" && subjName && c.subjectName !== subjName) return false;
      if (publishFilter === "published" && !c.isPublished) return false;
      if (publishFilter === "unpublished" && c.isPublished) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !c.topicTitle.toLowerCase().includes(q) &&
          !c.chapterTitle.toLowerCase().includes(q) &&
          !c.subjectName.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [candidates, subjectId, subjectsQ.data, publishFilter, search]);

  const subjectPrefix = useMemo(() => {
    const n = subjectsQ.data?.find((s: any) => s.id === subjectId)?.name;
    return n ? n.replace(/\s+/g, "") : undefined;
  }, [subjectId, subjectsQ.data]);

  // jobId → { subject, chapter, topic } map, reused across results/log
  const jobMeta = useMemo(() => {
    const m = new Map<string, { subjectName: string; chapterTitle: string; topicTitle: string }>();
    (topicsQ.data ?? []).forEach((r: any) => {
      if (r?.latest_external_job_id) {
        m.set(r.latest_external_job_id, {
          subjectName: r.subject_name ?? "",
          chapterTitle: r.chapter_title ?? "",
          topicTitle: r.topic_title ?? "",
        });
      }
    });
    return m;
  }, [topicsQ.data]);

  const health = useAnalyzerHealth();
  const startRun = useStartAnalyzerRun();
  const runStatus = useAnalyzerRunStatus(activeRunId);
  const savedReports = useSavedCoverageReports({});
  const deleteReport = useDeleteCoverageReport();
  const markCompleted = useMarkCoverageReportCompleted();


  // Auto-refresh non-terminal saved reports: hitting the proxy GET updates the DB row
  const refreshedRef = useRef<Set<string>>(new Set());
  const refreshReport = async (runId: string) => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      await fetch(`${SUPABASE_URL}/functions/v1/coverage-analyzer-proxy/api/analyze/${runId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      savedReports.refetch();
    } catch (e) { /* noop */ }
  };
  useEffect(() => {
    const rows = savedReports.data ?? [];
    const terminal = ["done", "failed", "error", "completed"];
    for (const r of rows as any[]) {
      if (!r.run_id) continue;
      if (terminal.includes(r.status)) continue;
      if (refreshedRef.current.has(r.run_id)) continue;
      refreshedRef.current.add(r.run_id);
      refreshReport(r.run_id);
    }
  }, [savedReports.data]);


  const handleRun = async () => {
    if (!filtered.length) {
      toast.error("No jobs match the current filters");
      return;
    }
    try {
      const job_ids = filtered.map((c) => c.externalJobId);
      const res = await startRun.mutateAsync({
        job_ids,
        type: subjectPrefix,
        action,
      } as any);
      if (res?.run_id) {
        setActiveRunId(res.run_id);
        toast.success(`Run started: ${res.run_id} (${res.job_count} jobs)`);
      } else {
        toast.error("No run_id returned");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to start run");
    }
  };

  const runData: any = runStatus.data;
  const isTerminal = runData?.status && ["done", "failed", "error", "completed"].includes(runData.status);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Coverage Analyzer</h1>
          <p className="text-sm text-muted-foreground">
            Pick a subject and publish filter, then send those jobs to the Coverage Analyzer API. Reports are saved automatically.
          </p>
        </div>
        <Badge variant={health.data?.status === "ok" ? "default" : "destructive"} className="gap-1">
          <Activity className="h-3 w-3" />
          {health.isLoading ? "Checking..." : health.data?.status === "ok" ? "API Online" : "API Offline"}
        </Badge>
      </div>

      {/* Filters + trigger */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Jobs</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div>
            <Label>Subject</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {(subjectsQ.data ?? []).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Publish state</Label>
            <Select value={publishFilter} onValueChange={(v) => setPublishFilter(v as PublishFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All (published + not)</SelectItem>
                <SelectItem value="published">Published only</SelectItem>
                <SelectItem value="unpublished">Unpublished only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Action</Label>
            <Select value={action} onValueChange={(v) => setAction(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="analyze">Analyze only</SelectItem>
                <SelectItem value="publish">Publish</SelectItem>
                <SelectItem value="unpublish">Unpublish</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="topic / chapter / subject"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="md:col-span-4 flex flex-wrap items-center gap-3">
            <div className="text-sm text-muted-foreground">
              <b>{filtered.length}</b> jobs match • {candidates.length} total
            </div>
            <Button onClick={handleRun} disabled={startRun.isPending || !filtered.length}>
              {startRun.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
              Run analyzer on {filtered.length} jobs
            </Button>
            <Button variant="ghost" onClick={() => { topicsQ.refetch(); health.refetch(); }}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Check coverage by Job ID */}
      <SingleJobCoverageCard
        onStarted={(runId) => setActiveRunId(runId)}
        startRun={startRun}
      />



      {/* Preview of selected jobs */}
      {filtered.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Selected Jobs Preview</CardTitle></CardHeader>
          <CardContent className="max-h-64 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Chapter</TableHead>
                  <TableHead>Topic</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Job ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 50).map((c) => (
                  <TableRow key={c.externalJobId}>
                    <TableCell>{c.subjectName}</TableCell>
                    <TableCell>{c.chapterTitle}</TableCell>
                    <TableCell>{c.topicTitle}</TableCell>
                    <TableCell>
                      <Badge variant={c.isPublished ? "default" : "secondary"}>
                        {c.isPublished ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{c.externalJobId}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filtered.length > 50 && (
              <div className="text-xs text-muted-foreground mt-2">
                Showing 50 of {filtered.length}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Active run */}
      {activeRunId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              Active Run <span className="font-mono text-sm">{activeRunId}</span>
            </CardTitle>
            <Badge variant={isTerminal ? "default" : "secondary"}>
              {runData?.status ?? "polling..."}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm">
              <div><b>Jobs:</b> {(runData?.jobs || []).length}</div>
              <div><b>Started:</b> {runData?.started_at || "—"}</div>
              <div><b>Finished:</b> {runData?.finished_at || "—"}</div>
            </div>
            {runData?.results?.length > 0 && (() => {
              const agg = aggregateStats(runData);
              return (
                <div className="text-sm flex flex-wrap items-center gap-2">
                  <span><b>Avg coverage:</b> {agg?.avg ?? "—"}%</span>
                  <span>·</span>
                  <span><b>Jobs:</b> {agg?.total}</span>
                  <span>·</span>
                  <span className={agg && agg.missingCount > 0 ? "text-destructive" : ""}>
                    <b>Missing/error:</b> {agg?.missingCount ?? 0}
                  </span>
                  {agg && agg.missingCount > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-2"
                      onClick={async () => {
                        try {
                          const res = await startRun.mutateAsync({
                            job_ids: agg.missingJobs,
                            type: subjectPrefix,
                            action: "analyze",
                          } as any);
                          if (res?.run_id) {
                            setActiveRunId(res.run_id);
                            toast.success(`Re-running ${agg.missingJobs.length} missing jobs`);
                          }
                        } catch (e: any) {
                          toast.error(e.message || "Failed to re-run");
                        }
                      }}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" /> Re-run missing
                    </Button>
                  )}
                </div>
              );
            })()}

            <Tabs defaultValue="log">
              <TabsList>
                <TabsTrigger value="log">Log</TabsTrigger>
                <TabsTrigger value="results">
                  Results {runData?.results?.length ? `(${runData.results.length})` : ""}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="log">
                <RunLog log={runData?.log} report={runData} jobMeta={jobMeta} />
              </TabsContent>
              <TabsContent value="results">
                <ResultsTable report={runData} jobMeta={jobMeta} />
              </TabsContent>
            </Tabs>

            {isTerminal && (
              <Button variant="outline" size="sm" onClick={() => setActiveRunId(null)}>Close</Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Gap Patcher Queue — always visible */}
      <GapPatcherQueuePanel jobMeta={jobMeta} />



      {/* Saved reports */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Saved Reports</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run ID</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Coverage%</TableHead>
                <TableHead>Avg / Missing</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {savedReports.data?.map((r: any) => {
                const agg = aggregateStats(r.report);
                return (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.run_id}</TableCell>
                  <TableCell>{r.subject_prefix || "—"}</TableCell>
                  <TableCell>{r.publish_action || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "done" ? "default" : r.status === "failed" ? "destructive" : "secondary"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.coverage_percent ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {agg ? (
                      <span>
                        avg <b>{agg.avg ?? "—"}%</b> ·{" "}
                        <span className={agg.missingCount > 0 ? "text-destructive" : ""}>
                          {agg.missingCount}/{agg.total} missing
                        </span>
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-xs">{r.started_at ? new Date(r.started_at).toLocaleString() : "—"}</TableCell>
                  <TableCell className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => refreshReport(r.run_id)} title="Refresh status">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setViewReport(r)}>
                      <FileJson className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Mark as completed"
                      disabled={r.status === "completed" || markCompleted.isPending}
                      onClick={() => markCompleted.mutate(r.id, {
                        onSuccess: () => toast.success("Marked completed"),
                        onError: (e: any) => toast.error(e.message || "Failed"),
                      })}
                    >
                      <CheckCircle2 className={`h-4 w-4 ${r.status === "completed" ? "text-green-500" : ""}`} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteReport.mutate(r.id)}
                      disabled={deleteReport.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
                );
              })}
              {(!savedReports.data || savedReports.data.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                    No saved reports yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!viewReport} onOpenChange={(o) => !o && setViewReport(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Report — {viewReport?.run_id}</DialogTitle>
          </DialogHeader>
          {viewReport && (
            <Tabs defaultValue="results">
              <TabsList>
                <TabsTrigger value="results">Results</TabsTrigger>
                <TabsTrigger value="log">Log</TabsTrigger>
                <TabsTrigger value="raw">Raw JSON</TabsTrigger>
              </TabsList>
              <TabsContent value="results">
                <ResultsTable report={viewReport.report} jobMeta={jobMeta} />
              </TabsContent>
              <TabsContent value="log">
                <RunLog log={viewReport.report?.log || viewReport.log} report={viewReport.report} jobMeta={jobMeta} />
              </TabsContent>
              <TabsContent value="raw">
                <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-[60vh]">
                  {JSON.stringify(viewReport, null, 2)}
                </pre>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- RunLog: annotates "Analyzing: <job_id>" lines with coverage badge ----
type JobMetaMap = Map<string, { subjectName: string; chapterTitle: string; topicTitle: string }>;

function RunLog({ log, report, jobMeta }: { log?: any[]; report?: any; jobMeta?: JobMetaMap }) {
  const byJob = useMemo(() => buildResultMap(report), [report]);
  const lines = Array.isArray(log) ? log : [];
  if (!lines.length) {
    return <div className="bg-muted rounded p-2 text-xs font-mono">Waiting for logs...</div>;
  }
  return (
    <div className="bg-muted rounded p-2 max-h-96 overflow-auto font-mono text-xs space-y-0.5">
      {lines.map((l: any, i: number) => {
        const msg: string = l.msg ?? "";
        const m = msg.match(/Analyzing:\s+(\S+)/);
        const r = m ? byJob.get(m[1]) : undefined;
        const meta = m ? jobMeta?.get(m[1]) : undefined;
        return (
          <div key={i} className="flex items-start gap-2">
            <span className="text-muted-foreground shrink-0">[{l.ts?.slice(11, 19)}]</span>
            <span className="flex-1 break-all">
              {msg}
              {meta && (
                <span className="ml-2 text-muted-foreground">
                  — {meta.subjectName} › {meta.chapterTitle} › {meta.topicTitle}
                </span>
              )}
            </span>
            {r && <CoverageBadge r={r} />}
          </div>
        );
      })}
    </div>
  );
}

// ---- CoverageDistribution: bucket summary above ResultsTable ----
type DistBucket = "b90" | "b80" | "b70" | "b60" | "blow" | "bnone";

function computeDistribution(results: CovResult[]) {
  const counts: Record<DistBucket, number> = { b90: 0, b80: 0, b70: 0, b60: 0, blow: 0, bnone: 0 };
  for (const r of results) {
    const info = coverageInfo(r);
    if (!info.hasCov) { counts.bnone++; continue; }
    const p = info.pct as number;
    if (p >= 90) counts.b90++;
    else if (p >= 80) counts.b80++;
    else if (p >= 70) counts.b70++;
    else if (p >= 60) counts.b60++;
    else counts.blow++;
  }
  return counts;
}

function CoverageDistribution({
  results,
  onBucketClick,
}: {
  results: CovResult[];
  onBucketClick?: (f: "full" | "partial" | "low" | "nodata") => void;
}) {
  const total = results.length;
  if (!total) return null;
  const counts = useMemo(() => computeDistribution(results), [results]);
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const rows: { key: DistBucket; label: string; count: number; filter?: "full" | "partial" | "low" | "nodata" }[] = [
    { key: "b90", label: "90–100%", count: counts.b90, filter: "full" },
    { key: "b80", label: "80–89%", count: counts.b80, filter: "full" },
    { key: "b70", label: "70–79%", count: counts.b70, filter: "partial" },
    { key: "b60", label: "60–69%", count: counts.b60, filter: "partial" },
    { key: "blow", label: "Below 60%", count: counts.blow, filter: "low" },
    { key: "bnone", label: "No data / error", count: counts.bnone, filter: "nodata" },
  ];
  return (
    <div className="rounded-md border">
      <div className="px-3 py-2 text-sm font-medium border-b bg-muted/40">Coverage Distribution</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bucket</TableHead>
            <TableHead className="text-right">Topics</TableHead>
            <TableHead className="text-right">%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.key}
              className={onBucketClick && row.filter ? "cursor-pointer hover:bg-muted/60" : ""}
              onClick={() => row.filter && onBucketClick?.(row.filter)}
            >
              <TableCell className="text-sm">{row.label}</TableCell>
              <TableCell className="text-right text-sm font-medium">{row.count}</TableCell>
              <TableCell className="text-right text-xs text-muted-foreground">{pct(row.count)}%</TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/30 font-medium">
            <TableCell>Total</TableCell>
            <TableCell className="text-right">{total}</TableCell>
            <TableCell className="text-right text-xs">100%</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

// ---- ResultsTable: per-job coverage details with row expansion ----
const JOB_DONE_KEY = "coverage-analyzer:job-completed";
function loadDoneJobs(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(JOB_DONE_KEY) || "[]")); }
  catch { return new Set(); }
}
function saveDoneJobs(s: Set<string>) {
  try { localStorage.setItem(JOB_DONE_KEY, JSON.stringify(Array.from(s))); } catch {}
}

function ResultsTable({ report, jobMeta }: { report?: any; jobMeta?: JobMetaMap }) {
  const results: CovResult[] = Array.isArray(report?.results) ? report.results : [];
  const [filter, setFilter] = useState<"all" | "ok" | "error" | "nodata" | "low" | "partial" | "full">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [jobSearch, setJobSearch] = useState("");
  const [doneJobs, setDoneJobs] = useState<Set<string>>(() => loadDoneJobs());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const addToQueue = useAddToGapQueue();
  const bulkQueue = useBulkQueueBelow75();
  const queueQ = useGapPatcherQueue();
  const queuedSet = useMemo(() => new Set((queueQ.data ?? []).map((r) => r.external_job_id)), [queueQ.data]);
  const toggleSelected = (jobId: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(jobId) ? n.delete(jobId) : n.add(jobId);
      return n;
    });
  };
  const toggleDone = (jobId: string) => {
    setDoneJobs((prev) => {
      const n = new Set(prev);
      n.has(jobId) ? n.delete(jobId) : n.add(jobId);
      saveDoneJobs(n);
      return n;
    });
  };

  // Server IP lookup — joins video_generation_jobs.external_job_id → server_ip
  const jobIds = useMemo(
    () => Array.from(new Set(results.map((r) => r.job_id).filter(Boolean))),
    [results]
  );
  const serverIpQuery = useQuery({
    queryKey: ["cov-server-ips", jobIds],
    enabled: jobIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_generation_jobs")
        .select("external_job_id, server_ip")
        .in("external_job_id", jobIds);
      if (error) throw error;
      const map = new Map<string, string | null>();
      (data || []).forEach((row: any) => {
        if (row.external_job_id) map.set(row.external_job_id, row.server_ip ?? null);
      });
      return map;
    },
  });
  const serverIpMap = serverIpQuery.data;

  const filtered = useMemo(() => {
    const q = jobSearch.trim().toLowerCase();
    return results.filter((r) => {
      if (q) {
        const meta = jobMeta?.get(r.job_id);
        const hay = `${r.job_id ?? ""} ${r.title ?? ""} ${meta?.subjectName ?? ""} ${meta?.chapterTitle ?? ""} ${meta?.topicTitle ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const info = coverageInfo(r);
      switch (filter) {
        case "ok": return info.hasCov;
        case "error": return !!info.isError;
        case "nodata": return !info.hasCov && !info.isError;
        case "low": return info.hasCov && (info.pct as number) < 60;
        case "partial": return info.hasCov && (info.pct as number) >= 60 && (info.pct as number) < 85;
        case "full": return info.hasCov && (info.pct as number) >= 85;
        default: return true;
      }
    });
  }, [results, filter, jobSearch, jobMeta]);

  const exportCsv = () => {
    const header = ["job_id", "subject", "chapter", "topic", "server_ip", "title", "status", "coverage_percent", "rating", "topics_missing_count", "total_sections", "narration_words"];
    const rows = results.map((r) => {
      const meta = jobMeta?.get(r.job_id);
      return [
        r.job_id,
        meta?.subjectName ?? "",
        meta?.chapterTitle ?? "",
        meta?.topicTitle ?? "",
        serverIpMap?.get(r.job_id) ?? "",
        (r.title || "").replace(/"/g, '""'),
        r.status ?? "",
        r.coverage?.coverage_percent ?? "",
        r.coverage?.coverage_rating ?? "",
        r.coverage?.topics_missing?.length ?? 0,
        r.section_stats?.total_sections ?? "",
        r.section_stats?.total_narration_words ?? "",
      ];
    });
    const csv = [header, ...rows].map((row) => row.map((v) => `"${String(v)}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `coverage-results-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!results.length) {
    return <div className="text-sm text-muted-foreground p-4">No results in this run yet.</div>;
  }

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const chips: { key: typeof filter; label: string }[] = [
    { key: "all", label: `All (${results.length})` },
    { key: "ok", label: "OK" },
    { key: "full", label: "Full ≥85%" },
    { key: "partial", label: "Partial 60–84%" },
    { key: "low", label: "Low <60%" },
    { key: "nodata", label: "No data" },
    { key: "error", label: "Errors" },
  ];

  return (
    <div className="space-y-3">
      <CoverageDistribution results={results} onBucketClick={setFilter} />
      <div className="relative max-w-md">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search by job ID or title…"
          value={jobSearch}
          onChange={(e) => setJobSearch(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <Button
            key={c.key}
            size="sm"
            variant={filter === c.key ? "default" : "outline"}
            onClick={() => setFilter(c.key)}
          >
            {c.label}
          </Button>
        ))}
        <Button
          size="sm"
          variant="default"
          className="ml-auto"
          disabled={bulkQueue.isPending || selected.size === 0}
          onClick={() => {
            const eligible = results
              .filter((r) => selected.has(r.job_id))
              .map((r) => ({
                external_job_id: r.job_id,
                coverage_percent: r.coverage?.coverage_percent ?? null,
              }));
            if (!eligible.length) { toast.info("No jobs selected"); return; }
            bulkQueue.mutate(eligible, {
              onSuccess: ({ added, skipped }) => {
                toast.success(`Queued ${added}, skipped ${skipped} (already in queue)`);
                setSelected(new Set());
              },
              onError: (e: any) => toast.error(e.message || "Failed"),
            });
          }}
        >
          <ListPlus className="h-4 w-4 mr-1" /> Queue selected ({selected.size})
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={bulkQueue.isPending}
          onClick={() => {
            const eligible = results
              .map((r) => ({
                external_job_id: r.job_id,
                coverage_percent: r.coverage?.coverage_percent ?? null,
              }))
              .filter((r) => r.coverage_percent != null && (r.coverage_percent as number) < 75);
            if (!eligible.length) { toast.info("No jobs below 75%"); return; }
            bulkQueue.mutate(eligible, {
              onSuccess: ({ added, skipped }) => toast.success(`Queued ${added}, skipped ${skipped} (already in queue)`),
              onError: (e: any) => toast.error(e.message || "Failed"),
            });
          }}
        >
          <ListPlus className="h-4 w-4 mr-1" /> Queue all &lt; 75%
        </Button>
        <Button size="sm" variant="ghost" onClick={exportCsv}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Button
          size="sm"
          variant="link"
          className="h-6 px-1"
          onClick={() => {
            const eligibleIds = filtered
              .filter((r) => !queuedSet.has(r.job_id))
              .map((r) => r.job_id);
            const allSel = eligibleIds.every((id) => selected.has(id));
            setSelected(allSel ? new Set() : new Set(eligibleIds));
          }}
        >
          {filtered.every((r) => queuedSet.has(r.job_id) || selected.has(r.job_id)) && filtered.length > 0
            ? "Clear selection"
            : "Select all visible"}
        </Button>
        <span>{selected.size} selected</span>
      </div>
      <div className="max-h-[55vh] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead className="w-8"></TableHead>
              <TableHead>#</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Chapter</TableHead>
              <TableHead>Topic</TableHead>
              <TableHead>Job / Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Server IP</TableHead>
              <TableHead>Coverage</TableHead>
              <TableHead>Sections</TableHead>
              <TableHead>Words</TableHead>
              <TableHead className="w-16 text-center">Done</TableHead>
              <TableHead className="w-16 text-center">Queue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r, i) => {
              const open = expanded.has(r.job_id);
              const info = coverageInfo(r);
              const isDone = doneJobs.has(r.job_id);
              const meta = jobMeta?.get(r.job_id);
              return (
                <Fragment key={r.job_id}>
                  <TableRow className="cursor-pointer" onClick={() => toggle(r.job_id)}>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-primary"
                        checked={selected.has(r.job_id)}
                        disabled={queuedSet.has(r.job_id)}
                        title={queuedSet.has(r.job_id) ? "Already in queue" : "Select for queueing"}
                        onChange={() => toggleSelected(r.job_id)}
                      />
                    </TableCell>
                    <TableCell>
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </TableCell>
                    <TableCell className="text-xs">{i + 1}</TableCell>
                    <TableCell className="text-xs">{meta?.subjectName || "—"}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate" title={meta?.chapterTitle}>{meta?.chapterTitle || "—"}</TableCell>
                    <TableCell className="text-xs max-w-[220px] truncate" title={meta?.topicTitle}>{meta?.topicTitle || "—"}</TableCell>
                    <TableCell className="max-w-md">
                      <div className="font-mono text-xs truncate">{r.job_id}</div>
                      <div className="text-xs text-muted-foreground truncate">{r.title || "—"}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === "ok" ? "default" : "destructive"}>{r.status ?? "—"}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{serverIpMap?.get(r.job_id) ?? (serverIpQuery.isLoading ? "…" : "—")}</TableCell>
                    <TableCell><CoverageBadge r={r} /></TableCell>
                    <TableCell className="text-xs">{r.section_stats?.total_sections ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.section_stats?.total_narration_words ?? "—"}</TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="ghost"
                        title={isDone ? "Marked completed (click to undo)" : "Mark as completed"}
                        onClick={() => toggleDone(r.job_id)}
                      >
                        <CheckCircle2 className={`h-4 w-4 ${isDone ? "text-green-500" : "text-muted-foreground"}`} />
                      </Button>
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={queuedSet.has(r.job_id) || addToQueue.isPending}
                        title={queuedSet.has(r.job_id) ? "Already in queue" : "Add to Gap Patcher queue"}
                        onClick={() => addToQueue.mutate({
                          external_job_id: r.job_id,
                          coverage_percent: r.coverage?.coverage_percent ?? null,
                        }, {
                          onSuccess: (added) => added ? toast.success("Queued") : toast.info("Already queued"),
                          onError: (e: any) => toast.error(e.message || "Failed"),
                        })}
                      >
                        <Plus className={`h-4 w-4 ${queuedSet.has(r.job_id) ? "text-muted-foreground" : ""}`} />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {open && (
                    <TableRow key={`${r.job_id}-x`}>
                      <TableCell colSpan={14} className="bg-muted/40">
                        <div className="space-y-3 p-2 text-sm">
                          {info.reason && !info.hasCov && (
                            <div className="text-xs text-destructive flex items-start gap-1">
                              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                              <span>{info.reason}</span>
                            </div>
                          )}
                          {r.coverage?.coverage_summary && (
                            <div>
                              <div className="font-medium mb-1">Summary</div>
                              <div className="text-xs">{r.coverage.coverage_summary}</div>
                            </div>
                          )}
                          <div className="grid md:grid-cols-2 gap-3">
                            {r.coverage?.topics_covered?.length ? (
                              <div>
                                <div className="font-medium mb-1">Topics covered ({r.coverage.topics_covered.length})</div>
                                <ul className="list-disc pl-5 text-xs space-y-0.5">
                                  {r.coverage.topics_covered.map((t, idx) => <li key={idx}>{t}</li>)}
                                </ul>
                              </div>
                            ) : null}
                            {r.coverage?.topics_missing?.length ? (
                              <div>
                                <div className="font-medium mb-1 text-destructive">Topics missing ({r.coverage.topics_missing.length})</div>
                                <ul className="list-disc pl-5 text-xs space-y-0.5">
                                  {r.coverage.topics_missing.map((t, idx) => <li key={idx}>{t}</li>)}
                                </ul>
                              </div>
                            ) : null}
                            {r.coverage?.topics_under_covered?.length ? (
                              <div>
                                <div className="font-medium mb-1">Under-covered</div>
                                <ul className="list-disc pl-5 text-xs space-y-0.5">
                                  {r.coverage.topics_under_covered.map((t, idx) => <li key={idx}>{t}</li>)}
                                </ul>
                              </div>
                            ) : null}
                            {r.coverage?.recommendations?.length ? (
                              <div>
                                <div className="font-medium mb-1">Recommendations</div>
                                <ul className="list-disc pl-5 text-xs space-y-0.5">
                                  {r.coverage.recommendations.map((t, idx) => <li key={idx}>{t}</li>)}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                          {r.coverage?.suggested_additional_sections?.length ? (
                            <div>
                              <div className="font-medium mb-1">Suggested sections</div>
                              <ul className="list-disc pl-5 text-xs space-y-0.5">
                                {r.coverage.suggested_additional_sections.map((s, idx) => (
                                  <li key={idx}><b>{s.title}</b> — {s.reason}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {r.section_stats?.sections_detail?.length ? (
                            <div>
                              <div className="font-medium mb-1">Sections</div>
                              <div className="text-xs">
                                {r.section_stats.sections_detail.map((s: any) => (
                                  <div key={s.section_id}>
                                    #{s.section_id} [{s.type}] {s.title} — {s.word_count}w · {s.renderer}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SingleJobCoverageCard({
  onStarted,
  startRun,
}: {
  onStarted: (runId: string) => void;
  startRun: ReturnType<typeof useStartAnalyzerRun>;
}) {
  const [jobId, setJobId] = useState("");

  const inferType = (id: string) => {
    const m = id.match(/^([A-Za-z]+)_/);
    return m ? m[1] : undefined;
  };

  const handleCheck = async () => {
    const id = jobId.trim();
    if (!id) {
      toast.error("Enter a job ID");
      return;
    }
    try {
      const res = await startRun.mutateAsync({
        job_ids: [id],
        type: inferType(id),
        action: "analyze",
      } as any);
      if (res?.run_id) {
        onStarted(res.run_id);
        toast.success(`Coverage check started for ${id}`);
      } else {
        toast.error("No run_id returned");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to start coverage check");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Check Coverage by Job ID</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[280px]">
          <Label>External Job ID</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8 font-mono"
              placeholder="e.g. Maths_20260213105803808_OS2HJU_1b526d7e"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCheck(); }}
            />
          </div>
        </div>
        <Button onClick={handleCheck} disabled={startRun.isPending || !jobId.trim()}>
          {startRun.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
          Check Coverage
        </Button>
        {jobId && (
          <Button variant="ghost" onClick={() => setJobId("")}>Clear</Button>
        )}
      </CardContent>
    </Card>
  );
}

