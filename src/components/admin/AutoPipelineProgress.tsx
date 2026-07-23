import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, Clock, Loader2, AlertTriangle, ArrowRight, Square, FileX, WifiOff, Wrench } from "lucide-react";
import type { ChapterProgress, PipelineJob, PipelineState } from "@/hooks/useAutoPipeline";

interface AutoPipelineProgressProps {
  pipelineState: PipelineState;
  chapters: ChapterProgress[];
  currentChapterIndex: number;
  activeIpSlots: Record<string, number>;
  onApproveChapter: () => void;
  onCancel: () => void;
  onReset: () => void;
}

const statusIcon = (status: PipelineJob['status']) => {
  switch (status) {
    case 'queued': return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    case 'submitting': return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />;
    case 'processing': return <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />;
    case 'sanity_checking': return <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin" />;
    case 'retrying': return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
    case 'done_good': return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    case 'done_bad': return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    case 'no_document': return <FileX className="h-3.5 w-3.5 text-orange-500" />;
    case 'already_done': return <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />;
    case 'needs_repair': return <Wrench className="h-3.5 w-3.5 text-amber-500 animate-spin" />;
  }
};

const statusLabel = (status: PipelineJob['status']) => {
  switch (status) {
    case 'queued': return 'Queued';
    case 'submitting': return 'Submitting';
    case 'processing': return 'Processing';
    case 'sanity_checking': return 'Sanity Check';
    case 'retrying': return 'Retrying';
    case 'done_good': return 'Done ✓';
    case 'done_bad': return 'Failed';
    case 'no_document': return 'No Doc';
    case 'already_done': return 'Already Done';
    case 'needs_repair': return 'Repairing';
  }
};

export function AutoPipelineProgress({
  pipelineState,
  chapters,
  currentChapterIndex,
  activeIpSlots,
  onApproveChapter,
  onCancel,
  onReset,
}: AutoPipelineProgressProps) {
  if (chapters.length === 0) {
    if (pipelineState === 'building_queue' || pipelineState === 'running') {
      return (
        <Card className="border-primary/20">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Building job queue...</p>
            <p className="text-xs text-muted-foreground">Scanning topics, documents, and existing jobs</p>
          </CardContent>
        </Card>
      );
    }
    return null;
  }

  const allJobs = chapters.flatMap(c => c.jobs);
  const totalJobs = allJobs.length;
  const doneJobs = allJobs.filter(j => ['done_good', 'done_bad', 'no_document', 'already_done'].includes(j.status)).length;
  const goodJobs = allJobs.filter(j => j.status === 'done_good').length;
  const badJobs = allJobs.filter(j => j.status === 'done_bad').length;
  const noDocJobs = allJobs.filter(j => j.status === 'no_document').length;
  const progressPct = totalJobs > 0 ? Math.round((doneJobs / totalJobs) * 100) : 0;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {pipelineState === 'running' && <Loader2 className="h-4 w-4 animate-spin" />}
            {pipelineState === 'paused_for_approval' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
            {pipelineState === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            {pipelineState === 'cancelled' && <Square className="h-4 w-4 text-destructive" />}
            {pipelineState === 'interrupted' && <WifiOff className="h-4 w-4 text-amber-500" />}
            Auto Pipeline
            {pipelineState === 'paused_for_approval' && (
              <Badge variant="outline" className="text-amber-600 border-amber-300">Waiting Approval</Badge>
            )}
            {pipelineState === 'interrupted' && (
              <Badge variant="outline" className="text-amber-600 border-amber-300">Tracking Lost</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {(pipelineState === 'completed' || pipelineState === 'cancelled' || pipelineState === 'interrupted') && (
              <Button size="sm" variant="outline" onClick={onReset}>
                {pipelineState === 'interrupted' ? 'Dismiss' : 'Reset'}
              </Button>
            )}
            {(pipelineState === 'running' || pipelineState === 'paused_for_approval') && (
              <Button size="sm" variant="destructive" onClick={onCancel}>Cancel</Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Interrupted banner */}
        {pipelineState === 'interrupted' && (
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-200">
            <p className="font-medium">Pipeline tracking was interrupted.</p>
            <p className="text-xs mt-1 opacity-80">Jobs may still be running on the servers. Check the Jobs table for current status.</p>
          </div>
        )}
        {/* Overall Progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{doneJobs}/{totalJobs} jobs</span>
            <div className="flex gap-3">
              <span className="text-green-600">✓ {goodJobs}</span>
              <span className="text-destructive">✕ {badJobs}</span>
              {noDocJobs > 0 && <span className="text-orange-500">⚠ {noDocJobs} no doc</span>}
            </div>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>

        {/* IP Slots */}
        {Object.keys(activeIpSlots).length > 0 && pipelineState === 'running' && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(activeIpSlots).map(([ip, count]) => (
              <Badge key={ip} variant="secondary" className="text-xs">
                {ip}: {count}/2 slots
              </Badge>
            ))}
          </div>
        )}

        {/* Chapter list */}
        <ScrollArea className="h-[60vh]">
          <div className="space-y-3">
            {chapters.map((chapter, idx) => (
              <div key={chapter.chapterId} className={`rounded-lg border p-3 ${idx === currentChapterIndex && pipelineState !== 'completed' ? 'border-primary/50 bg-primary/5' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">Ch {chapter.chapterNumber}</Badge>
                    <span className="text-sm font-medium truncate">{chapter.chapterName}</span>
                  </div>
                  {chapter.status === 'waiting_approval' && pipelineState === 'paused_for_approval' && idx === currentChapterIndex && (
                    <Button size="sm" onClick={onApproveChapter} className="gap-1">
                      <ArrowRight className="h-3.5 w-3.5" />
                      Continue to Next
                    </Button>
                  )}
                </div>
                
                <div className="space-y-1">
                  {chapter.jobs.map(job => (
                    <div key={job.id} className="flex items-center gap-2 text-xs py-0.5">
                      {statusIcon(job.status)}
                      <span className="flex-1 truncate">
                        T{job.topicNumber}: {job.topicName}
                      </span>
                      <span className="text-muted-foreground">{statusLabel(job.status)}</span>
                      {job.retryCount > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">R{job.retryCount}</Badge>
                      )}
                      {job.serverIp && (
                        <span className="text-[10px] text-muted-foreground">{job.serverIp.split('.').slice(-1)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
