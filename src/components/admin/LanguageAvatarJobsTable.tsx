import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  Copy,
} from 'lucide-react';
import {
  LanguageAvatarJob,
  SUPPORTED_LANGUAGES,
  SUPPORTED_VOICES,
} from '@/hooks/useLanguageAvatarJobs';

// Pre-build lookup Maps for O(1) lookups instead of O(n) array.find
const LANGUAGE_MAP: Map<string, typeof SUPPORTED_LANGUAGES[number]> = new Map(SUPPORTED_LANGUAGES.map(l => [l.code, l]));
const VOICE_MAP: Map<string, typeof SUPPORTED_VOICES[number]> = new Map(SUPPORTED_VOICES.map(v => [v.id, v]));

// Helper to compute the correct Chatterbox output URL
// Always uses `final_` prefix regardless of what's stored in DB
const getViewUrl = (job: LanguageAvatarJob): string | null => {
  if (job.task_id) {
    const serverIp = job.server_ip || '69.197.145.4';
    return `http://${serverIp}:5004/outputs/final_${job.task_id}.mp4`;
  }
  return job.avatar_url || null;
};

// O(1) lookup functions
const getLanguageName = (code: string): string => {
  const lang = LANGUAGE_MAP.get(code);
  return lang ? `${lang.flag} ${lang.name}` : code;
};

const getVoiceName = (id: string): string => {
  const voice = VOICE_MAP.get(id);
  return voice ? voice.name : id;
};

interface LanguageAvatarJobsTableProps {
  jobs: LanguageAvatarJob[];
  onRetry?: (job: LanguageAvatarJob) => void;
  isRetrying?: boolean;
}

export function LanguageAvatarJobsTable({
  jobs,
  onRetry,
  isRetrying,
}: LanguageAvatarJobsTableProps) {

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="default" className="gap-1 bg-primary">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="default" className="gap-1 bg-emerald-500">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const copyTaskId = (taskId: string) => {
    navigator.clipboard.writeText(taskId);
    toast.success('Task ID copied');
  };

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-24 text-muted-foreground">
        <p className="text-sm">No language avatar jobs yet</p>
        <p className="text-xs">Select a language and click Generate to start</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Sec</TableHead>
          <TableHead>Language</TableHead>
          <TableHead>Voice</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="min-w-[200px]">Progress</TableHead>
          <TableHead>Task ID</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((job) => (
          <TableRow key={job.id}>
            <TableCell className="font-mono text-sm">{job.section_id}</TableCell>
            <TableCell>{getLanguageName(job.language)}</TableCell>
            <TableCell>{getVoiceName(job.speaker)}</TableCell>
            <TableCell>
              <div className="space-y-1">
                {getStatusBadge(job.status)}
                {job.error_message && (
                  <p className="text-xs text-destructive truncate max-w-[150px]" title={job.error_message}>
                    {job.error_message}
                  </p>
                )}
              </div>
            </TableCell>
            <TableCell>
              {job.status === 'processing' ? (
                <span className="text-xs font-medium text-primary">
                  {job.error_message || 'Processing...'}
                </span>
              ) : job.status === 'completed' ? (
                <span className="text-xs font-medium text-green-600 dark:text-green-400">
                  {job.error_message || 'Completed'}
                </span>
              ) : job.status === 'failed' ? (
                <span className="text-xs text-destructive truncate max-w-[180px]" title={job.error_message || ''}>
                  {job.error_message?.slice(0, 40) || 'Failed'}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Waiting...</span>
              )}
            </TableCell>
            <TableCell>
              {job.task_id ? (
                <button
                  onClick={() => copyTaskId(job.task_id!)}
                  className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded cursor-pointer hover:bg-muted/80 transition-colors flex items-center gap-1"
                  title={`Click to copy: ${job.task_id}`}
                >
                  {job.task_id.slice(0, 8)}...
                  <Copy className="h-3 w-3" />
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {job.created_at ? format(new Date(job.created_at), 'MMM dd, HH:mm') : '-'}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                {job.status === 'failed' && onRetry && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRetry(job)}
                    disabled={isRetrying}
                    className="h-7 gap-1"
                    title="Retry generation"
                  >
                    {isRetrying ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Retry
                  </Button>
                )}
                {job.status === 'completed' && (job.task_id || job.avatar_url) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const url = getViewUrl(job);
                      if (url) window.open(url, '_blank');
                    }}
                    className="h-7 gap-1"
                    title="View avatar video"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
