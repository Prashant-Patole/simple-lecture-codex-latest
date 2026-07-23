import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Copy, Download, RefreshCw, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getCdnMediaUrl } from "@/components/learning/player/utils/mediaResolver";

const CDN_BASE = "https://server1.simplelecture.com/video";

async function fetchLangCoverageFromCdn(externalJobId: string, language: string) {
  const url = getCdnMediaUrl(externalJobId, "presentation.json", CDN_BASE);
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { total: 0, matched: 0, ok: false };
    const pj = await res.json();
    const sections: any[] = Array.isArray(pj?.sections) ? pj.sections : [];
    const lang = language.toLowerCase();
    let matched = 0;
    sections.forEach((s) => {
      const langs: any[] = Array.isArray(s?.avatar_languages) ? s.avatar_languages : [];
      if (langs.some(a => String(a?.language ?? "").toLowerCase() === lang &&
        (a?.video_path || a?.b2_url || a?.vimeo_url || a?.avatar_url))) matched++;
    });
    return { total: sections.length, matched, ok: true };
  } catch {
    return { total: 0, matched: 0, ok: false };
  }
}

async function mapLimited<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

const SUBJECTS = ["Social Science", "Maths", "Science"] as const;
type Subject = typeof SUBJECTS[number];

const LANGUAGES = [
  { key: "english", label: "English" },
  { key: "hindi", label: "Hindi" },
  { key: "kannada", label: "Kannada" },
  { key: "all3", label: "All 3 languages" },
] as const;
type LanguageKey = typeof LANGUAGES[number]["key"];

function getSubjectKey(subjectName: string): Subject | null {
  const normalized = subjectName.trim().toLowerCase();
  if (normalized === "social science") return "Social Science";
  if (["math", "maths", "mathematics"].includes(normalized)) return "Maths";
  if (normalized === "science") return "Science";
  return null;
}

type Row = {
  subject_name: string;
  chapter_id: string;
  chapter_number: number | null;
  chapter_title: string;
  topic_id: string;
  topic_number: string | null;
  topic_title: string;
  total_jobs: number;
  published_completed_jobs: number;
  latest_status: string | null;
  latest_job_id: string | null;
  latest_external_job_id: string | null;
  latest_server_ip: string | null;
  latest_created_at: string | null;
  coverage_status: "ok" | "in_progress" | "failed" | "missing" | "incomplete";
};

const STATUS_COLOR: Record<Row["coverage_status"], string> = {
  ok: "bg-emerald-500",
  in_progress: "bg-blue-500",
  failed: "bg-red-500",
  missing: "bg-slate-500",
  incomplete: "bg-amber-500",
};

function useCoverage(enabled: boolean, language: LanguageKey) {
  return useQuery({
    queryKey: ["video-coverage-report", SUBJECTS, language],
    enabled,
    retry: 1,
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("Admin session is not ready. Please wait a moment and scan again.");
      }

      if (language === "english") {
        const { data, error } = await supabase.rpc(
          "scan_video_generation_coverage" as any,
          { p_subject_names: SUBJECTS as unknown as string[] }
        );
        if (error) throw error;
        return (data ?? []) as Row[];
      }

      if (language === "all3") {
        // Get job list via kannada RPC (job set is the same for any language)
        const perSubject = await Promise.all(
          SUBJECTS.map(async (subject) => {
            const { data, error } = await supabase.rpc(
              "get_language_coverage_scan" as any,
              { p_subject_name: subject, p_language: "kannada" }
            );
            if (error) throw error;
            return (data ?? []) as any[];
          })
        );
        const flat = perSubject.flat();
        const cdn = await mapLimited(flat, 8, async (r: any) => {
          if (!r.external_job_id) return null;
          const url = getCdnMediaUrl(r.external_job_id, "presentation.json", CDN_BASE);
          try {
            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok) return null;
            const pj = await res.json();
            const sections: any[] = Array.isArray(pj?.sections) ? pj.sections : [];
            const check = (lang: string) => sections.filter(s => {
              if (lang === "english") return !!(s?.avatar_video || s?.b2_url);
              const langs: any[] = Array.isArray(s?.avatar_languages) ? s.avatar_languages : [];
              return langs.some(a => String(a?.language ?? "").toLowerCase() === lang &&
                (a?.video_path || a?.b2_url || a?.vimeo_url || a?.avatar_url));
            }).length;
            return {
              total: sections.length,
              en: check("english"),
              hi: check("hindi"),
              kn: check("kannada"),
            };
          } catch { return null; }
        });

        return flat.map((r: any, idx): Row => {
          const c = cdn[idx];
          if (!c) {
            return {
              subject_name: r.subject_name, chapter_id: r.job_id, chapter_number: r.chapter_number,
              chapter_title: r.chapter_title ?? "", topic_id: r.job_id, topic_number: null,
              topic_title: r.topic_title ?? r.document_name ?? "",
              total_jobs: 0, published_completed_jobs: 0,
              latest_status: "CDN unreachable", latest_job_id: r.job_id,
              latest_external_job_id: r.external_job_id, latest_server_ip: r.server_ip,
              latest_created_at: r.created_at, coverage_status: "failed",
            };
          }
          const full = c.total > 0 && c.en >= c.total && c.hi >= c.total && c.kn >= c.total;
          const none = c.en === 0 && c.hi === 0 && c.kn === 0;
          const status: Row["coverage_status"] = c.total === 0 ? "missing"
            : full ? "ok" : none ? "missing" : "incomplete";
          return {
            subject_name: r.subject_name, chapter_id: r.job_id, chapter_number: r.chapter_number,
            chapter_title: r.chapter_title ?? "", topic_id: r.job_id, topic_number: null,
            topic_title: r.topic_title ?? r.document_name ?? "",
            total_jobs: c.total,
            published_completed_jobs: Math.min(c.en, c.hi, c.kn),
            latest_status: `EN ${c.en}/${c.total} · HI ${c.hi}/${c.total} · KN ${c.kn}/${c.total}`,
            latest_job_id: r.job_id, latest_external_job_id: r.external_job_id,
            latest_server_ip: r.server_ip, latest_created_at: r.created_at,
            coverage_status: status,
          };
        });
      }

      // Hindi / Kannada: fan out per subject using generic language RPC
      const perSubject = await Promise.all(
        SUBJECTS.map(async (subject) => {
          const { data, error } = await supabase.rpc(
            "get_language_coverage_scan" as any,
            { p_subject_name: subject, p_language: language }
          );
          if (error) throw error;
          return (data ?? []) as any[];
        })
      );

      const flat = perSubject.flat();

      // Recompute coverage from live CDN presentation.json (DB copy may be stale)
      const cdn = await mapLimited(flat, 8, async (r: any) =>
        r.external_job_id
          ? await fetchLangCoverageFromCdn(r.external_job_id, language)
          : { total: 0, matched: 0, ok: false }
      );

      const rows: Row[] = flat.map((r: any, idx) => {
        const c = cdn[idx];
        const total = c.ok ? c.total : (r.total_sections ?? 0);
        const matched = c.ok ? c.matched : 0;
        let status: Row["coverage_status"] = "missing";
        if (!c.ok) status = "failed";
        else if (total === 0) status = "missing";
        else if (matched >= total) status = "ok";
        else if (matched === 0) status = "missing";
        else status = "incomplete";
        return {
          subject_name: r.subject_name,
          chapter_id: r.job_id,
          chapter_number: r.chapter_number,
          chapter_title: r.chapter_title ?? "",
          topic_id: r.job_id,
          topic_number: null,
          topic_title: r.topic_title ?? r.document_name ?? "",
          total_jobs: total,
          published_completed_jobs: matched,
          latest_status: c.ok ? `${matched}/${total} sections` : "CDN unreachable",
          latest_job_id: r.job_id,
          latest_external_job_id: r.external_job_id,
          latest_server_ip: r.server_ip,
          latest_created_at: r.created_at,
          coverage_status: status,
        };
      });
      return rows;
    },
  });
}

function toCsv(rows: Row[]): string {
  const headers = [
    "subject", "chapter_number", "chapter_title", "topic_number", "topic_title",
    "coverage_status", "total_jobs", "published_completed_jobs",
    "latest_status", "latest_external_job_id", "latest_server_ip", "latest_created_at",
  ];
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([
      r.subject_name, r.chapter_number, r.chapter_title, r.topic_number, r.topic_title,
      r.coverage_status, r.total_jobs, r.published_completed_jobs,
      r.latest_status, r.latest_external_job_id, r.latest_server_ip, r.latest_created_at,
    ].map(esc).join(","));
  }
  return lines.join("\n");
}

function SubjectPanel({ rows }: { rows: Row[] }) {
  const [onlyProblems, setOnlyProblems] = useState(true);
  const [search, setSearch] = useState("");

  const counts = useMemo(() => {
    const c = { ok: 0, in_progress: 0, failed: 0, missing: 0, incomplete: 0 };
    rows.forEach(r => { c[r.coverage_status]++; });
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    let list = onlyProblems ? rows.filter(r => r.coverage_status !== "ok") : rows;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(r =>
        (r.latest_external_job_id ?? "").toLowerCase().includes(q) ||
        (r.chapter_title ?? "").toLowerCase().includes(q) ||
        (r.topic_title ?? "").toLowerCase().includes(q) ||
        String(r.chapter_number ?? "").includes(q)
      );
    }
    return list;
  }, [rows, onlyProblems, search]);

  function downloadCsv() {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${rows[0]?.subject_name ?? "subject"}-coverage.csv`.replace(/\s+/g, "_");
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Topics: {rows.length}</Badge>
        <Badge className="bg-emerald-500">OK: {counts.ok}</Badge>
        <Badge className="bg-blue-500">In progress: {counts.in_progress}</Badge>
        <Badge className="bg-red-500">Failed: {counts.failed}</Badge>
        <Badge className="bg-slate-500">Missing: {counts.missing}</Badge>
        {counts.incomplete > 0 && <Badge className="bg-amber-500">Incomplete: {counts.incomplete}</Badge>}
        <div className="ml-auto flex items-center gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search external job id, chapter, topic…"
            className="h-8 w-72"
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={onlyProblems} onCheckedChange={v => setOnlyProblems(!!v)} />
            Only problems
          </label>
          <Button size="sm" variant="outline" onClick={downloadCsv}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </div>


      <div className="border rounded max-h-[70vh] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-16">Ch</TableHead>
              <TableHead>Chapter</TableHead>
              <TableHead>Topic</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-20">Jobs</TableHead>
              <TableHead className="w-24">Published</TableHead>
              <TableHead className="w-28">Latest</TableHead>
              <TableHead>External Job ID</TableHead>
              <TableHead className="w-32">Server</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(r => (
              <TableRow key={r.topic_id}>
                <TableCell className="text-xs">{r.chapter_number ?? "-"}</TableCell>
                <TableCell className="text-xs truncate max-w-[220px]">{r.chapter_title}</TableCell>
                <TableCell className="text-xs truncate max-w-[260px]">{r.topic_title}</TableCell>
                <TableCell>
                  <Badge className={STATUS_COLOR[r.coverage_status]}>{r.coverage_status}</Badge>
                </TableCell>
                <TableCell className="text-xs">{r.total_jobs}</TableCell>
                <TableCell className="text-xs">{r.published_completed_jobs}</TableCell>
                <TableCell className="text-xs">{r.latest_status ?? "—"}</TableCell>
                <TableCell className="text-xs font-mono">
                  {r.latest_external_job_id ? (
                    <div className="flex items-center gap-1">
                      <span className="break-all">{r.latest_external_job_id}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0"
                        onClick={() => {
                          navigator.clipboard.writeText(r.latest_external_job_id!);
                          toast({ title: "Copied", description: r.latest_external_job_id! });
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-xs">{r.latest_server_ip ?? "—"}</TableCell>
              </TableRow>
            ))}
            {!filtered.length && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground text-sm py-6">
                  {rows.length === 0
                    ? "No topics found for this subject"
                    : onlyProblems
                      ? "All topics have a published video 🎉"
                      : "No topics found"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function VideoCoverageReport() {
  const { user, isLoading: authLoading } = useAuth();
  const canLoadReport = !!user && !authLoading;
  const [language, setLanguage] = useState<LanguageKey>("english");
  const { data, refetch, isFetching, isLoading, error } = useCoverage(canLoadReport, language);
  const [hasScanned, setHasScanned] = useState(false);
  const [lastScannedAt, setLastScannedAt] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setHasScanned(true);
    }
    if (data && !lastScannedAt) {
      setLastScannedAt(new Date().toLocaleString());
    }
  }, [data, lastScannedAt]);

  async function runScan() {
    setHasScanned(true);
    const result = await refetch();
    if (!result.error) {
      setLastScannedAt(new Date().toLocaleString());
    }
  }

  const bySubject = useMemo(() => {
    const map = new Map<Subject, Row[]>();
    (data ?? []).forEach(r => {
      const subjectKey = getSubjectKey(r.subject_name);
      if (!subjectKey) return;
      const list = map.get(subjectKey) ?? [];
      list.push(r);
      map.set(subjectKey, list);
    });
    return map;
  }, [data]);

  const summary = useMemo(() => {
    return SUBJECTS.map(s => {
      const rows = bySubject.get(s) ?? [];
      const ok = rows.filter(r => r.coverage_status === "ok").length;
      const missing = rows.filter(r => r.coverage_status === "missing").length;
      const failed = rows.filter(r => r.coverage_status === "failed").length;
      const inProgress = rows.filter(r => r.coverage_status === "in_progress").length;
      const incomplete = rows.filter(r => r.coverage_status === "incomplete").length;
      const problems = rows.length - ok;
      return { subject: s, total: rows.length, ok, missing, failed, inProgress, incomplete, problems };
    });
  }, [bySubject]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Video Generation Coverage Report</h1>
          <p className="text-sm text-muted-foreground">
            Per-topic view of published video status across Social Science, Maths and Science.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-1 border rounded-md p-1">
            {LANGUAGES.map((l) => (
              <Button
                key={l.key}
                size="sm"
                variant={language === l.key ? "default" : "ghost"}
                className="h-7 px-3"
                onClick={() => { setLanguage(l.key); setHasScanned(false); }}
              >
                {l.label}
              </Button>
            ))}
          </div>
          {lastScannedAt && (
            <span className="text-xs text-muted-foreground">Last scanned: {lastScannedAt}</span>
          )}
          <Button size="sm" onClick={runScan} disabled={isFetching}>
            {isFetching ? (
              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Search className="h-4 w-4 mr-1" />
            )}
            {hasScanned ? "Scan Again" : "Scan Videos"}
          </Button>
        </div>
      </div>

      {hasScanned && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {summary.map(s => (
          <Card key={s.subject}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{s.subject}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-bold">{s.ok}</span>
                <span className="text-muted-foreground text-sm">/ {s.total} topics OK</span>
              </div>
              <div className="mt-1 text-sm space-y-1">
                {s.total === 0 ? (
                  <span className="text-muted-foreground">No topics returned for this subject</span>
                ) : s.problems === 0 ? (
                  <span className="text-emerald-600">All topics have a published video</span>
                ) : (
                  <span className="text-red-600">{s.problems} topic{s.problems === 1 ? "" : "s"} need attention</span>
                )}
                {s.total > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Missing {s.missing} · Failed {s.failed} · In progress {s.inProgress} · Incomplete {s.incomplete}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      )}

      {error ? (
        <Card className="border-red-500">
          <CardContent className="py-4 text-sm text-red-600">
            Failed to load report: {(error as Error).message}
            <div className="mt-1 text-muted-foreground">
              Please confirm you are signed in as an admin. If this continues, the report function permission may need attention.
            </div>
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={runScan} disabled={isFetching}>Scan Again</Button>
            </div>
          </CardContent>
        </Card>
      ) : isLoading || (isFetching && !data) ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 mr-2 inline animate-spin" /> Loading video coverage report…
          </CardContent>
        </Card>
      ) : !data?.length ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground space-y-2">
            <div>No report rows were returned for Social Science, Maths, or Science.</div>
            <div>This can happen if the signed-in user is not an admin, the subjects are named differently, or there are no topics under those subjects.</div>
            <Button size="sm" variant="outline" onClick={runScan} disabled={isFetching}>Scan Again</Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={SUBJECTS[0]}>
          <TabsList>
            {SUBJECTS.map(s => <TabsTrigger key={s} value={s}>{s}</TabsTrigger>)}
          </TabsList>
          {SUBJECTS.map(s => (
            <TabsContent key={s} value={s} className="mt-4">
              <SubjectPanel rows={bySubject.get(s) ?? []} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
