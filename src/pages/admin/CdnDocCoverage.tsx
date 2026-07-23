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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Play, Download, Search, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  auditTopic, mapLimited, exportCoverageDocx,
  CDN_BASE,
  type TopicCoverage, type TopicInput,
} from "@/lib/reports/cdnDocCoverage";
import { getCdnMediaUrl } from "@/components/learning/player/utils/mediaResolver";

type PublishFilter = "all" | "published" | "unpublished";

export default function CdnDocCoverage() {
  const [subjectId, setSubjectId] = useState<string>("all");
  const [publishFilter, setPublishFilter] = useState<PublishFilter>("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<TopicCoverage[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const subjectsQ = useQuery({
    queryKey: ["cdn-cov-subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("popular_subjects").select("id,name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const topicsQ = useQuery({
    queryKey: ["cdn-cov-topics"],
    queryFn: async () => {
      const subjects = ["Social Science", "Maths", "Science"];
      const { data, error } = await supabase.rpc(
        "scan_video_generation_coverage" as any,
        { p_subject_names: subjects },
      );
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const candidates: TopicInput[] = useMemo(() => {
    if (!topicsQ.data) return [];
    return topicsQ.data
      .filter((r: any) => r.latest_external_job_id)
      .map((r: any): TopicInput => ({
        externalJobId: r.latest_external_job_id,
        subjectName: r.subject_name ?? "",
        chapterTitle: r.chapter_title ?? "",
        topicTitle: r.topic_title ?? r.document_name ?? "",
        isPublished: (r.published_completed_jobs ?? 0) > 0
          || String(r.latest_status ?? "").toLowerCase().includes("publish"),
      }));
  }, [topicsQ.data]);

  const filteredCandidates = useMemo(() => {
    const subjName = subjectsQ.data?.find(s => s.id === subjectId)?.name;
    return candidates.filter(c => {
      if (subjectId !== "all" && subjName && c.subjectName !== subjName) return false;
      if (publishFilter === "published" && !c.isPublished) return false;
      if (publishFilter === "unpublished" && c.isPublished) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!c.topicTitle.toLowerCase().includes(q)
          && !c.chapterTitle.toLowerCase().includes(q)
          && !c.subjectName.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [candidates, subjectId, subjectsQ.data, publishFilter, search]);

  const run = useMutation({
    mutationFn: async () => {
      const list = filteredCandidates;
      if (!list.length) throw new Error("No topics match the filters");
      setProgress({ done: 0, total: list.length });
      setRows([]);
      let done = 0;
      const results = await mapLimited(list, 4, async (t) => {
        const r = await auditTopic(t);
        done++;
        setProgress({ done, total: list.length });
        return r;
      });
      setRows(results);
      return results;
    },
    onSuccess: (results) => {
      const empty = results.filter(r => r.zeroContentSections > 0).length;
      toast.success(`Audited ${results.length} topics · ${empty} have empty content sections`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const summary = useMemo(() => {
    if (!rows.length) return null;
    const avgDoc = Math.round(rows.reduce((s, r) => s + r.documentCoveragePct, 0) / rows.length);
    const avgSec = Math.round(rows.reduce((s, r) => s + r.avgSectionCoveragePct, 0) / rows.length);
    return {
      total: rows.length,
      published: rows.filter(r => r.isPublished).length,
      totalContentSections: rows.reduce((s, r) => s + r.contentSectionCount, 0),
      topicsWithZero: rows.filter(r => r.zeroContentSections > 0).length,
      totalZeroSections: rows.reduce((s, r) => s + r.zeroContentSections, 0),
      segsCov: rows.reduce((s, r) => s + r.segmentsCovered, 0),
      segsTot: rows.reduce((s, r) => s + r.segmentsTotal, 0),
      beatsAnc: rows.reduce((s, r) => s + r.beatsAnchored, 0),
      beatsTot: rows.reduce((s, r) => s + r.beatsTotal, 0),
      noSource: rows.filter(r => !r.sourceDocOk).length,
      noPresentation: rows.filter(r => !r.presentationOk).length,
      avgDoc, avgSec,
    };
  }, [rows]);

  const filterHint = subjectId === "all"
    ? "all"
    : (subjectsQ.data?.find(s => s.id === subjectId)?.name ?? "subject").replace(/\s+/g, "-").toLowerCase();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">CDN Doc Coverage</h1>
        <p className="text-muted-foreground text-sm max-w-3xl">
          Fetches <code>presentation.json</code> and <code>source_document.docx</code> directly from
          <code className="mx-1">{CDN_BASE}</code> and reports how much of the source document is
          covered — computed from each content section's segment narration and visual-beat
          <code className="mx-1">markdown_pointer</code> ranges.
        </p>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4 text-xs text-muted-foreground space-y-1.5">
          <div className="font-medium text-foreground">How coverage is decided</div>
          <div>
            For every <b>content</b> section we check two things:
          </div>
          <div>
            <b>Segments</b> — each segment's <code>narration.text</code> is scored against the source.
            <span className="text-emerald-700"> Covered</span> if ≥ 60% of its content words appear
            in the source, <span className="text-amber-700"> Partial</span> if ≥ 30%,
            <span className="text-red-700"> Missing</span> otherwise.
          </div>
          <div>
            <b>Beats</b> — every <code>visual_beats[].markdown_pointer</code> range is located in the
            source. Both phrases found → <span className="text-emerald-700">Anchored</span> (that
            char span is marked covered). Only one found → <span className="text-amber-700">Partial</span>.
            Neither found → <span className="text-red-700">Missing</span> (falls back to
            <code>display_text</code> overlap).
          </div>
          <div>
            <b>Doc coverage %</b> = union of all anchored beat spans / normalized source length × 100.
            <b> Section coverage %</b> = average of segment score and beat score for that section.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 pb-4 flex flex-wrap gap-3 items-center">
          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Subject" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {(subjectsQ.data ?? []).map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={publishFilter} onValueChange={(v: PublishFilter) => setPublishFilter(v)}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All (published + not)</SelectItem>
              <SelectItem value="published">Published only</SelectItem>
              <SelectItem value="unpublished">Unpublished only</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search topic / chapter / subject…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>

          <div className="text-sm text-muted-foreground">{filteredCandidates.length} topics selected</div>

          <Button onClick={() => run.mutate()} disabled={run.isPending || !filteredCandidates.length}>
            {run.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Run audit
          </Button>

          <Button
            variant="outline"
            disabled={!rows.length || run.isPending}
            onClick={() => exportCoverageDocx(rows, filterHint)}
          >
            <Download className="h-4 w-4 mr-2" /> Export .docx
          </Button>
        </CardContent>
      </Card>

      {run.isPending && progress && (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-2">
            <div className="text-sm">Auditing {progress.done} / {progress.total}…</div>
            <Progress value={(progress.done / Math.max(progress.total, 1)) * 100} className="h-2" />
          </CardContent>
        </Card>
      )}

      {topicsQ.isLoading && (
        <Card><CardContent className="py-4"><Skeleton className="h-6 w-64" /></CardContent></Card>
      )}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Topics audited" value={summary.total} />
          <Stat label="Published" value={summary.published} tone="good" />
          <Stat label="Content sections (total)" value={summary.totalContentSections} />
          <Stat label="Topics w/ empty section" value={summary.topicsWithZero} tone="bad" />
          <Stat label="Empty sections (total)" value={summary.totalZeroSections} tone="bad" />
          <Stat label="Segments cov/total" value={`${summary.segsCov}/${summary.segsTot}`} />
          <Stat label="Beats anchored/total" value={`${summary.beatsAnc}/${summary.beatsTot}`} />
          <Stat label="Avg document cov" value={`${summary.avgDoc}%`} />
          <Stat label="Avg section cov" value={`${summary.avgSec}%`} />
          <Stat label="No source.docx" value={summary.noSource} tone="warn" />
        </div>
      )}

      {rows.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Results</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Subject / Chapter / Topic</TableHead>
                    <TableHead>Pub?</TableHead>
                    <TableHead className="text-right">Content sec</TableHead>
                    <TableHead className="text-right">Segs cov/tot</TableHead>
                    <TableHead className="text-right">Beats anch/tot</TableHead>
                    <TableHead className="text-right">Doc cov %</TableHead>
                    <TableHead className="text-right">Avg sec %</TableHead>
                    <TableHead>Files</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows
                    .slice()
                    .sort((a, b) => a.documentCoveragePct - b.documentCoveragePct)
                    .map(r => (
                      <ResultRow key={r.externalJobId} row={r} />
                    ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {!rows.length && !run.isPending && !topicsQ.isLoading && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            Pick a subject & publish filter, then click <b>Run audit</b>. Every topic fetches
            <code className="mx-1">presentation.json</code> and <code>source_document.docx</code> from the CDN.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "good" | "warn" | "bad" }) {
  const cls = tone === "good" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : tone === "bad" ? "text-red-600" : "";
  return (
    <Card><CardContent className="pt-4 pb-4">
      <div className={`text-xs ${cls}`}>{label}</div>
      <div className={`text-2xl font-bold mt-1 ${cls}`}>{value}</div>
    </CardContent></Card>
  );
}

function ResultRow({ row: r }: { row: TopicCoverage }) {
  const [open, setOpen] = useState(false);
  const tone =
    r.error ? "bad" :
    r.documentCoveragePct >= 80 ? "good" :
    r.documentCoveragePct >= 40 ? "warn" : "bad";
  const badgeCls =
    tone === "good" ? "bg-emerald-100 text-emerald-800" :
    tone === "warn" ? "bg-amber-100 text-amber-800" :
    "bg-red-100 text-red-800";
  const presentationUrl = getCdnMediaUrl(r.externalJobId, "presentation.json", CDN_BASE);
  const sourceUrl = getCdnMediaUrl(r.externalJobId, "source_document.docx", CDN_BASE);

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setOpen(v => !v)}>
        <TableCell>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </TableCell>
        <TableCell className="max-w-[420px]">
          <div className="font-medium truncate">{r.topicTitle}</div>
          <div className="text-xs text-muted-foreground truncate">
            {r.subjectName} › {r.chapterTitle}
          </div>
          {r.error && <div className="text-xs text-red-600 mt-0.5">⚠ {r.error}</div>}
        </TableCell>
        <TableCell>{r.isPublished ? <Badge>Yes</Badge> : <Badge variant="secondary">No</Badge>}</TableCell>
        <TableCell className="text-right">
          {r.contentSectionCount}
          {r.zeroContentSections > 0 && (
            <span className="text-red-600 text-xs ml-1">({r.zeroContentSections} empty)</span>
          )}
        </TableCell>
        <TableCell className="text-right">
          <span className="text-emerald-700">{r.segmentsCovered}</span>
          <span className="text-muted-foreground">/{r.segmentsTotal}</span>
        </TableCell>
        <TableCell className="text-right">
          <span className="text-emerald-700">{r.beatsAnchored}</span>
          <span className="text-muted-foreground">/{r.beatsTotal}</span>
        </TableCell>
        <TableCell className="text-right"><Badge className={badgeCls}>{r.documentCoveragePct}%</Badge></TableCell>
        <TableCell className="text-right">{r.avgSectionCoveragePct}%</TableCell>
        <TableCell>
          <div className="flex gap-2 text-xs">
            <a href={presentationUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              json <ExternalLink className="h-3 w-3" />
            </a>
            <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              docx <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={9} className="bg-muted/30">
            <div className="py-2 space-y-4">
              <div className="text-xs text-muted-foreground">
                Source length: {r.sourceCharsTotal.toLocaleString()} chars · Covered by beat spans: {r.sourceCharsCovered.toLocaleString()} chars
              </div>

              {r.sections.map(sec => (
                <div key={String(sec.sectionId)} className="border rounded p-2 bg-background">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="font-medium text-sm truncate">
                      §{String(sec.sectionId)} · {sec.title || "(untitled)"}
                    </div>
                    <div className="text-xs shrink-0">
                      <span className="text-muted-foreground">segs </span>
                      <span className="text-emerald-700">{sec.segmentsCovered}</span>
                      <span className="text-amber-700">/{sec.segmentsPartial}</span>
                      <span className="text-red-700">/{sec.segmentsMissing}</span>
                      <span className="text-muted-foreground ml-2">beats </span>
                      <span className="text-emerald-700">{sec.beatsAnchored}</span>
                      <span className="text-amber-700">/{sec.beatsPartial}</span>
                      <span className="text-red-700">/{sec.beatsMissing}</span>
                      <Badge className="ml-2" variant="secondary">{sec.sectionCoveragePct}%</Badge>
                    </div>
                  </div>
                  {sec.segments.length === 0 && sec.beats.length === 0 && (
                    <div className="text-xs text-red-600">⚠ No segments or beats in this section.</div>
                  )}
                  {sec.segments.length > 0 && (
                    <div className="mt-1">
                      <div className="text-[11px] font-medium text-muted-foreground">Segments</div>
                      <ul className="text-xs space-y-0.5">
                        {sec.segments.map(s => (
                          <li key={s.segmentId} className="flex items-start gap-2">
                            <span className={
                              s.status === "covered" ? "text-emerald-700" :
                              s.status === "partial" ? "text-amber-700" : "text-red-700"
                            }>●</span>
                            <span className="flex-1">
                              <span className="text-muted-foreground">{s.segmentId} ({(s.overlap * 100).toFixed(0)}%): </span>
                              {s.text.slice(0, 200)}{s.text.length > 200 ? "…" : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {sec.beats.length > 0 && (
                    <div className="mt-1">
                      <div className="text-[11px] font-medium text-muted-foreground">Beats (markdown_pointer)</div>
                      <ul className="text-xs space-y-0.5">
                        {sec.beats.map(b => (
                          <li key={b.beatId} className="flex items-start gap-2">
                            <span className={
                              b.status === "anchored" ? "text-emerald-700" :
                              b.status === "partial" ? "text-amber-700" : "text-red-700"
                            }>▸</span>
                            <span className="flex-1">
                              <span className="text-muted-foreground">{b.beatId} ({b.status}): </span>
                              {(b.startPhrase || b.endPhrase)
                                ? <><span className="italic">{(b.startPhrase || "").slice(0, 60)}</span> … <span className="italic">{(b.endPhrase || "").slice(0, 60)}</span></>
                                : <span className="text-muted-foreground">no markdown_pointer — {b.displayText?.slice(0, 120)}</span>
                              }
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}

              {r.uncoveredGaps.length > 0 && (
                <div>
                  <div className="text-xs font-medium mb-1">Top uncovered source ranges</div>
                  <ul className="text-xs space-y-1">
                    {r.uncoveredGaps.map((g, i) => (
                      <li key={i} className="text-muted-foreground border-l-2 border-red-300 pl-2">
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
