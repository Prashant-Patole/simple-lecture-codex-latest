import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Download, Search, Rocket } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TARGET_SERVER_IP = "69.197.145.4";

type Row = {
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
  created_at: string | null;
};

const SUBJECTS = [
  { key: "social", label: "Social Science", db: "Social Science" },
  { key: "maths", label: "Maths", db: "Maths" },
  { key: "science", label: "Science", db: "Science" },
] as const;

function useScan(subject: string) {
  return useQuery({
    queryKey: ["kannada-coverage-scan", subject],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_kannada_coverage_scan" as any,
        { p_subject_name: subject }
      );
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    staleTime: 60_000,
  });
}

function statusBadge(s: Row["coverage_status"]) {
  if (s === "full")
    return <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">Full</Badge>;
  if (s === "partial")
    return <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30">Partial</Badge>;
  return <Badge className="bg-destructive/15 text-destructive border-destructive/30">Missing</Badge>;
}

function downloadCsv(rows: Row[], filename: string) {
  const headers = [
    "external_job_id",
    "document_name",
    "chapter_number",
    "chapter_title",
    "topic_title",
    "total_sections",
    "kannada_sections",
    "coverage_status",
    "server_ip",
    "created_at",
  ];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.external_job_id,
        r.document_name,
        r.chapter_number,
        r.chapter_title,
        r.topic_title,
        r.total_sections,
        r.kannada_sections,
        r.coverage_status,
        r.server_ip,
        r.created_at,
      ]
        .map(escape)
        .join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function SubjectPanel({ subjectDb, label }: { subjectDb: string; label: string }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useScan(subjectDb);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "missing" | "partial" | "full">("all");
  const [serverFilter, setServerFilter] = useState<"target" | "other" | "all">("target");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  const rows = data ?? [];

  const serverScoped = useMemo(() => {
    if (serverFilter === "all") return rows;
    if (serverFilter === "target") return rows.filter((r) => r.server_ip === TARGET_SERVER_IP);
    return rows.filter((r) => r.server_ip !== TARGET_SERVER_IP);
  }, [rows, serverFilter]);

  const summary = useMemo(() => {
    const total = serverScoped.length;
    const full = serverScoped.filter((r) => r.coverage_status === "full").length;
    const partial = serverScoped.filter((r) => r.coverage_status === "partial").length;
    const missing = serverScoped.filter((r) => r.coverage_status === "missing").length;
    return { total, full, partial, missing };
  }, [serverScoped]);

  const targetCount = useMemo(() => rows.filter((r) => r.server_ip === TARGET_SERVER_IP).length, [rows]);
  const otherCount = rows.length - targetCount;

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return serverScoped.filter((r) => {
      if (filter !== "all" && r.coverage_status !== filter) return false;
      if (!ql) return true;
      return (
        (r.external_job_id ?? "").toLowerCase().includes(ql) ||
        (r.document_name ?? "").toLowerCase().includes(ql) ||
        (r.chapter_title ?? "").toLowerCase().includes(ql) ||
        (r.topic_title ?? "").toLowerCase().includes(ql) ||
        (r.server_ip ?? "").toLowerCase().includes(ql)
      );
    });
  }, [serverScoped, q, filter]);

  const selectedRows = useMemo(
    () => filtered.filter((r) => selected[r.job_id] && r.external_job_id),
    [filtered, selected]
  );
  const allSelected = filtered.length > 0 && filtered.every((r) => selected[r.job_id]);

  const toggleAll = () => {
    if (allSelected) {
      const next = { ...selected };
      filtered.forEach((r) => delete next[r.job_id]);
      setSelected(next);
    } else {
      const next = { ...selected };
      filtered.forEach((r) => { next[r.job_id] = true; });
      setSelected(next);
    }
  };

  const selectMissingPartial = () => {
    const next: Record<string, boolean> = {};
    serverScoped.forEach((r) => {
      if (r.coverage_status !== "full" && r.external_job_id) next[r.job_id] = true;
    });
    setSelected(next);
  };

  const generateKannada = async () => {
    if (selectedRows.length === 0) {
      toast({ title: "Nothing selected", description: "Pick jobs to generate Kannada for." });
      return;
    }
    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const jobQueue = selectedRows.map((r) => ({
        video_job_id: r.job_id,
        external_job_id: r.external_job_id!,
        server_ip: TARGET_SERVER_IP, // force generation on the target server
        chapter_title: r.chapter_title ?? "",
        document_name: r.document_name,
        languages: ["kannada"],
        status: "pending" as const,
        error_message: null,
        submitted_at: null,
        completed_at: null,
        stall_detected_at: null,
        last_progress_count: null,
      }));

      const { error: insErr } = await supabase.from("language_generation_runs").insert({
        subject_name: subjectDb,
        subject_id: null as any,
        status: "processing",
        languages: ["kannada"],
        speaker: "default",
        server_ip: TARGET_SERVER_IP,
        job_queue: jobQueue as any,
        total_jobs: jobQueue.length,
        completed_jobs: 0,
        failed_jobs: 0,
        skipped_jobs: 0,
        current_job_index: 0,
        created_by: userData.user?.id ?? null,
      });
      if (insErr) throw insErr;

      toast({
        title: "Kannada generation queued",
        description: `${jobQueue.length} job(s) routed to ${TARGET_SERVER_IP}. Worker will process them shortly.`,
      });
      setSelected({});
    } catch (e: any) {
      toast({ title: "Failed to queue", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Server segregation */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground mr-1">Server:</span>
        <Button
          size="sm"
          variant={serverFilter === "target" ? "default" : "outline"}
          onClick={() => { setServerFilter("target"); setSelected({}); }}
        >
          {TARGET_SERVER_IP} ({targetCount})
        </Button>
        <Button
          size="sm"
          variant={serverFilter === "other" ? "default" : "outline"}
          onClick={() => { setServerFilter("other"); setSelected({}); }}
        >
          Other servers ({otherCount})
        </Button>
        <Button
          size="sm"
          variant={serverFilter === "all" ? "default" : "outline"}
          onClick={() => { setServerFilter("all"); setSelected({}); }}
        >
          All ({rows.length})
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Jobs</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{summary.total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Full Kannada</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-emerald-500">{summary.full}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Partial</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-amber-500">{summary.partial}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Missing Kannada</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-destructive">{summary.missing}</CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by job ID, document, chapter, topic, IP…"
            className="pl-8"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "missing", "partial", "full"] as const).map((k) => (
            <Button
              key={k}
              size="sm"
              variant={filter === k ? "default" : "outline"}
              onClick={() => setFilter(k)}
              className="capitalize"
            >
              {k}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={selectMissingPartial}>
          Select missing/partial
        </Button>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rescan"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            downloadCsv(filtered, `kannada-coverage-${subjectDb.replace(/\s+/g, "-").toLowerCase()}.csv`)
          }
          disabled={filtered.length === 0}
        >
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
        <Button
          size="sm"
          onClick={generateKannada}
          disabled={submitting || selectedRows.length === 0}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Rocket className="h-4 w-4 mr-1" />}
          Generate Kannada on {TARGET_SERVER_IP} ({selectedRows.length})
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Scanning {label}…
            </div>
          ) : isError ? (
            <div className="p-6 text-sm text-destructive">
              Failed to load scan: {(error as Error)?.message}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No matching jobs.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                    </TableHead>
                    <TableHead>Chapter</TableHead>
                    <TableHead>Topic / Document</TableHead>
                    <TableHead>External Job ID</TableHead>
                    <TableHead>Server IP</TableHead>
                    <TableHead className="text-right">Sections</TableHead>
                    <TableHead className="text-right">Kannada</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.job_id}>
                      <TableCell>
                        <Checkbox
                          checked={!!selected[r.job_id]}
                          disabled={!r.external_job_id}
                          onCheckedChange={(v) =>
                            setSelected((prev) => ({ ...prev, [r.job_id]: !!v }))
                          }
                          aria-label="Select row"
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.chapter_number != null && (
                          <span className="text-muted-foreground mr-1">#{r.chapter_number}</span>
                        )}
                        {r.chapter_title ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[360px]">
                        <div className="font-medium truncate">{r.topic_title ?? "—"}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {r.document_name ?? ""}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.external_job_id ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.server_ip ? (
                          <Badge
                            variant="outline"
                            className={
                              r.server_ip === TARGET_SERVER_IP
                                ? "border-primary/40 text-primary"
                                : "border-muted-foreground/30 text-muted-foreground"
                            }
                          >
                            {r.server_ip}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{r.total_sections}</TableCell>
                      <TableCell className="text-right">
                        {r.kannada_sections} / {r.total_sections}
                      </TableCell>
                      <TableCell>{statusBadge(r.coverage_status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function KannadaCoverageScan() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Kannada Coverage Scan</h1>
        <p className="text-sm text-muted-foreground">
          Scans published, completed lectures and shows Kannada coverage per subject, segregated by generation
          server. Select jobs and use <span className="font-medium">Generate Kannada on {TARGET_SERVER_IP}</span>{" "}
          to queue a language-generation run that routes each selected job to that server. The
          language-generation-worker will submit to <code>{TARGET_SERVER_IP}:5005</code>, update
          <code> language_avatar_jobs</code>, and refresh <code>presentation.json</code> (with Vimeo/B2 URLs)
          on success.
        </p>
      </div>

      <Tabs defaultValue="social" className="w-full">
        <TabsList>
          {SUBJECTS.map((s) => (
            <TabsTrigger key={s.key} value={s.key}>
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {SUBJECTS.map((s) => (
          <TabsContent key={s.key} value={s.key} className="mt-4">
            <SubjectPanel subjectDb={s.db} label={s.label} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
