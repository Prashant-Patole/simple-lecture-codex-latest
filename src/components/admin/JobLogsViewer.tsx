import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useJobLogs } from "@/hooks/useProcessingJobs";
import { format } from "date-fns";
import { AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";

interface JobLogsViewerProps {
  jobId: string | null;
}

export const JobLogsViewer = ({ jobId }: JobLogsViewerProps) => {
  const { data: logs, isLoading } = useJobLogs(jobId);

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'info':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'debug':
        return <Info className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getBadgeVariant = (level: string) => {
    switch (level) {
      case 'error':
        return 'destructive';
      case 'warning':
        return 'secondary';
      case 'info':
        return 'default';
      case 'debug':
        return 'outline';
      default:
        return 'outline';
    }
  };

  if (!jobId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Select a job to view logs
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No logs available for this job
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px] w-full border rounded-md p-4">
      <div className="space-y-3">
        {logs.map((log: any) => (
          <div
            key={log.id}
            className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="flex-shrink-0 mt-0.5">
              {getLogIcon(log.log_level)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={getBadgeVariant(log.log_level)}>
                  {log.log_level.toUpperCase()}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss')}
                </span>
              </div>
              
              <p className="text-sm font-medium">{log.message}</p>
              
              {log.details && (
                <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};