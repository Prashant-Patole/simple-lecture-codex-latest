import { useState } from 'react';
import { MoreHorizontal, RefreshCw, Play, Eye, ClipboardCheck, Globe, Upload, XCircle, Loader2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { VideoJobWithDocument } from '@/hooks/useVideoGenerationJobs';

interface JobActionsMenuProps {
  job: VideoJobWithDocument;
  checkingJobId: string | null;
  unpublishPending: boolean;
  onCheckStatus: (externalJobId: string, jobId: string) => void;
  onWatch: (externalJobId: string, documentName: string, serverIp?: string) => void;
  onReview: (externalJobId: string, documentName: string, serverIp?: string) => void;
  onSanityCheck: (externalJobId: string, documentName: string, serverIp?: string) => void;
  onLanguages: (externalJobId: string, videoJobId: string, documentName: string, serverIp?: string) => void;
  onPublish: (job: VideoJobWithDocument) => void;
  onUnpublish: (jobId: string) => void;
  onSelectForDemo?: (job: VideoJobWithDocument) => void;
  isAlreadyPublished: (job: VideoJobWithDocument) => boolean;
}

export function JobActionsMenu({
  job,
  checkingJobId,
  unpublishPending,
  onCheckStatus,
  onWatch,
  onReview,
  onSanityCheck,
  onLanguages,
  onPublish,
  onUnpublish,
  onSelectForDemo,
  isAlreadyPublished,
}: JobActionsMenuProps) {
  const [open, setOpen] = useState(false);
  
  const documentName = job.document_name || 'Unknown Document';
  const hasExternalJobId = !!job.external_job_id;
  
  // More robust "completed" check - treat as completed if any of these are true:
  // 1. status is 'completed'
  // 2. progress is 100
  // 3. video_url exists
  const isCompleted = job.status === 'completed' || job.progress === 100 || !!job.video_url;
  const isProcessingOrPending = job.status === 'processing' || job.status === 'pending';
  const published = isAlreadyPublished(job);
  const hasLinkedContent = !!(job.ai_assistant_documents?.topic_id || job.ai_assistant_documents?.chapter_id);

  // Check if there are any actions available
  const hasAnyAction = hasExternalJobId || (isCompleted && hasExternalJobId);
  
  if (!hasAnyAction) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const handleAction = (action: () => void) => {
    action();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-primary hover:text-primary/80 -ml-2"
        >
          <MoreHorizontal className="h-4 w-4" />
          More
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-1">
        <div className="flex flex-col">
          {/* Status Management */}
          {isProcessingOrPending && hasExternalJobId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleAction(() => onCheckStatus(job.external_job_id!, job.id))}
              disabled={checkingJobId === job.id}
              className="justify-start gap-2 h-9"
            >
              {checkingJobId === job.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Check Status
            </Button>
          )}

          {/* Watch Video */}
          {isCompleted && hasExternalJobId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleAction(() => onWatch(job.external_job_id!, documentName, job.server_ip || undefined))}
              className="justify-start gap-2 h-9"
            >
              <Play className="h-4 w-4" />
              Watch
            </Button>
          )}

          {/* Review */}
          {isCompleted && hasExternalJobId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleAction(() => onReview(job.external_job_id!, documentName, job.server_ip || undefined))}
              className="justify-start gap-2 h-9 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 dark:text-amber-400 dark:hover:text-amber-300"
            >
              <Eye className="h-4 w-4" />
              Review
            </Button>
          )}

          {/* Sanity Check */}
          {hasExternalJobId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleAction(() => onSanityCheck(job.external_job_id!, documentName, job.server_ip || undefined))}
              className="justify-start gap-2 h-9 text-cyan-600 hover:text-cyan-700 hover:bg-cyan-500/10 dark:text-cyan-400 dark:hover:text-cyan-300"
            >
              <ClipboardCheck className="h-4 w-4" />
              Sanity
            </Button>
          )}

          {/* Languages */}
          {isCompleted && hasExternalJobId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleAction(() => onLanguages(job.external_job_id!, job.id, documentName, job.server_ip || undefined))}
              className="justify-start gap-2 h-9 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-500/10 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              <Globe className="h-4 w-4" />
              Languages
            </Button>
          )}

          {/* Publish/Update */}
          {isCompleted && hasExternalJobId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleAction(() => onPublish(job))}
              disabled={!hasLinkedContent}
              className={`justify-start gap-2 h-9 disabled:opacity-50 ${
                published
                  ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400 dark:hover:text-emerald-300"
                  : "text-violet-600 hover:text-violet-700 hover:bg-violet-500/10 dark:text-violet-400 dark:hover:text-violet-300"
              }`}
              title={!hasLinkedContent ? "No chapter/topic linked" : undefined}
            >
              {published ? (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Update
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Publish
                </>
              )}
            </Button>
          )}

          {/* Unpublish */}
          {isCompleted && published && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleAction(() => onUnpublish(job.id))}
              disabled={unpublishPending}
              className="justify-start gap-2 h-9 text-red-600 hover:text-red-700 hover:bg-red-500/10 dark:text-red-400 dark:hover:text-red-300"
            >
              {unpublishPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Unpublish
            </Button>
          )}

          {/* Select for Demo */}
          {isCompleted && hasExternalJobId && onSelectForDemo && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleAction(() => onSelectForDemo(job))}
              className="justify-start gap-2 h-9 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 dark:text-amber-400 dark:hover:text-amber-300"
            >
              <Star className="h-4 w-4" />
              Select for Demo
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
