import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, ArrowLeft, RefreshCw, Eye, RotateCw, Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAskAIJobs, type AskAIJobRow } from "@/hooks/useAskAIJobs";
import { AskAIJobResultDialog } from "./AskAIJobResultDialog";
import { SUPABASE_DIRECT_URL } from "@/lib/supabaseUrl";

const PROXY_URL = `${SUPABASE_DIRECT_URL}/functions/v1/ai-teaching-proxy`;

interface Props {
  subjectId?: string;
  subjectName?: string;
  apiBase: string;
  onBack: () => void;
}

const statusBadge = (row: AskAIJobRow) => {
  const s = (row.pregen_status ?? "").toLowerCase();
  if (s === "failed")
    return <Badge variant="destructive">Failed</Badge>;
  if (row.is_pregen_done)
    return <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20">Ready</Badge>;
  return <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/20">Pending</Badge>;
};

export function AskAIJobsDashboard({ subjectId, subjectName, apiBase, onBack }: Props) {
  const [chapterId, setChapterId] = useState<string>("all");
  const [topicId, setTopicId] = useState<string>("all");
  const [status, setStatus] = useState<"all" | "pending" | "ready" | "failed">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AskAIJobRow | null>(null);

  const { data: chapters = [] } = useQuery({
    queryKey: ["ask-ai-chapters", subjectId],
    enabled: !!subjectId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subject_chapters")
        .select("id, chapter_number, title")
        .eq("subject_id", subjectId!)
        .order("chapter_number", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: topics = [] } = useQuery({
    queryKey: ["ask-ai-topics", chapterId],
    enabled: chapterId !== "all",
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subject_topics")
        .select("id, topic_number, title")
        .eq("chapter_id", chapterId)
        .order("topic_number", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: jobs = [], isLoading, isFetching, refetch, error } = useAskAIJobs({
    subjectId,
    chapterId: chapterId === "all" ? undefined : chapterId,
    topicId: topicId === "all" ? undefined : topicId,
    status,
    apiBase,
  });

  // Hydrate missing chapter/topic labels from supabase lookups
  const chapterMap = useMemo(() => {
    const m = new Map<string, any>();
    (chapters as any[]).forEach((c) => m.set(c.id, c));
    return m;
  }, [chapters]);
  const topicMap = useMemo(() => {
    const m = new Map<string, any>();
    (topics as any[]).forEach((t) => m.set(t.id, t));
    return m;
  }, [topics]);

  const filtered = useMemo(() => {
    let rows = jobs;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => (r.question_text || "").toLowerCase().includes(q));
    }
    return rows;
  }, [jobs, search]);

  const formatLabel = (r: AskAIJobRow) => {
    const c = chapterMap.get(r.chapter_id || "") || {};
    const t = topicMap.get(r.topic_id || "") || {};
    const cNum = r.chapter_number ?? c.chapter_number;
    const tNum = r.topic_number ?? t.topic_number;
    const cTitle = r.chapter_title ?? c.title ?? "Chapter";
    const tTitle = r.topic_title ?? t.title ?? "Topic";
    const prefix = cNum && tNum ? `${cNum}.${tNum}` : cNum ? `${cNum}` : "";
    return `${prefix ? prefix + " — " : ""}${cTitle} › ${tTitle}`;
  };

  const handleRetry = async (row: AskAIJobRow) => {
    try {
      const path = `/pregen/retry`;
      const url = `${PROXY_URL}?path=${encodeURIComponent(path)}&base=${encodeURIComponent(apiBase.replace(/\/+$/, ""))}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: row.job_id, question_id: row.question_id }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: "Retry submitted" });
      refetch();
    } catch (e: any) {
      toast({ title: "Retry failed", description: e?.message, variant: "destructive" });
    }
  };

  const copyQuestionId = (id?: string) => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    toast({ title: "Question ID copied" });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              Ask AI — Jobs Dashboard
            </CardTitle>
            <CardDescription>
              Live status of submitted question jobs for this subject.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Select value={chapterId} onValueChange={(v) => { setChapterId(v); setTopicId("all"); }}>
            <SelectTrigger><SelectValue placeholder="Chapter" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All chapters</SelectItem>
              {(chapters as any[]).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.chapter_number}. {c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={topicId} onValueChange={setTopicId} disabled={chapterId === "all"}>
            <SelectTrigger><SelectValue placeholder={chapterId === "all" ? "Pick chapter first" : "Topic"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All topics</SelectItem>
              {(topics as any[]).map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.topic_number} {t.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={(v: any) => setStatus(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search question text…"
          />
        </div>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            {(error as Error).message}
          </div>
        )}

        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Chapter › Topic</TableHead>
                <TableHead>Question</TableHead>
                <TableHead className="w-32">Question ID</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-40 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                    No jobs yet — submit a question from the form.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row, i) => {
                  const cNum = row.chapter_number ?? chapterMap.get(row.chapter_id || "")?.chapter_number;
                  const tNum = row.topic_number ?? topicMap.get(row.topic_id || "")?.topic_number;
                  return (
                    <TableRow key={row.id || row.job_id || i}>
                      <TableCell className="font-mono text-xs">
                        {cNum && tNum ? `${cNum}.${tNum}` : i + 1}
                      </TableCell>
                      <TableCell className="text-xs">{formatLabel(row)}</TableCell>
                      <TableCell className="text-xs max-w-md truncate">{row.question_text}</TableCell>
                      <TableCell>
                        {row.id ? (
                          <button
                            type="button"
                            onClick={() => copyQuestionId(row.id)}
                            className="font-mono text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/70 inline-flex items-center gap-1"
                            title={row.id}
                          >
                            {row.id.slice(0, 8)} <Copy className="h-3 w-3" />
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{statusBadge(row)}</TableCell>
                      <TableCell className="text-right space-x-1">
                        {row.is_pregen_done && (
                          <Button size="sm" variant="outline" onClick={() => setSelected(row)}>
                            <Eye className="h-3.5 w-3.5" /> View
                          </Button>
                        )}
                        {(row.pregen_status ?? "").toLowerCase() === "failed" && (
                          <Button size="sm" variant="outline" onClick={() => handleRetry(row)}>
                            <RotateCw className="h-3.5 w-3.5" /> Retry
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="text-[11px] text-muted-foreground">
          {filtered.length} job(s) · auto-refreshes every 3s while any job is pending
        </div>
      </CardContent>

      {selected && (
        <AskAIJobResultDialog
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
          apiBase={apiBase}
          subjectId={subjectId}
          subjectName={subjectName}
          question={selected.question_text || ""}
          jobId={selected.id}
          label={formatLabel(selected)}
        />
      )}
    </Card>
  );
}

export default AskAIJobsDashboard;
