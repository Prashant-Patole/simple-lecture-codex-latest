import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CheckCircle2, AlertTriangle, XCircle, Languages, PlayCircle, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { VideoJobWithDocument } from '@/hooks/useVideoGenerationJobs';
import { downloadLanguageCheckDocx, type LangCheckRow, type DuplicateGroup, type MissingTopic } from '@/lib/reports/languageCheckReport';
import type { SubjectChapterWithTopics } from '@/hooks/useSubjectChaptersOptimized';

interface CheckResult {
  job_id: string;
  missing_sections: string[];
  presentation_errors: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobs: VideoJobWithDocument[];
  subjectName?: string;
  chapters?: SubjectChapterWithTopics[];
}

type Tab = 'all' | 'published' | 'unpublished';

const BATCH_SIZE = 10;

export function CloudLanguageCheckerDialog({ open, onOpenChange, jobs, subjectName = 'Subject', chapters = [] }: Props) {
  const [tab, setTab] = useState<Tab>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);


  const filtered = useMemo(() => {
    const eligible = jobs.filter((j) => !!j.external_job_id);
    if (tab === 'published') return eligible.filter((j) => (j as any).is_published === true);
    if (tab === 'unpublished') return eligible.filter((j) => (j as any).is_published !== true);
    return eligible;
  }, [jobs, tab]);

  const publishedCount = jobs.filter((j) => (j as any).is_published === true).length;
  const unpublishedCount = jobs.filter((j) => (j as any).is_published !== true).length;

  const allChecked = filtered.length > 0 && filtered.every((j) => selected.has(j.external_job_id!));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) filtered.forEach((j) => next.delete(j.external_job_id!));
      else filtered.forEach((j) => next.add(j.external_job_id!));
      return next;
    });
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const invokeCheck = async (ids: string[]): Promise<CheckResult[]> => {
    const { data, error } = await supabase.functions.invoke('cloud-language-check', { body: { jobs: ids } });
    if (error) throw error;
    if (data?.error) throw new Error(`${data.error}${data.upstream_status ? ` (upstream ${data.upstream_status})` : ''}`);
    return (data?.results || []) as CheckResult[];
  };


  const runCheck = async (ids: string[]) => {
    if (ids.length === 0) {
      toast.error('Select at least one job');
      return;
    }
    setLoading(true);
    try {
      const rows = await invokeCheck(ids);
      setResults((prev) => {
        const next = { ...prev };
        rows.forEach((r) => (next[r.job_id] = r));
        return next;
      });
      toast.success(`Checked ${rows.length} job(s)`);
    } catch (e: any) {
      toast.error(e?.message || 'Check failed');
    } finally {
      setLoading(false);
    }
  };

  const checkAllPublishedAndExport = async () => {
    const publishedJobs = jobs.filter((j) => j.external_job_id && (j as any).is_published === true);
    if (publishedJobs.length === 0) {
      toast.error('No published jobs to check');
      return;
    }
    setExporting(true);
    setProgress({ done: 0, total: publishedJobs.length });
    const collected: Record<string, CheckResult> = {};
    try {
      for (let i = 0; i < publishedJobs.length; i += BATCH_SIZE) {
        const batch = publishedJobs.slice(i, i + BATCH_SIZE);
        const rows = await invokeCheck(batch.map((j) => j.external_job_id!));
        rows.forEach((r) => (collected[r.job_id] = r));
        setProgress({ done: Math.min(i + BATCH_SIZE, publishedJobs.length), total: publishedJobs.length });
      }
      setResults((prev) => ({ ...prev, ...collected }));

      const rows: LangCheckRow[] = publishedJobs.map((j) => {
        const doc: any = (j as any).ai_assistant_documents || {};
        const r = collected[j.external_job_id!] || { job_id: j.external_job_id!, missing_sections: [], presentation_errors: ['No response'] };
        return {
          jobId: j.external_job_id!,
          serverIp: (j as any).server_ip || null,
          chapterNumber: doc?.subject_chapters?.chapter_number,
          chapterTitle: doc?.subject_chapters?.title,
          topicNumber: doc?.subject_topics?.topic_number,
          topicTitle: doc?.subject_topics?.title,
          documentName: j.document_name || undefined,
          missing_sections: r.missing_sections || [],
          presentation_errors: r.presentation_errors || [],
        };
      });

      // Duplicates: group PUBLISHED jobs by topic_id
      const byTopic = new Map<string, VideoJobWithDocument[]>();
      for (const j of publishedJobs) {
        const tid = (j as any).ai_assistant_documents?.topic_id;
        if (!tid) continue;
        if (!byTopic.has(tid)) byTopic.set(tid, []);
        byTopic.get(tid)!.push(j);
      }
      const duplicates: DuplicateGroup[] = [];
      for (const [, list] of byTopic) {
        if (list.length < 2) continue;
        const doc: any = (list[0] as any).ai_assistant_documents || {};
        duplicates.push({
          chapterNumber: doc?.subject_chapters?.chapter_number,
          chapterTitle: doc?.subject_chapters?.title,
          topicNumber: doc?.subject_topics?.topic_number,
          topicTitle: doc?.subject_topics?.title,
          jobs: list.map((j) => ({ jobId: j.external_job_id!, documentName: j.document_name || undefined })),
        });
      }

      // Missing topics: any topic in chapters tree without a published job
      const publishedTopicIds = new Set(
        publishedJobs.map((j) => (j as any).ai_assistant_documents?.topic_id).filter(Boolean),
      );
      const missingTopics: MissingTopic[] = [];
      for (const ch of chapters) {
        for (const tp of ch.subject_topics || []) {
          if (!publishedTopicIds.has(tp.id)) {
            missingTopics.push({
              chapterNumber: ch.chapter_number,
              chapterTitle: ch.title,
              topicNumber: tp.topic_number,
              topicTitle: tp.title,
            });
          }
        }
      }

      await downloadLanguageCheckDocx(subjectName, rows, { duplicates, missingTopics });
      toast.success(`Report exported (${rows.length} jobs · ${duplicates.length} dup · ${missingTopics.length} missing)`);
    } catch (e: any) {
      toast.error(e?.message || 'Export failed');
    } finally {
      setExporting(false);
      setProgress(null);
    }
  };


  const renderStatus = (jobId: string) => {
    const r = results[jobId];
    if (!r) return <Badge variant="outline" className="text-muted-foreground">Not checked</Badge>;
    if (r.presentation_errors.length > 0) {
      return (
        <div className="space-y-1">
          <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Fatal</Badge>
          <ul className="text-xs text-destructive list-disc pl-4">
            {r.presentation_errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      );
    }
    if (r.missing_sections.length > 0) {
      return (
        <div className="space-y-1">
          <Badge className="gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">
            <AlertTriangle className="h-3 w-3" /> {r.missing_sections.length} missing
          </Badge>
          <ScrollArea className="max-h-24">
            <ul className="text-xs text-amber-700 dark:text-amber-300 list-disc pl-4 pr-2">
              {r.missing_sections.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </ScrollArea>
        </div>
      );
    }
    return <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"><CheckCircle2 className="h-3 w-3" /> Complete (EN + KN)</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" /> Cloud Job Language Checker
          </DialogTitle>
          <DialogDescription>
            Verifies English &amp; Kannada avatars (JSON + physical .mp4 on FTP) via
            <code className="mx-1 px-1 bg-muted rounded text-xs">204.12.237.78:5009/api/check</code>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 flex-wrap border-b pb-3">
          <div className="flex gap-1 rounded-md border p-0.5">
            {(['all', 'published', 'unpublished'] as Tab[]).map((t) => (
              <Button
                key={t}
                size="sm"
                variant={tab === t ? 'default' : 'ghost'}
                className="h-7 text-xs capitalize"
                onClick={() => setTab(t)}
              >
                {t} ({t === 'all' ? jobs.length : t === 'published' ? publishedCount : unpublishedCount})
              </Button>
            ))}
          </div>
          <div className="flex-1" />
          {progress && (
            <span className="text-xs text-muted-foreground">
              Checking {progress.done} / {progress.total}…
            </span>
          )}
          <Button
            size="sm"
            variant="default"
            onClick={checkAllPublishedAndExport}
            disabled={exporting || loading || publishedCount === 0}
            className="gap-1"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Check all Published & Export ({publishedCount})
          </Button>
          <Button size="sm" variant="outline" onClick={() => runCheck(filtered.map((j) => j.external_job_id!))} disabled={loading || exporting || filtered.length === 0}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <PlayCircle className="h-4 w-4 mr-1" />}
            Check all ({filtered.length})
          </Button>
          <Button size="sm" onClick={() => runCheck(Array.from(selected))} disabled={loading || exporting || selected.size === 0}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <PlayCircle className="h-4 w-4 mr-1" />}
            Check selected ({selected.size})
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background border-b">
              <tr className="text-left">
                <th className="p-2 w-8"><Checkbox checked={allChecked} onCheckedChange={toggleAll} /></th>
                <th className="p-2">Chapter › Topic</th>
                <th className="p-2 w-40">Job ID</th>
                <th className="p-2 w-32">Server</th>
                <th className="p-2 w-24">Published</th>
                <th className="p-2 w-72">Language Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No jobs</td></tr>
              ) : filtered.map((j) => {
                const id = j.external_job_id!;
                const doc: any = (j as any).ai_assistant_documents || {};
                const ch = doc.subject_chapters;
                const tp = doc.subject_topics;
                const label = [
                  ch?.chapter_number && tp?.topic_number ? `${ch.chapter_number}.${tp.topic_number}` : null,
                  ch?.title,
                  tp?.title,
                ].filter(Boolean).join(' › ') || j.document_name || '—';
                const serverIp = (j as any).server_ip as string | null | undefined;
                return (
                  <tr key={j.id} className="border-b hover:bg-muted/40 align-top">
                    <td className="p-2"><Checkbox checked={selected.has(id)} onCheckedChange={() => toggleOne(id)} /></td>
                    <td className="p-2">{label}</td>
                    <td className="p-2 font-mono text-xs break-all">{id}</td>
                    <td className="p-2 font-mono text-xs">
                      {serverIp ? (
                        <Badge variant="outline" className="font-mono text-[10px]">{serverIp}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-2">
                      {(j as any).is_published ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">Published</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Unpublished</Badge>
                      )}
                    </td>
                    <td className="p-2">{renderStatus(id)}</td>
                  </tr>
                );
              })}

            </tbody>
          </table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
