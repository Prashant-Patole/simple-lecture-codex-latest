import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Play, Search, FileWarning, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronRight, Sparkles, Copy } from "lucide-react";
import { toast } from "sonner";

type HeadingStatus = "fully_covered" | "mentioned_only" | "missing" | "title_only";

interface HeadingDetail {
  heading: string;
  in_section_title: boolean;
  in_narration: boolean;
  status: HeadingStatus;
  matched_section_title?: string;
  ai_status?: string;
  ai_reason?: string;
  ai_suggested_slide_title?: string;
}

interface AIFeedback {
  overall_summary?: string;
  structural_coverage_pct?: number;
  headings?: Array<{ heading: string; status: string; matched_section_title?: string | null; reason?: string; suggested_slide_title?: string | null }>;
  recommended_new_sections?: string[];
  error?: string;
  raw?: string;
}

interface TopicRow {
  topic_id: string;
  topic_title: string;
  subject_id: string;
  subject_name: string;
  chapter_id: string;
  chapter_title: string;
  file_name: string;
  headings_total: number;
  headings_covered?: number;
  headings_missing: string[];
  headings_missing_slide: string[];
  headings_detail: HeadingDetail[];
  presentation_sections: { section_id: string; title: string }[];
  structural_coverage_pct: number;
  narration_coverage_pct: number;
  coverage_pct: number;
  has_published_lecture: boolean;
  section_count?: number;
  ai_feedback?: AIFeedback;
}

interface ScanResponse {
  topics: TopicRow[];
  summary: {
    total: number;
    published: number;
    unpublished: number;
    fully_covered: number;
    partially_covered: number;
    poorly_covered: number;
    no_headings: number;
    total_headings_missing_slide: number;
    total_headings_mentioned_only: number;
  };
}

type Filter = "all" | "missing_slide" | "mentioned_only" | "poor" | "unpublished" | "full";

export default function DocContentCoverage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("missing_slide");
  const [result, setResult] = useState<ScanResponse | null>(null);

  const scan = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("scan-topic-content-coverage", { body: {} });
      if (error) throw error;
      return data as ScanResponse;
    },
    onSuccess: (d) => {
      setResult(d);
      toast.success(`Scanned ${d.summary.total} topics`);
    },
    onError: (e: Error) => toast.error(`Scan failed: ${e.message}`),
  });

  const filtered = useMemo(() => {
    if (!result) return [];
    let rows = result.topics;
    if (filter === "missing_slide") rows = rows.filter((r) => r.has_published_lecture && r.headings_missing_slide.length > 0);
    else if (filter === "mentioned_only") rows = rows.filter((r) => r.has_published_lecture && r.headings_detail.some((h) => h.status === "mentioned_only"));
    else if (filter === "poor") rows = rows.filter((r) => r.has_published_lecture && r.structural_coverage_pct < 50 && r.headings_total > 0);
    else if (filter === "unpublished") rows = rows.filter((r) => !r.has_published_lecture);
    else if (filter === "full") rows = rows.filter((r) => r.has_published_lecture && r.headings_total > 0 && r.headings_missing_slide.length === 0);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.topic_title.toLowerCase().includes(q) ||
          r.subject_name.toLowerCase().includes(q) ||
          r.chapter_title.toLowerCase().includes(q),
      );
    }
    return rows.sort((a, b) => a.structural_coverage_pct - b.structural_coverage_pct);
  }, [result, filter, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Doc → Presentation Coverage Audit</h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Compares every uploaded topic document against its generated <code>presentation_json</code>.
            Detects headings from the source doc that have <b>no dedicated section (slide)</b> in the
            lecture — even if mentioned inside another slide's narration.
          </p>
        </div>
        <Button onClick={() => scan.mutate()} disabled={scan.isPending} size="lg">
          {scan.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
          {result ? "Re-scan All Topics" : "Run Scan"}
        </Button>
      </div>

      <TargetedScanCard onResult={(d, keepFilter) => { setResult(d); if (!keepFilter) setFilter("all"); }} />



      {scan.isPending && (
        <Card><CardContent className="py-6"><Skeleton className="h-6 w-64 mb-3" /><Skeleton className="h-4 w-full" /></CardContent></Card>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <StatCard label="Total topics" value={result.summary.total} />
            <StatCard label="Fully covered" value={result.summary.fully_covered} tone="good" icon={<CheckCircle2 className="h-4 w-4" />} />
            <StatCard label="Missing slides" value={result.summary.total_headings_missing_slide} tone="bad" icon={<XCircle className="h-4 w-4" />} />
            <StatCard label="Mentioned only" value={result.summary.total_headings_mentioned_only} tone="warn" icon={<AlertTriangle className="h-4 w-4" />} />
            <StatCard label="Poor (<50%)" value={result.summary.poorly_covered} tone="bad" />
            <StatCard label="No lecture yet" value={result.summary.unpublished} tone="muted" icon={<FileWarning className="h-4 w-4" />} />
          </div>

          <Card>
            <CardContent className="pt-4 pb-4 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search topic / chapter / subject…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={filter} onValueChange={(v: Filter) => setFilter(v)}>
                <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="missing_slide">Missing slides (no dedicated section)</SelectItem>
                  <SelectItem value="mentioned_only">Mentioned only (needs its own slide)</SelectItem>
                  <SelectItem value="poor">Poor structural (&lt;50%)</SelectItem>
                  <SelectItem value="full">Fully covered</SelectItem>
                  <SelectItem value="unpublished">No published lecture</SelectItem>
                  <SelectItem value="all">All topics</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-sm text-muted-foreground">Showing {filtered.length}</div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {filtered.map((r) => <TopicRowCard key={r.topic_id} row={r} />)}
            {filtered.length === 0 && (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No topics match this filter.</CardContent></Card>
            )}
          </div>
        </>
      )}

      {!result && !scan.isPending && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Click <b>Run Scan</b> to compare every uploaded document against its generated presentation.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value, tone, icon }: { label: string; value: number; tone?: "good" | "warn" | "bad" | "muted"; icon?: React.ReactNode }) {
  const cls =
    tone === "good" ? "text-emerald-600" :
    tone === "warn" ? "text-amber-600" :
    tone === "bad" ? "text-red-600" :
    tone === "muted" ? "text-muted-foreground" : "";
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className={`text-xs flex items-center gap-1 ${cls}`}>{icon}{label}</div>
        <div className={`text-2xl font-bold mt-1 ${cls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function chipClass(status: HeadingStatus): string {
  switch (status) {
    case "fully_covered": return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "mentioned_only": return "bg-amber-50 text-amber-800 border-amber-200";
    case "title_only": return "bg-sky-50 text-sky-800 border-sky-200";
    case "missing": return "bg-red-50 text-red-800 border-red-200";
  }
}

function statusLabel(status: HeadingStatus): string {
  switch (status) {
    case "fully_covered": return "Slide + spoken";
    case "mentioned_only": return "No slide (spoken only)";
    case "title_only": return "Slide but not spoken";
    case "missing": return "Missing";
  }
}

function TopicRowCard({ row }: { row: TopicRow }) {
  const [expanded, setExpanded] = useState(false);

  const tone =
    !row.has_published_lecture ? "muted" :
    row.headings_total === 0 ? "muted" :
    row.structural_coverage_pct === 100 ? "good" :
    row.structural_coverage_pct >= 50 ? "warn" : "bad";
  const badgeCls =
    tone === "good" ? "bg-emerald-100 text-emerald-800" :
    tone === "warn" ? "bg-amber-100 text-amber-800" :
    tone === "bad" ? "bg-red-100 text-red-800" :
    "bg-muted text-muted-foreground";

  const problematic = row.headings_detail?.filter((h) => h.status !== "fully_covered" && h.status !== "title_only") || [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base truncate">{row.topic_title}</CardTitle>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">
              {row.subject_name} › {row.chapter_title} · {row.file_name}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {row.section_count ?? 0} slides · {row.headings_total} doc headings
            </Badge>
            <Badge className={badgeCls}>
              {!row.has_published_lecture ? "No lecture" :
               row.headings_total === 0 ? "No headings in doc" :
               `${row.structural_coverage_pct}% structural`}
            </Badge>
            {row.has_published_lecture && (
              <a
                href={`/admin/content-audit/subject/${row.subject_id}`}
                className="text-xs text-primary hover:underline"
              >Open subject</a>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {row.headings_total > 0 && row.has_published_lecture && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] text-muted-foreground mb-1 flex justify-between">
                <span>Structural (dedicated slide)</span><span>{row.structural_coverage_pct}%</span>
              </div>
              <Progress value={row.structural_coverage_pct} className="h-1.5" />
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground mb-1 flex justify-between">
                <span>Narration mention</span><span>{row.narration_coverage_pct}%</span>
              </div>
              <Progress value={row.narration_coverage_pct} className="h-1.5" />
            </div>
          </div>
        )}

        {problematic.length > 0 && (
          <div>
            <div className="text-xs font-medium mb-1">
              Issues ({problematic.length}/{row.headings_total}):
            </div>
            <div className="flex flex-wrap gap-1.5">
              {problematic.map((h, i) => (
                <span
                  key={i}
                  title={statusLabel(h.status)}
                  className={`text-xs px-2 py-0.5 rounded border ${chipClass(h.status)}`}
                >
                  {h.heading}
                  <span className="opacity-60 ml-1">
                    {h.status === "mentioned_only" ? "· spoken, no slide" : h.status === "missing" ? "· absent" : ""}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {row.headings_detail && row.headings_detail.length > 0 && (
          <div>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {expanded ? "Hide" : "Show"} all headings & matched slides
            </button>
            {expanded && (
              <div className="mt-2 border rounded overflow-hidden text-xs">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left px-2 py-1 font-medium">Doc heading</th>
                      <th className="text-left px-2 py-1 font-medium">Status</th>
                      <th className="text-left px-2 py-1 font-medium">Matched slide title</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.headings_detail.map((h, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">{h.heading}</td>
                        <td className="px-2 py-1">
                          <span className={`px-1.5 py-0.5 rounded border ${chipClass(h.status)}`}>
                            {statusLabel(h.status)}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-muted-foreground">
                          {h.matched_section_title || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {row.has_published_lecture && row.headings_total === 0 && (
          <div className="text-xs text-muted-foreground">Source doc has no ## headings — cannot compute coverage.</div>
        )}
        {!row.has_published_lecture && (
          <div className="text-xs text-muted-foreground">Document uploaded but no published V3 lecture yet.</div>
        )}

        {row.ai_feedback && <AIFeedbackPanel fb={row.ai_feedback} />}
      </CardContent>
    </Card>
  );
}

function TargetedScanCard({ onResult }: { onResult: (r: ScanResponse, keepFilter?: boolean) => void }) {
  const [subjectId, setSubjectId] = useState<string>("");
  const [chapterId, setChapterId] = useState<string>("");
  const [topicId, setTopicId] = useState<string>("");
  const [mode, setMode] = useState<"ai" | "keyword">("ai");

  const subjectsQ = useQuery({
    queryKey: ["dcc-subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("popular_subjects").select("id,name").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const chaptersQ = useQuery({
    queryKey: ["dcc-chapters", subjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subject_chapters")
        .select("id,title,sequence_order")
        .eq("subject_id", subjectId)
        .order("sequence_order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!subjectId,
  });

  const topicsQ = useQuery({
    queryKey: ["dcc-topics", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subject_topics")
        .select("id,title,sequence_order")
        .eq("chapter_id", chapterId)
        .order("sequence_order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!chapterId,
  });

  const run = useMutation({
    mutationFn: async () => {
      if (!topicId) throw new Error("Pick a topic first");
      const { data, error } = await supabase.functions.invoke("scan-topic-content-coverage", {
        body: { topic_id: topicId, mode },
      });
      if (error) throw error;
      return data as ScanResponse;
    },
    onSuccess: (d) => {
      onResult(d);
      toast.success(mode === "ai" ? "AI scan complete" : "Scan complete");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runSubject = useMutation({
    mutationFn: async () => {
      if (!subjectId) throw new Error("Pick a subject first");
      const { data, error } = await supabase.functions.invoke("scan-topic-content-coverage", {
        body: { subjectId, mode: "keyword" },
      });
      if (error) throw error;
      return data as ScanResponse;
    },
    onSuccess: (d) => {
      onResult(d);
      const missing = d.topics.filter((t) => t.has_published_lecture && t.headings_missing_slide.length > 0).length;
      toast.success(`Scanned ${d.summary.total} topics · ${missing} have missing sections`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Targeted scan (single topic)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1 min-w-[180px]">
          <label className="text-xs text-muted-foreground">Subject</label>
          <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setChapterId(""); setTopicId(""); }}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Select subject…" /></SelectTrigger>
            <SelectContent>
              {(subjectsQ.data || []).map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1 min-w-[180px]">
          <label className="text-xs text-muted-foreground">Chapter</label>
          <Select value={chapterId} onValueChange={(v) => { setChapterId(v); setTopicId(""); }} disabled={!subjectId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder={subjectId ? "Select chapter…" : "Pick subject first"} /></SelectTrigger>
            <SelectContent>
              {(chaptersQ.data || []).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1 min-w-[180px]">
          <label className="text-xs text-muted-foreground">Topic</label>
          <Select value={topicId} onValueChange={setTopicId} disabled={!chapterId}>
            <SelectTrigger className="w-[240px]"><SelectValue placeholder={chapterId ? "Select topic…" : "Pick chapter first"} /></SelectTrigger>
            <SelectContent>
              {(topicsQ.data || []).map((t: any) => (
                <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Mode</label>
          <Select value={mode} onValueChange={(v: "ai" | "keyword") => setMode(v)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ai">AI (deep, Gemini)</SelectItem>
              <SelectItem value="keyword">Keyword (fast)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => run.mutate()} disabled={!topicId || run.isPending}>
          {run.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Scan this topic
        </Button>
        <Button
          variant="secondary"
          onClick={() => runSubject.mutate()}
          disabled={!subjectId || runSubject.isPending}
          title="Scan every topic in the selected subject (keyword mode)"
        >
          {runSubject.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
          Scan whole subject
        </Button>
      </CardContent>
    </Card>
  );
}

function AIFeedbackPanel({ fb }: { fb: AIFeedback }) {
  if (fb.error) {
    return (
      <div className="mt-3 p-3 rounded border border-red-200 bg-red-50 text-xs text-red-800">
        AI feedback error: {fb.error}
      </div>
    );
  }
  const copy = () => {
    navigator.clipboard.writeText(JSON.stringify(fb, null, 2));
    toast.success("AI report copied");
  };
  return (
    <div className="mt-3 p-3 rounded border border-primary/30 bg-primary/5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          AI Feedback
          {typeof fb.structural_coverage_pct === "number" && (
            <Badge variant="outline" className="ml-1 text-[10px]">AI est. {fb.structural_coverage_pct}%</Badge>
          )}
        </div>
        <button onClick={copy} className="text-xs text-primary hover:underline flex items-center gap-1">
          <Copy className="h-3 w-3" /> Copy JSON
        </button>
      </div>
      {fb.overall_summary && <div className="text-sm">{fb.overall_summary}</div>}

      {Array.isArray(fb.headings) && fb.headings.length > 0 && (
        <div className="border rounded overflow-hidden text-xs bg-background">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-2 py-1 font-medium">Heading</th>
                <th className="text-left px-2 py-1 font-medium">AI status</th>
                <th className="text-left px-2 py-1 font-medium">Reason</th>
                <th className="text-left px-2 py-1 font-medium">Suggested slide title</th>
              </tr>
            </thead>
            <tbody>
              {fb.headings.map((h, i) => {
                const cls =
                  h.status === "missing" ? "bg-red-50 text-red-800 border-red-200" :
                  h.status === "partial" ? "bg-amber-50 text-amber-800 border-amber-200" :
                  "bg-emerald-50 text-emerald-800 border-emerald-200";
                return (
                  <tr key={i} className="border-t align-top">
                    <td className="px-2 py-1">{h.heading}</td>
                    <td className="px-2 py-1"><span className={`px-1.5 py-0.5 rounded border ${cls}`}>{h.status}</span></td>
                    <td className="px-2 py-1 text-muted-foreground">{h.reason || "—"}</td>
                    <td className="px-2 py-1">{h.suggested_slide_title || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {Array.isArray(fb.recommended_new_sections) && fb.recommended_new_sections.length > 0 && (
        <div>
          <div className="text-xs font-medium mb-1">Recommended new slides:</div>
          <ul className="list-disc pl-5 text-xs space-y-0.5">
            {fb.recommended_new_sections.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      {fb.raw && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">Raw AI response</summary>
          <pre className="mt-1 p-2 bg-muted rounded overflow-x-auto whitespace-pre-wrap">{fb.raw}</pre>
        </details>
      )}
    </div>
  );
}

