import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RefreshCw, ExternalLink, AlertTriangle, ShieldAlert, Loader2, Copy, Cloud } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getCdnMediaUrl } from "@/components/learning/player/utils/mediaResolver";

const CDN_BASE = "https://server1.simplelecture.com/video";

type CdnIntegrity = {
  section_count: number;
  english_sections_with_path: number;
  kannada_sections_with_path: number;
  missing_english_sections: number[];
  missing_kannada_sections: number[];
  integrity_status: Row["integrity_status"] | "unknown";
  reason: string;
};

function computeIntegrityFromPresentation(pj: any): CdnIntegrity {
  const sections: any[] = Array.isArray(pj?.sections) ? pj.sections : [];
  if (!pj) {
    return { section_count: 0, english_sections_with_path: 0, kannada_sections_with_path: 0,
      missing_english_sections: [], missing_kannada_sections: [],
      integrity_status: "no_presentation", reason: "presentation.json not on CDN" };
  }
  if (sections.length === 0) {
    return { section_count: 0, english_sections_with_path: 0, kannada_sections_with_path: 0,
      missing_english_sections: [], missing_kannada_sections: [],
      integrity_status: "empty_presentation", reason: "Presentation has zero sections" };
  }
  const missEn: number[] = [];
  const missKn: number[] = [];
  let en = 0, kn = 0;
  sections.forEach((s, i) => {
    const sid = Number.isFinite(Number(s?.section_id)) ? Number(s.section_id) : i;
    const hasEn = !!(s?.avatar_video || s?.b2_url);
    const langs: any[] = Array.isArray(s?.avatar_languages) ? s.avatar_languages : [];
    const hasKn = langs.some(a =>
      String(a?.language ?? "").toLowerCase() === "kannada" &&
      (a?.video_path || a?.b2_url || a?.vimeo_url || a?.avatar_url),
    );
    if (hasEn) en++; else missEn.push(sid);
    if (hasKn) kn++; else missKn.push(sid);
  });
  let status: Row["integrity_status"] = "valid";
  let reason = "OK";
  if (missEn.length && missKn.length) {
    status = "missing_both";
    reason = `English missing in sections {${missEn.join(",")}}; Kannada missing in sections {${missKn.join(",")}}`;
  } else if (missEn.length) {
    status = "missing_english";
    reason = `English avatar_video missing in sections {${missEn.join(",")}}`;
  } else if (missKn.length) {
    status = "missing_kannada";
    reason = `Kannada video_path missing in sections {${missKn.join(",")}}`;
  }
  return {
    section_count: sections.length,
    english_sections_with_path: en,
    kannada_sections_with_path: kn,
    missing_english_sections: missEn,
    missing_kannada_sections: missKn,
    integrity_status: status,
    reason,
  };
}

async function fetchCdnIntegrity(externalJobId: string): Promise<CdnIntegrity> {
  const url = getCdnMediaUrl(externalJobId, "presentation.json", CDN_BASE);
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404) {
      return { section_count: 0, english_sections_with_path: 0, kannada_sections_with_path: 0,
        missing_english_sections: [], missing_kannada_sections: [],
        integrity_status: "no_presentation", reason: "presentation.json 404 on CDN" };
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const pj = await res.json();
    return computeIntegrityFromPresentation(pj);
  } catch (e: any) {
    return { section_count: 0, english_sections_with_path: 0, kannada_sections_with_path: 0,
      missing_english_sections: [], missing_kannada_sections: [],
      integrity_status: "unknown", reason: `CDN fetch failed: ${e?.message || e}` };
  }
}

// Simple concurrency-limited runner
async function runLimited<T>(items: T[], limit: number, worker: (t: T) => Promise<void>) {
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx]);
    }
  });
  await Promise.all(runners);
}

type Row = {
  job_id: string;
  external_job_id: string | null;
  document_name: string | null;
  subject_name: string | null;
  chapter_number: number | null;
  chapter_title: string | null;
  topic_title: string | null;
  server_ip: string | null;
  video_url: string | null;
  created_at: string;
  completed_at: string | null;
  is_published: boolean | null;
  has_presentation: boolean;
  section_count: number;
  english_sections_with_path: number;
  kannada_sections_with_path: number;
  missing_english_sections: number[];
  missing_kannada_sections: number[];
  integrity_status:
    | "valid"
    | "no_presentation"
    | "empty_presentation"
    | "missing_english"
    | "missing_kannada"
    | "missing_both";
  reason: string;
};

type StatusOrMeta = Row["integrity_status"] | "unknown" | "checking";

const STATUS_STYLE: Record<StatusOrMeta, string> = {
  valid: "bg-emerald-500",
  no_presentation: "bg-red-600",
  empty_presentation: "bg-red-500",
  missing_english: "bg-amber-500",
  missing_kannada: "bg-amber-600",
  missing_both: "bg-red-500",
  unknown: "bg-slate-400",
  checking: "bg-slate-300 text-slate-700",
};

const STATUS_LABEL: Record<StatusOrMeta, string> = {
  valid: "Valid",
  no_presentation: "No presentation",
  empty_presentation: "Empty presentation",
  missing_english: "Missing English",
  missing_kannada: "Missing Kannada",
  missing_both: "Missing English + Kannada",
  unknown: "CDN unreachable",
  checking: "Checking CDN…",
};

function useAudit() {
  return useQuery({
    queryKey: ["completed-job-integrity"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "audit_completed_job_integrity" as any,
        { p_subject_names: null },
      );
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    staleTime: 5000,
  });
}

export default function CompletedJobIntegrity() {
  const qc = useQueryClient();
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useAudit();
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("all");
  const [server, setServer] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"broken" | "all" | Row["integrity_status"]>("broken");
  const [socialScienceOnly, setSocialScienceOnly] = useState(false);
  const [marking, setMarking] = useState<Record<string, boolean>>({});

  // CDN-computed integrity map, keyed by external_job_id
  const [cdnMap, setCdnMap] = useState<Record<string, CdnIntegrity>>({});
  const [cdnChecking, setCdnChecking] = useState(false);
  const cdnRunIdRef = useRef(0);

  useEffect(() => {
    const ch = supabase
      .channel("completed-job-integrity-rt")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "video_generation_jobs" },
        () => qc.invalidateQueries({ queryKey: ["completed-job-integrity"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const rawRows = data ?? [];

  // Kick off CDN checks for every job whose external_job_id we haven't verified yet.
  useEffect(() => {
    const targets = rawRows
      .map(r => r.external_job_id)
      .filter((id): id is string => !!id && !(id in cdnMap));
    if (targets.length === 0) return;
    const runId = ++cdnRunIdRef.current;
    setCdnChecking(true);
    runLimited(targets, 8, async (id) => {
      const result = await fetchCdnIntegrity(id);
      if (cdnRunIdRef.current !== runId) return;
      setCdnMap(prev => (prev[id] ? prev : { ...prev, [id]: result }));
    }).finally(() => {
      if (cdnRunIdRef.current === runId) setCdnChecking(false);
    });
  }, [rawRows, cdnMap]);

  // Merge CDN integrity over the DB-derived integrity (CDN wins when available).
  const rows: Row[] = useMemo(() => rawRows.map(r => {
    const cdn = r.external_job_id ? cdnMap[r.external_job_id] : undefined;
    if (!cdn) return r;
    if (cdn.integrity_status === "unknown") return r; // keep DB verdict on network failure
    return {
      ...r,
      section_count: cdn.section_count,
      english_sections_with_path: cdn.english_sections_with_path,
      kannada_sections_with_path: cdn.kannada_sections_with_path,
      missing_english_sections: cdn.missing_english_sections,
      missing_kannada_sections: cdn.missing_kannada_sections,
      integrity_status: cdn.integrity_status as Row["integrity_status"],
      reason: cdn.reason,
      has_presentation: cdn.integrity_status !== "no_presentation",
    };
  }), [rawRows, cdnMap]);

  const recheckAll = () => { setCdnMap({}); cdnRunIdRef.current++; };
  const recheckOne = async (r: Row) => {
    if (!r.external_job_id) return;
    const id = r.external_job_id;
    setCdnMap(prev => { const n = { ...prev }; delete n[id]; return n; });
    const result = await fetchCdnIntegrity(id);
    setCdnMap(prev => ({ ...prev, [id]: result }));
    toast({ title: "Rechecked", description: `${id}: ${result.integrity_status}` });
  };

  const subjects = useMemo(
    () => Array.from(new Set(rows.map((r) => r.subject_name).filter(Boolean))).sort() as string[],
    [rows],
  );
  const servers = useMemo(
    () => Array.from(new Set(rows.map((r) => r.server_ip).filter(Boolean))).sort() as string[],
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter === "broken" && r.integrity_status === "valid") return false;
      if (statusFilter !== "broken" && statusFilter !== "all" && r.integrity_status !== statusFilter) return false;
      if (subject !== "all" && r.subject_name !== subject) return false;
      if (server !== "all" && r.server_ip !== server) return false;
      if (socialScienceOnly) {
        const id = (r.external_job_id ?? "").toLowerCase();
        const isSS = id.startsWith("socialscience");
        const missingKn = r.integrity_status === "missing_kannada" || r.integrity_status === "missing_both";
        if (!isSS || !missingKn) return false;
      }
      if (!q) return true;
      return (
        (r.external_job_id ?? "").toLowerCase().includes(q) ||
        (r.document_name ?? "").toLowerCase().includes(q) ||
        (r.topic_title ?? "").toLowerCase().includes(q) ||
        (r.chapter_title ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, subject, server, statusFilter, socialScienceOnly]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { total: rows.length, valid: 0, broken: 0 };
    rows.forEach((r) => {
      if (r.integrity_status === "valid") c.valid++;
      else c.broken++;
      c[r.integrity_status] = (c[r.integrity_status] ?? 0) + 1;
    });
    return c;
  }, [rows]);

  async function markIncomplete(r: Row) {
    if (!confirm(`Mark job ${r.external_job_id ?? r.job_id} as failed?\n\nReason: ${r.reason}`)) return;
    setMarking((m) => ({ ...m, [r.job_id]: true }));
    try {
      const { error: e } = await supabase
        .from("video_generation_jobs")
        .update({
          status: "failed",
          error_message: `Integrity check: ${r.reason}`,
          is_published: false,
        })
        .eq("id", r.job_id);
      if (e) throw e;
      toast({ title: "Marked as failed", description: r.external_job_id ?? r.job_id });
      qc.invalidateQueries({ queryKey: ["completed-job-integrity"] });
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    } finally {
      setMarking((m) => ({ ...m, [r.job_id]: false }));
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-amber-500" />
            Completed Job Integrity Check
          </h1>
          <p className="text-sm text-muted-foreground">
            Live audit of jobs marked <b>completed</b>. Integrity is verified against the
            <b> live CDN presentation.json </b> (DB copy is ignored — it can be stale after Kannada re-encodes).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Updated: {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—"}
            {cdnChecking ? " · checking CDN…" : ""}
          </span>
          <Button size="sm" variant="outline" onClick={recheckAll} disabled={cdnChecking}>
            <Cloud className="h-4 w-4 mr-1" /> Recheck CDN
          </Button>
          <Button size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 flex flex-wrap items-center gap-2">
          <Badge variant="outline">Total completed: {counts.total}</Badge>
          <Badge className="bg-emerald-500">Valid: {counts.valid}</Badge>
          <Badge className="bg-red-500">Broken: {counts.broken}</Badge>
          {(["no_presentation","empty_presentation","missing_english","missing_kannada","missing_both"] as const).map((k) =>
            counts[k] ? <Badge key={k} className={STATUS_STYLE[k]}>{STATUS_LABEL[k]}: {counts[k]}</Badge> : null,
          )}
          {(() => {
            const ss = rows.filter(r => (r.external_job_id ?? "").toLowerCase().startsWith("socialscience"));
            const ssMissKn = ss.filter(r => r.integrity_status === "missing_kannada" || r.integrity_status === "missing_both");
            const is4 = (ip: string | null) => ip === "173.208.218.4";
            const s4 = ssMissKn.filter(r => is4(r.server_ip)).length;
            const sOther = ssMissKn.filter(r => !is4(r.server_ip)).length;
            return (
              <>
                <Badge className="bg-indigo-600">SS total: {ss.length}</Badge>
                <Badge className="bg-amber-600">SS missing KN (.4): {s4}</Badge>
                <Badge className="bg-amber-500">SS missing KN (other): {sOther}</Badge>
              </>
            );
          })()}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search job / topic / chapter / document…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Subject" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={server} onValueChange={setServer}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Server" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All servers</SelectItem>
              {servers.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="broken">Only broken</SelectItem>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="no_presentation">No presentation</SelectItem>
              <SelectItem value="empty_presentation">Empty presentation</SelectItem>
              <SelectItem value="missing_english">Missing English</SelectItem>
              <SelectItem value="missing_kannada">Missing Kannada</SelectItem>
              <SelectItem value="missing_both">Missing English + Kannada</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant={socialScienceOnly ? "default" : "outline"}
            onClick={() => setSocialScienceOnly((v) => !v)}
          >
            SocialScience missing Kannada
            {socialScienceOnly ? (
              <Badge variant="secondary" className="ml-2">
                {rows.filter(r =>
                  (r.external_job_id ?? "").toLowerCase().startsWith("socialscience") &&
                  (r.integrity_status === "missing_kannada" || r.integrity_status === "missing_both")
                ).length}
              </Badge>
            ) : null}
          </Button>
        </CardContent>
      </Card>

      {error ? (
        <Card><CardContent className="py-6 text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {(error as Error).message}
        </CardContent></Card>
      ) : null}

      <div className="border rounded max-h-[70vh] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Chapter / Topic</TableHead>
              <TableHead className="w-[220px]">External Job</TableHead>
              <TableHead className="w-[130px]">Server</TableHead>
              <TableHead className="w-[180px]">Status</TableHead>
              <TableHead className="w-[120px]">Sections</TableHead>
              <TableHead className="w-[120px]">Kannada</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="w-[160px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading audit…
              </TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                No jobs match the filter.
              </TableCell></TableRow>
            ) : filtered.map((r) => (
              <TableRow key={r.job_id}>
                <TableCell className="text-xs">{r.subject_name ?? "—"}</TableCell>
                <TableCell className="text-xs max-w-[280px]">
                  <div className="truncate">Ch {r.chapter_number ?? "?"}: {r.chapter_title ?? "—"}</div>
                  <div className="truncate text-muted-foreground">{r.topic_title ?? r.document_name ?? "—"}</div>
                </TableCell>
                <TableCell className="text-xs font-mono">
                  <div className="flex items-center gap-1">
                    <span className="break-all">{r.external_job_id ?? r.job_id}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0"
                      onClick={() => {
                        const val = r.external_job_id ?? r.job_id;
                        navigator.clipboard.writeText(val);
                        toast({ title: "Copied", description: val });
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="text-xs">{r.server_ip ?? "—"}</TableCell>
                <TableCell>
                  <Badge className={STATUS_STYLE[r.integrity_status]}>{STATUS_LABEL[r.integrity_status]}</Badge>
                </TableCell>
                <TableCell className="text-xs">
                  <div>EN {r.english_sections_with_path}/{r.section_count}</div>
                  {r.missing_english_sections?.length ? (
                    <div className="text-[10px] text-red-500">missing: {r.missing_english_sections.join(", ")}</div>
                  ) : null}
                </TableCell>
                <TableCell className="text-xs">
                  <div>KN {r.kannada_sections_with_path}/{r.section_count}</div>
                  {r.missing_kannada_sections?.length ? (
                    <div className="text-[10px] text-red-500">missing: {r.missing_kannada_sections.join(", ")}</div>
                  ) : null}
                </TableCell>
                <TableCell className="text-xs">{r.reason}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {r.video_url && (
                      <Button size="sm" variant="outline" onClick={() => window.open(r.video_url!, "_blank")}>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => recheckOne(r)} title="Re-fetch CDN presentation.json">
                      <Cloud className="h-3 w-3" />
                    </Button>
                    {r.integrity_status !== "valid" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={!!marking[r.job_id]}
                        onClick={() => markIncomplete(r)}
                      >
                        {marking[r.job_id] ? <Loader2 className="h-3 w-3 animate-spin" /> : "Mark failed"}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
