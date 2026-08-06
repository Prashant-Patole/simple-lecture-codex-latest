import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import mammoth from "mammoth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Eye, Film, FileText, BookOpen } from "lucide-react";
import { useSubjectChapters, useChapterTopics } from "@/hooks/useSubjectManagement";
import { useAIAssistantDocuments } from "@/hooks/useAIAssistantDocuments";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useReelJobs } from "@/hooks/useReelJobs";
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow } from "date-fns";
import { ReelJobVariants } from "@/components/admin/ReelJobVariants";
import { ReelJobRebindDialog } from "@/components/admin/ReelJobRebindDialog";



type ReadPayload =
  | { kind: "docx"; title: string; url: string }
  | { kind: "markdown"; title: string; markdown: string };

interface Props {
  subjectId: string;
}

export function SubjectReelsTab({ subjectId }: Props) {
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);

  const { data: chapters = [] } = useSubjectChapters(subjectId);
  const { data: topics = [] } = useChapterTopics(chapterId || undefined);
  const { data: docs = [], isLoading: docsLoading } = useAIAssistantDocuments(
    subjectId,
    chapterId,
    topicId
  );

  const [readDoc, setReadDoc] = useState<ReadPayload | null>(null);
  const [docxHtml, setDocxHtml] = useState<string>("");
  const [docxLoading, setDocxLoading] = useState(false);
  const [docxError, setDocxError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const { data: subject } = useQuery({
    queryKey: ["subject-name", subjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("popular_subjects")
        .select("id, name")
        .eq("id", subjectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!subjectId,
  });

  const { data: avatarConfig } = useQuery({
    queryKey: ["reel-subject-avatar-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_settings")
        .select("setting_value")
        .eq("setting_key", "marketing_avatar_config")
        .maybeSingle();
      if (error) throw error;
      return data?.setting_value as Record<string, any> | null;
    },
  });

  const qc = useQueryClient();
  const { data: reelJobs = [] } = useReelJobs(subjectId);

  const handleCreateReel = async (d: any) => {
    if (!d.source_url && !d.full_content?.markdown && !d.full_content?.content_markdown) {
      toast.error("This document has no file or content to submit.");
      return;
    }
    setSubmittingId(d.id);
    try {
      const payload: Record<string, any> = {
        action: "submit",
        server_ip: "204.12.237.78",
        target_port: 5006,
        subject: subject?.name || "General Science",
        grade: "12",
        dry_run: false,
        skip_wan: false,
        skip_avatar: false,
        audio_only: false,
        reel_with_avatar: true,
        tts_provider: "our_tts",
        pipeline_version: "v3",
        generation_scope: "full",
        video_provider: "kie",
        ocr_provider: "local",
        skip_threejs: false,
        avatar_language: "english",
        llm_routing: {
          chunker: "openrouter",
          director: "openrouter",
          manim_renderer: "openrouter",
          remotion_renderer: "openrouter",
          video_renderer: "openrouter",
          prompt_enhancer: "openrouter",
        },
      };
      const subjectAvatarId = avatarConfig?.subjects?.[
        String(subject?.name || "").trim().toLowerCase()
      ]?.avatar_id;
      if (subjectAvatarId) payload.avatar_id = subjectAvatarId;
      if (d.source_url) {
        payload.document_url = d.source_url;
        payload.file_name = d.file_name || d.display_name || "document";
        payload.source_type = d.source_type;
      } else {
        payload.markdown =
          d.full_content?.content_markdown || d.full_content?.markdown || "";
      }

      const { data, error } = await supabase.functions.invoke(
        "video-generation-proxy",
        { body: payload }
      );
      if (error) throw new Error(error.message || "Failed to submit reel");
      if (data?.error) throw new Error(data.error);
      if (!data?.job_id) throw new Error(data?.message || "No job_id returned");

      const { data: authData } = await supabase.auth.getUser();
      await supabase.from("reel_jobs").insert({
        subject_id: subjectId,
        document_id: d.id || null,
        file_name: d.display_name || d.file_name || null,
        job_id: data.job_id,
        server_ip: "204.12.237.78",
        target_port: 5006,
        status: data.status || "accepted",
        status_message: data.message || null,
        submitted_by: authData.user?.id || null,
      });
      qc.invalidateQueries({ queryKey: ["reel-jobs", subjectId] });

      toast.success(`Reel job submitted: ${data.job_id}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to submit reel");
    } finally {
      setSubmittingId(null);
    }
  };

  const statusVariant = (s: string): "default" | "secondary" | "outline" | "destructive" => {
    if (s === "completed") return "default";
    if (s === "failed" || s === "error") return "destructive";
    if (s === "processing" || s === "accepted") return "secondary";
    return "outline";
  };



  const openRead = (title: string, url: string | null, markdown?: string | null) => {
    if (url && /\.docx?($|\?)/i.test(url)) {
      setReadDoc({ kind: "docx", title, url });
    } else if (url) {
      setReadDoc({ kind: "docx", title, url });
    } else {
      setReadDoc({ kind: "markdown", title, markdown: markdown || "" });
    }
  };

  useEffect(() => {
    if (!readDoc || readDoc.kind !== "docx") {
      setDocxHtml("");
      setDocxError(null);
      return;
    }
    let cancelled = false;
    setDocxLoading(true);
    setDocxError(null);
    setDocxHtml("");
    fetch(readDoc.url)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch (${r.status})`);
        return r.arrayBuffer();
      })
      .then((buf) => mammoth.convertToHtml({ arrayBuffer: buf }))
      .then((res) => {
        if (!cancelled) setDocxHtml(res.value || "");
      })
      .catch((e) => {
        if (!cancelled) setDocxError(e?.message || "Failed to render document");
      })
      .finally(() => {
        if (!cancelled) setDocxLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [readDoc]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="h-5 w-5" /> Reels
          </CardTitle>
          <CardDescription>
            Pick a chapter or topic to view uploaded documents and create reels from them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Chapter</Label>
              <Select
                value={chapterId || "__all"}
                onValueChange={(v) => {
                  const next = v === "__all" ? null : v;
                  setChapterId(next);
                  setTopicId(null);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select chapter" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All chapters</SelectItem>
                  {chapters.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.chapter_number}. {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Topic</Label>
              <Select
                value={topicId || "__none"}
                onValueChange={(v) => setTopicId(v === "__none" ? null : v)}
                disabled={!chapterId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={chapterId ? "Chapter-level only" : "Pick chapter first"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Chapter-level only</SelectItem>
                  {topics.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.topic_number}. {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {reelJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Film className="h-4 w-4" /> Reel Jobs
            </CardTitle>
            <CardDescription>
              Live status of reel jobs submitted for this subject. Auto-refreshes every 5s.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="w-[160px]">Progress</TableHead>
                  <TableHead>Server</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reelJobs.map((j) => (
                  <React.Fragment key={j.id}>
                    <TableRow>
                      <TableCell className="font-medium max-w-[240px]">
                        <div className="truncate">{j.file_name || "—"}</div>
                        <div className="text-xs text-muted-foreground truncate">{j.job_id}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(j.status)}>{j.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[320px]">
                        <div className="truncate" title={j.status_message || j.error || ""}>
                          {j.error || j.status_message || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Progress value={j.progress} className="h-2" />
                          <div className="text-xs text-muted-foreground">{j.progress}%</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-muted-foreground">
                            {j.server_ip || "—"}:{j.target_port ?? "—"}
                          </span>
                          <ReelJobRebindDialog
                            reelJobRowId={j.id}
                            externalJobId={j.job_id}
                            subjectId={subjectId}
                            currentIp={j.server_ip}
                            currentPort={j.target_port}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(j.created_at), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                    {j.status === "completed" && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={6} className="py-2">
                          <ReelJobVariants jobId={j.job_id} reelJobId={j.id} serverIp={j.server_ip} targetPort={j.target_port} />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}

              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}



      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents</CardTitle>
          <CardDescription>
            {chapterId
              ? topicId
                ? "Documents attached to this topic"
                : "Documents attached at the chapter level"
              : "All documents for this subject"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!chapterId ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Select a chapter (and optional topic) above to load documents.
            </p>
          ) : docsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : docs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No documents found for this selection.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate max-w-[280px]">
                          {d.display_name || d.file_name || d.id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{d.source_type}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
                        {d.source_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(d.source_url!, "_blank")}
                          >
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            openRead(
                              d.display_name || d.file_name || "Document",
                              d.source_url,
                              (d as any).full_content?.markdown
                            )
                          }
                        >
                          <BookOpen className="h-4 w-4 mr-1" /> Read
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleCreateReel(d)}
                          disabled={submittingId === d.id}
                        >
                          {submittingId === d.id ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Film className="h-4 w-4 mr-1" />
                          )}
                          Create Reel
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!readDoc} onOpenChange={(o) => !o && setReadDoc(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="truncate">{readDoc?.title}</DialogTitle>
            <DialogDescription>
              {readDoc?.kind === "docx"
                ? "Rendered .docx preview (formatting and images)"
                : "Rendered markdown preview"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto rounded-md border bg-background p-4">
            {readDoc?.kind === "docx" ? (
              docxLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : docxError ? (
                <p className="text-sm text-destructive">{docxError}</p>
              ) : docxHtml ? (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none [&_img]:max-w-full [&_img]:h-auto [&_table]:border [&_th]:border [&_td]:border [&_th]:p-2 [&_td]:p-2"
                  dangerouslySetInnerHTML={{ __html: docxHtml }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Empty document.</p>
              )
            ) : readDoc?.kind === "markdown" ? (
              readDoc.markdown ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&_img]:max-w-full [&_img]:h-auto">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {readDoc.markdown}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No readable content stored for this document.
                </p>
              )
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
