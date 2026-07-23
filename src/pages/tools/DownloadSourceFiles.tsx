import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Loader2, Download, Copy, Eye, FileJson, FileText, Archive } from "lucide-react";

type JobRow = {
  id: string;
  external_job_id: string | null;
  status: string | null;
  updated_at: string | null;
  document_id: string | null;
  subject_id: string | null;
  has_presentation: boolean;
};

type SourceDocument = {
  id: string;
  file_name: string | null;
  full_content: unknown;
  topic_id: string | null;
  chapter_id: string | null;
  subject_id: string | null;
  updated_at: string | null;
  created_at: string | null;
  matchedBy?: string;
};

type BulkJobRow = {
  id: string;
  external_job_id: string | null;
  status: string | null;
  updated_at: string | null;
  document_id: string | null;
  subject_id: string | null;
  presentation_json: unknown;
  ai_assistant_documents?: SourceDocument | SourceDocument[] | null;
};

function triggerBlobDownload(text: string, filename: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatBytes(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${u[i]}`;
}

function extractMarkdown(doc: SourceDocument | null | undefined) {
  const fc = doc?.full_content;
  const md =
    (fc && typeof fc === "object" && !Array.isArray(fc) &&
      ((fc as Record<string, unknown>).content_markdown ??
        (fc as Record<string, unknown>).markdown ??
        (fc as Record<string, unknown>).md)) ||
    (typeof fc === "string" ? fc : "");
  return typeof md === "string" ? md : String(md ?? "");
}

function getJoinedDocument(row: BulkJobRow | null | undefined): SourceDocument | null {
  const joined = row?.ai_assistant_documents;
  if (!joined) return null;
  return Array.isArray(joined) ? joined[0] ?? null : joined;
}

function safePathSegment(value: string | null | undefined, fallback: string) {
  const raw = (value || fallback).trim() || fallback;
  return raw.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || fallback;
}

function triggerBlobObjectDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function DownloadSourceFiles() {
  const [jobIdInput, setJobIdInput] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState<null | "json" | "md">(null);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);

  // Latest 200 jobs with presentation_json set. Do not select the JSON payload here.
  const jobsQuery = useQuery({
    queryKey: ["download-source-files:jobs"],
    queryFn: async (): Promise<JobRow[]> => {
      const { data, error } = await supabase
        .from("video_generation_jobs")
        .select("id, external_job_id, status, updated_at, document_id, subject_id")
        .not("presentation_json", "is", null)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        external_job_id: r.external_job_id,
        status: r.status,
        updated_at: r.updated_at,
        document_id: r.document_id,
        subject_id: r.subject_id,
        has_presentation: true,
      }));
    },
    staleTime: 30_000,
  });

  // Auto-select first
  useEffect(() => {
    if (!selectedJobId && jobsQuery.data && jobsQuery.data.length > 0) {
      setSelectedJobId(jobsQuery.data[0].id);
    }
  }, [jobsQuery.data, selectedJobId]);

  const jobQuery = useQuery({
    queryKey: ["download-source-files:job", selectedJobId],
    enabled: !!selectedJobId,
    queryFn: async (): Promise<any> => {
      const selectFields = `
        id, external_job_id, status, updated_at, document_id, subject_id, presentation_json,
        ai_assistant_documents (
          id, file_name, full_content, topic_id, chapter_id, subject_id, updated_at, created_at
        )
      `;
      const { data, error } = await (supabase as any)
        .from("video_generation_jobs")
        .select(selectFields)
        .eq("id", selectedJobId as string)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) return data;

      const { data: externalData, error: externalError } = await (supabase as any)
        .from("video_generation_jobs")
        .select(selectFields)
        .eq("external_job_id", selectedJobId as string)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (externalError) throw externalError;
      return externalData;
    },
  });

  const documentId = (jobQuery.data as any)?.document_id ?? null;
  const joinedDoc = getJoinedDocument(jobQuery.data as BulkJobRow | null);
  const topicId = joinedDoc?.topic_id ?? null;
  const subjectId = (jobQuery.data as any)?.subject_id ?? null;
  const chapterId = joinedDoc?.chapter_id ?? null;

  const docQuery = useQuery({
    queryKey: ["download-source-files:doc", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_assistant_documents")
        .select("id, file_name, full_content, topic_id, chapter_id, subject_id, updated_at, created_at")
        .eq("id", documentId as string)
        .maybeSingle();
      if (error) throw error;
      return data ? ({ ...data, matchedBy: `document_id=${documentId}` } as SourceDocument) : null;
    },
  });

  const currentDoc = (docQuery.data as SourceDocument | null) ?? joinedDoc;

  const presentationText = useMemo(() => {
    const pj = (jobQuery.data as any)?.presentation_json;
    if (pj == null) return "";
    return JSON.stringify(pj);
  }, [jobQuery.data]);

  const markdownText = useMemo(() => {
    return extractMarkdown(currentDoc);
  }, [currentDoc]);

  const presBytes = new Blob([presentationText]).size;
  const mdBytes = new Blob([markdownText]).size;
  const hasPres = presentationText.length > 0;
  const hasMd = markdownText.length > 0;

  const downloadJson = () => {
    if (!hasPres) return;
    triggerBlobDownload(presentationText, "presentations.json", "application/json;charset=utf-8");
  };
  const downloadMd = () => {
    if (!hasMd) return;
    triggerBlobDownload(markdownText, "source.md", "text/markdown;charset=utf-8");
  };
  const downloadZip = async () => {
    if (!hasPres && !hasMd) return;
    const zip = new JSZip();
    if (hasPres) zip.file("presentations.json", presentationText);
    if (hasMd) zip.file("source.md", markdownText);
    const blob = await zip.generateAsync({ type: "blob" });
    triggerBlobObjectDownload(blob, "SimpleLecture-Source-Files.zip");
  };
  const downloadAllZip = async () => {
    if (bulkDownloading) return;
    setBulkDownloading(true);
    setBulkStatus("Reading generation jobs…");

    try {
      const selectFields = `
        id, external_job_id, status, updated_at, document_id, subject_id, presentation_json,
        ai_assistant_documents (
          id, file_name, full_content, topic_id, chapter_id, subject_id, updated_at, created_at
        )
      `;
      const pageSize = 100;
      let offset = 0;
      const rows: BulkJobRow[] = [];

      while (true) {
        const { data, error } = await (supabase as any)
          .from("video_generation_jobs")
          .select(selectFields)
          .order("updated_at", { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        const batch = (data || []) as BulkJobRow[];
        rows.push(...batch);
        setBulkStatus(`Reading generation jobs… ${rows.length}`);
        if (batch.length < pageSize) break;
        offset += pageSize;
      }

      const zip = new JSZip();
      let presentationCount = 0;
      let sourceCount = 0;
      let jobCount = 0;

      rows.forEach((row, index) => {
        const folderName = safePathSegment(row.id || row.external_job_id, `job-${index + 1}`);
        const folder = zip.folder(`generation-jobs/${folderName}`);
        if (!folder) return;

        let addedForJob = false;
        if (row.presentation_json != null) {
          folder.file("presentations.json", JSON.stringify(row.presentation_json));
          presentationCount += 1;
          addedForJob = true;
        }

        const doc = getJoinedDocument(row);
        const md = extractMarkdown(doc);
        if (md.length > 0) {
          folder.file("source.md", md);
          sourceCount += 1;
          addedForJob = true;
        }

        if (addedForJob) jobCount += 1;
      });

      if (presentationCount === 0 && sourceCount === 0) {
        toast({ title: "No files found", description: "No stored presentations.json or source.md content was available.", variant: "destructive" });
        setBulkStatus("No files found.");
        return;
      }

      setBulkStatus(`Creating ZIP: ${presentationCount} presentations.json + ${sourceCount} source.md files…`);
      const blob = await zip.generateAsync({ type: "blob" });
      triggerBlobObjectDownload(blob, "SimpleLecture-All-Generation-Source-Files.zip");
      toast({
        title: "Download ready",
        description: `${jobCount} job folders, ${presentationCount} presentations.json, ${sourceCount} source.md`,
      });
      setBulkStatus(`${jobCount} job folders exported.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create ZIP";
      toast({ title: "Bulk download failed", description: message, variant: "destructive" });
      setBulkStatus(message);
    } finally {
      setBulkDownloading(false);
    }
  };
  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `Copied ${label}` });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Download Source Files</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Downloads the exact <code>presentation_json</code> and uploaded source markdown for a
          video generation job. No transformation, no regeneration.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">One-click bulk download</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={downloadAllZip} disabled={bulkDownloading}>
            {bulkDownloading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Archive className="h-4 w-4 mr-1" />}
            Download ALL available files as ZIP
          </Button>
          <div className="text-xs text-muted-foreground">
            {bulkStatus || "Creates one ZIP with a folder per generation job, containing only files that exist."}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select generation job</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Paste an exact job id (e.g. Maths_2026...)"
              value={jobIdInput}
              onChange={(e) => setJobIdInput(e.target.value)}
              className="max-w-md"
            />
            <Button
              variant="outline"
              onClick={() => jobIdInput.trim() && setSelectedJobId(jobIdInput.trim())}
            >
              Load
            </Button>
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-1">
              …or pick from latest {jobsQuery.data?.length ?? 0} jobs with presentation_json
            </div>
            <Select
              value={selectedJobId ?? ""}
              onValueChange={(v) => setSelectedJobId(v)}
            >
              <SelectTrigger className="max-w-xl">
                <SelectValue placeholder={jobsQuery.isLoading ? "Loading..." : "Select job"} />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {(jobsQuery.data || []).map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    <span className="font-mono text-xs">{j.id}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      · {j.status} · {j.updated_at?.slice(0, 16).replace("T", " ")}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detected sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {jobQuery.isLoading || docQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : null}

          {jobQuery.error ? (
            <div className="rounded border border-destructive/40 bg-destructive/5 p-3 text-sm">
              Error loading job: {(jobQuery.error as Error).message}
              <Button size="sm" variant="outline" className="ml-2" onClick={() => jobQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : null}

          {/* presentations.json row */}
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <FileJson className="h-4 w-4" />
              <div className="font-medium">presentations.json</div>
              <span
                className={
                  "ml-auto text-xs px-2 py-0.5 rounded " +
                  (hasPres ? "bg-green-500/15 text-green-700" : "bg-muted text-muted-foreground")
                }
              >
                {hasPres ? "found" : "missing"}
              </span>
            </div>
            <div className="text-xs text-muted-foreground grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
              <div>Source: <code>video_generation_jobs.presentation_json</code></div>
              <div>job id: <code>{(jobQuery.data as any)?.id ?? "—"}</code></div>
              <div>MIME: <code>application/json;charset=utf-8</code></div>
              <div>Size: {formatBytes(presBytes)}</div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" onClick={downloadJson} disabled={!hasPres}>
                <Download className="h-4 w-4 mr-1" /> Download presentations.json
              </Button>
              <Button size="sm" variant="outline" onClick={() => copy(presentationText, "JSON")} disabled={!hasPres}>
                <Copy className="h-4 w-4 mr-1" /> Copy raw
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPreviewOpen("json")} disabled={!hasPres}>
                <Eye className="h-4 w-4 mr-1" /> Raw preview
              </Button>
            </div>
          </div>

          {/* source.md row */}
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <div className="font-medium">source.md</div>
              <span
                className={
                  "ml-auto text-xs px-2 py-0.5 rounded " +
                  (hasMd ? "bg-green-500/15 text-green-700" : "bg-muted text-muted-foreground")
                }
              >
                {hasMd ? "found" : "missing"}
              </span>
            </div>
            <div className="text-xs text-muted-foreground grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
              <div>
                Source: <code>ai_assistant_documents.full_content.content_markdown</code>
              </div>
              <div>document id: <code>{currentDoc?.id ?? "—"}</code></div>
              <div>original file_name: <code>{currentDoc?.file_name ?? "—"}</code></div>
              <div>MIME: <code>text/markdown;charset=utf-8</code></div>
              <div>Size: {formatBytes(mdBytes)}</div>
              <div>
                matched by: {currentDoc?.matchedBy ?? (documentId ? `document_id=${documentId}` : "—")}
              </div>
            </div>
            {!hasMd && (jobQuery.data as any) && (
              <div className="text-xs text-amber-700 bg-amber-500/10 rounded p-2">
                No <code>content_markdown</code> found on the matched ai_assistant_documents row
                (or no row is bound to this job's topic/chapter/subject). Nothing will be written
                to disk — a placeholder is never generated.
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" onClick={downloadMd} disabled={!hasMd}>
                <Download className="h-4 w-4 mr-1" /> Download source.md
              </Button>
              <Button size="sm" variant="outline" onClick={() => copy(markdownText, "Markdown")} disabled={!hasMd}>
                <Copy className="h-4 w-4 mr-1" /> Copy raw
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPreviewOpen("md")} disabled={!hasMd}>
                <Eye className="h-4 w-4 mr-1" /> Raw preview
              </Button>
            </div>
          </div>

          <div className="pt-2">
            <Button onClick={downloadZip} disabled={!hasPres && !hasMd}>
              <Archive className="h-4 w-4 mr-1" /> Download Both as ZIP
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewOpen !== null} onOpenChange={(o) => !o && setPreviewOpen(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {previewOpen === "json" ? "presentations.json (raw)" : "source.md (raw)"}
            </DialogTitle>
          </DialogHeader>
          <pre className="text-xs whitespace-pre-wrap break-all border rounded p-3 max-h-[65vh] overflow-y-auto bg-muted/40">
            {previewOpen === "json" ? presentationText : markdownText}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
