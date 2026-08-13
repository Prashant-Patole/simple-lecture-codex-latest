import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Loader2, Play, Square, Eye, X, PlayCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAIAssistantDocuments } from "@/hooks/useAIAssistantDocuments";
import { useSubjectChapters, useChapterTopics } from "@/hooks/useSubjectChaptersTopics";
import {
  useActiveAutoSubmissionRun,
  type AutoSubmissionItem,
  type AutoSubmissionItemStatus,
} from "@/hooks/useActiveAutoSubmissionRun";

import { MarketingPayloadConfigCard, type MarketingPayloadConfig } from "./MarketingPayloadConfigCard";

interface Props {
  subjectId: string;
  subjectName: string;
  serverIp: string;
  kind?: string;
  pipelineConfig?: Record<string, unknown>;
}

const statusVariant = (s: AutoSubmissionItemStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (s) {
    case "queued": return "outline";
    case "waiting":
    case "submitting":
    case "processing":
    case "sanity_checking": return "secondary";
    case "completed":
    case "passed": return "default";
    case "stopped": return "destructive";
  }
};

const statusLabel: Record<AutoSubmissionItemStatus, string> = {
  queued: "Queued",
  submitting: "Submitting",
  waiting: "Waiting for server slot…",
  processing: "Processing",
  completed: "Completed",
  sanity_checking: "Sanity Checking",
  passed: "Passed ✓",
  stopped: "Stopped",
};

export function AutoSubmissionPipeline({ subjectId, subjectName, serverIp, kind = "lecture", pipelineConfig }: Props) {
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<Record<string, {
    documentId: string;
    displayName: string;
    sourceUrl: string | null;
    fileName: string | null;
    sourceType: string | null;
    markdown: string | null;
  }>>({});
  const selectedIds = Object.keys(selectedDocs);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"markdown" | "json">("markdown");
  const [starting, setStarting] = useState(false);
  const [marketingConfig, setMarketingConfig] = useState<MarketingPayloadConfig | null>(null);

  const { data: chapters } = useSubjectChapters(subjectId);
  const { data: topics } = useChapterTopics(selectedChapterId || undefined);
  const { data: documents, isLoading } = useAIAssistantDocuments(subjectId, selectedChapterId, selectedTopicId);
  const { run, stopRun, dismissRun, resumeRun } = useActiveAutoSubmissionRun(subjectId, kind);

  const isRunning = run?.status === "running";

  useEffect(() => {
    setSelectedTopicId(null);
  }, [selectedChapterId]);

  const previewDoc = documents?.find(d => d.id === previewId);
  const previewMd = (previewDoc?.full_content as any)?.content_markdown as string | undefined;
  const previewJson = useMemo(() => {
    const fc: any = previewDoc?.full_content;
    if (!fc) return null;
    const clone = { ...fc };
    if (clone.images && typeof clone.images === "object") {
      const n = Array.isArray(clone.images) ? clone.images.length : Object.keys(clone.images).length;
      clone.images = `[${n} images hidden]`;
    }
    return JSON.stringify(clone, null, 2);
  }, [previewDoc]);

  const toggleSelect = (id: string) => {
    setSelectedDocs(prev => {
      if (prev[id]) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      const d = documents?.find(x => x.id === id);
      if (!d) return prev;
      return {
        ...prev,
        [id]: {
          documentId: d.id,
          displayName: d.display_name || d.file_name || "Untitled",
          sourceUrl: d.source_url ?? null,
          fileName: d.file_name ?? null,
          sourceType: d.source_type ?? null,
          markdown: d.source_url ? null : ((d.full_content as any)?.content_markdown ?? null),
        },
      };
    });
  };

  const startPipeline = async () => {
    if (selectedIds.length === 0) {
      toast.error("Select at least one document");
      return;
    }
    setStarting(true);
    try {
      const snapshots = selectedIds.map(id => selectedDocs[id]).filter(Boolean);
      if (snapshots.length === 0) {
        toast.error("Selected documents are no longer available.");
        return;
      }
      const items: AutoSubmissionItem[] = snapshots.map(d => ({
        documentId: d.documentId,
        displayName: d.displayName,
        sourceUrl: d.sourceUrl,
        fileName: d.fileName,
        sourceType: d.sourceType,
        markdown: d.markdown,
        status: "queued",
      }));

      let resolvedAvatarId = marketingConfig?.avatar_id || (pipelineConfig as any)?.avatar_id || "";
      if (!resolvedAvatarId && subjectId) {
        const { data: subRow } = await supabase
          .from("popular_subjects")
          .select("avatar_id")
          .eq("id", subjectId)
          .maybeSingle();
        if (subRow?.avatar_id) resolvedAvatarId = subRow.avatar_id;
      }

      // Combine base pipelineConfig with user-selected marketing payload config if in marketing mode
      const effectivePipelineConfig = kind === "marketing" ? {
        ...(pipelineConfig || {}),
        avatar_id: resolvedAvatarId,
        // Explicit null when "None of these" is selected — do not fall back to defaults.
        target_languages: marketingConfig
          ? (marketingConfig.target_languages && marketingConfig.target_languages.length > 0
            ? marketingConfig.target_languages
            : null)
          : ((pipelineConfig as any)?.target_languages ?? ["kannada", "hindi"]),
        avatar_speaker: marketingConfig?.avatar_speaker ?? (pipelineConfig as any)?.avatar_speaker ?? "abhilash",
        avatar_language: marketingConfig?.avatar_language ?? (pipelineConfig as any)?.avatar_language ?? "english",
        tts_engine: marketingConfig?.tts_engine ?? (pipelineConfig as any)?.tts_engine ?? "default",
        llm_routing: marketingConfig?.llm_routing ?? (pipelineConfig as any)?.llm_routing,
      } : (pipelineConfig ?? null);

      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("auto_submission_runs" as any).insert([{
        subject_id: subjectId,
        subject_name: subjectName,
        server_ip: serverIp,
        status: "running",
        items: items as any,
        current_index: 0,
        created_by: user?.id,
        kind,
        pipeline_config: effectivePipelineConfig,
      }]);
      if (error) throw error;
      // Kick off immediately so user doesn't wait for cron
      supabase.functions.invoke("auto-submission-tick").catch(() => {});
      toast.success("Pipeline started — it will keep running on the server.");
      setSelectedDocs({});
    } catch (e: any) {
      toast.error(e?.message || "Failed to start pipeline");
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    if (!run) return;
    await stopRun(run.id);
    toast.message("Pipeline stop requested.");
  };

  const handleDismiss = async () => {
    if (!run) return;
    await dismissRun(run.id);
  };

  const handleResume = async () => {
    if (!run) return;
    await resumeRun(run.id);
    supabase.functions.invoke("auto-submission-tick").catch(() => {});
    toast.message("Pipeline resumed.");
  };

  return (
    <div className="space-y-4">
      {/* Render Marketing Video Payload Config Card ONLY in Marketing mode */}
      {kind === "marketing" && (
        <MarketingPayloadConfigCard
          subjectId={subjectId}
          subjectName={subjectName}
          onChange={setMarketingConfig}
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={selectedChapterId ?? "all"} onValueChange={v => setSelectedChapterId(v === "all" ? null : v)}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Chapter" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All chapters</SelectItem>
            {chapters?.map(c => <SelectItem key={c.id} value={c.id}>Ch. {c.chapter_number}: {c.title}</SelectItem>)}
          </SelectContent>
        </Select>
        {selectedChapterId && (
          <Select value={selectedTopicId ?? "all"} onValueChange={v => setSelectedTopicId(v === "all" ? null : v)}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Topic" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All topics</SelectItem>
              {topics?.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Selected: {selectedIds.length}
            {selectedIds.length > 0 && !isRunning && (
              <button
                type="button"
                onClick={() => { setSelectedDocs({}); }}
                className="ml-2 underline hover:text-foreground"
              >
                Clear
              </button>
            )}
          </span>
          <Button
            onClick={startPipeline}
            disabled={starting || isRunning || selectedIds.length === 0}
            className="gap-2"
          >
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Start Pipeline ({selectedIds.length})
          </Button>
          <Button variant="destructive" onClick={handleStop} disabled={!isRunning} className="gap-2">
            <Square className="h-4 w-4" /> Stop Pipeline
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && <TableRow><TableCell colSpan={3}><Loader2 className="h-4 w-4 animate-spin" /></TableCell></TableRow>}
                  {documents?.map(doc => (
                    <TableRow
                      key={doc.id}
                      onClick={() => setPreviewId(doc.id)}
                      className={`cursor-pointer ${previewId === doc.id ? "bg-muted/40" : ""}`}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.includes(doc.id)}
                          onCheckedChange={() => toggleSelect(doc.id)}
                          disabled={isRunning}
                        />
                      </TableCell>
                      <TableCell className="text-sm">{doc.display_name || doc.file_name}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" onClick={() => setPreviewId(doc.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold">Preview</div>
              <Tabs value={previewMode} onValueChange={(v) => setPreviewMode(v as "markdown" | "json")}>
                <TabsList className="h-7">
                  <TabsTrigger value="markdown" className="text-xs h-6">Markdown</TabsTrigger>
                  <TabsTrigger value="json" className="text-xs h-6">JSON</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <ScrollArea className="h-[370px]">
              {!previewDoc ? (
                <div className="text-xs text-muted-foreground">Select a document to preview.</div>
              ) : !previewDoc.full_content ? (
                <div className="text-xs text-muted-foreground">This document has no parsed content.</div>
              ) : previewMode === "markdown" ? (
                previewMd ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {previewMd}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No markdown content available for this document.</div>
                )
              ) : (
                <pre className="text-xs whitespace-pre-wrap font-mono">{previewJson}</pre>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {run && (
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold flex flex-wrap items-center gap-2">
                Pipeline Queue
                <Badge variant={run.status === "running" ? "secondary" : run.status === "completed" ? "default" : "destructive"}>
                  {run.status}
                </Badge>
                <span className="text-xs font-normal text-muted-foreground">
                  {run.items.length} total ·{" "}
                  {run.items.filter(i => i.status === "queued").length} queued ·{" "}
                  {run.items.filter(i => ["processing", "submitting", "waiting", "sanity_checking"].includes(i.status)).length} active ·{" "}
                  {run.items.filter(i => i.status === "passed" || i.status === "completed").length} done ·{" "}
                  {run.items.filter(i => i.status === "stopped").length} stopped
                </span>
                {run.last_tick_at && (
                  <span className="text-xs font-normal text-muted-foreground">
                    last tick: {new Date(run.last_tick_at).toLocaleTimeString()}
                  </span>
                )}
              </div>
              {run.status !== "running" && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={handleResume} className="gap-1">
                    <PlayCircle className="h-3 w-3" /> Resume
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleDismiss} className="gap-1">
                    <X className="h-3 w-3" /> Dismiss
                  </Button>
                </div>
              )}
            </div>
            <ol className="space-y-2">
              {run.items.map((it, idx) => {
                const isActive = idx === run.current_index && run.status === "running" &&
                  (it.status === "processing" || it.status === "sanity_checking" || it.status === "waiting" || it.status === "submitting");
                return (
                  <li key={`${it.documentId}-${idx}`} className="text-sm border rounded px-2 py-1.5 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-6">{idx + 1}.</span>
                      <span className="flex-1 truncate">{it.displayName}</span>
                      {isActive && (it.currentStep || it.currentPhase) && (
                        <span className="text-xs text-muted-foreground truncate max-w-[40%]">
                          {it.currentPhase ? `${it.currentPhase} · ` : ""}{it.currentStep ?? ""}
                        </span>
                      )}
                      {it.sanityDetail && <span className="text-xs text-muted-foreground">{it.sanityDetail}</span>}
                      {it.stopReason && <span className="text-xs text-destructive">{it.stopReason}</span>}
                      <Badge variant={statusVariant(it.status)}>{statusLabel[it.status]}</Badge>
                    </div>
                    {isActive && (
                      <Progress value={it.progress ?? 0} className="h-1.5" />
                    )}
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
