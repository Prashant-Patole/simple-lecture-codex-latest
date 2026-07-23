import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Activity,
  RefreshCw,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import {
  useRegenerationTasks,
  useDeleteRegenerationTask,
  useUpdateRegenerationTask,
  usePollTaskProgress,
  useCleanupStaleTasks,
  phaseLabels,
  getElapsedTime,
  getDuration,
  RegenerationTask,
} from '@/hooks/useRegenerationTasks';
import { useAvatarGenerationStatus, useRegenJobStatus } from '@/hooks/useVideoGenerationJobs';

interface RegenerationStatusPanelProps {
  externalJobId: string;
  onClose: () => void; serverIp?: string;
}

const statusConfig = {
  processing: {
    label: 'Processing',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400',
    icon: Loader2,
    iconClass: 'animate-spin',
  },
  completed: {
    label: 'Completed',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
    icon: CheckCircle2,
    iconClass: '',
  },
  failed: {
    label: 'Failed',
    color: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400',
    icon: XCircle,
    iconClass: '',
  },
};

// Individual task row component
function TaskRow({ task, externalJobId, serverIp }: { task: RegenerationTask; externalJobId: string; serverIp?: string }) {
  const deleteTask = useDeleteRegenerationTask();
  const updateTask = useUpdateRegenerationTask();
  
  // Poll for progress updates if task is processing
  usePollTaskProgress(task.status === 'processing' ? task : null, externalJobId, serverIp);
  
  const handleAbort = () => {
    updateTask.mutate({
      taskId: task.id,
      updates: {
        status: 'failed',
        message: 'Manually aborted by user',
        completed_at: new Date().toISOString(),
      },
    });
  };
  
  const config = statusConfig[task.status as keyof typeof statusConfig] || statusConfig.processing;
  const StatusIcon = config.icon;
  const sectionCount = task.section_ids?.length || 0;
  
  const handleDelete = () => {
    deleteTask.mutate({ taskId: task.id, externalJobId });
  };
  
  return (
    <div className="p-3 border rounded-lg bg-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-2">
          {/* Phase and status */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn("gap-1.5", config.color)}>
              <StatusIcon className={cn("h-3 w-3", config.iconClass)} />
              {phaseLabels[task.phase] || task.phase}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {task.status === 'completed' || task.status === 'failed'
                ? getDuration(task.started_at, task.completed_at)
                : getElapsedTime(task.started_at)}
            </span>
            {sectionCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {sectionCount} section{sectionCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          
          {/* Progress bar for processing tasks */}
          {task.status === 'processing' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{task.progress}%</span>
              </div>
              <Progress value={task.progress} className="h-2" />
            </div>
          )}
          
          {/* Message */}
          {task.message && (
            <p className="text-xs text-muted-foreground">{task.message}</p>
          )}
          
          {/* Completed message */}
          {task.status === 'completed' && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Completed - refresh Sanity Check to verify
            </p>
          )}
          
          {/* Failed message */}
          {task.status === 'failed' && (
            <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              {task.message || 'Task failed'}
            </p>
          )}
        </div>
        
        {/* Abort button for processing tasks */}
        {task.status === 'processing' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:text-amber-300 dark:hover:bg-amber-950/30"
            onClick={handleAbort}
            disabled={updateTask.isPending}
          >
            <X className="h-3 w-3 mr-1" />
            Abort
          </Button>
        )}
        
        {/* Delete button for completed/failed tasks */}
        {(task.status === 'completed' || task.status === 'failed') && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            disabled={deleteTask.isPending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function RegenerationStatusPanel({
  externalJobId,
  onClose, serverIp
}: RegenerationStatusPanelProps) {
  const queryClient = useQueryClient();
  
  // Fetch tasks from database
  const { data: tasks, isLoading, refetch } = useRegenerationTasks(externalJobId);
  
  // Cleanup stale tasks
  useCleanupStaleTasks(externalJobId);
  
  // Also poll external API for real-time status (as backup)
  const { data: avatarStatus } = useAvatarGenerationStatus(externalJobId, true, serverIp);
  const { data: jobStatus } = useRegenJobStatus(externalJobId, true, serverIp);

  const handleRefresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['sanity-check', externalJobId] });
    queryClient.invalidateQueries({ queryKey: ['avatar-regen-status', externalJobId] });
    queryClient.invalidateQueries({ queryKey: ['regen-job-status', externalJobId] });
  };

  const processingTasks = tasks?.filter(t => t.status === 'processing') || [];
  const completedTasks = tasks?.filter(t => t.status === 'completed') || [];
  const failedTasks = tasks?.filter(t => t.status === 'failed') || [];
  const hasAnyTasks = (tasks?.length || 0) > 0;

  return (
    <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Regeneration Status
            {processingTasks.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {processingTasks.length} active
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="py-3 px-4 space-y-3">
        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading tasks...</span>
          </div>
        )}
        
        {/* No tasks */}
        {!isLoading && !hasAnyTasks && (
          <div className="text-sm text-muted-foreground text-center py-4">
            No regeneration tasks. Start one using the Regen button.
          </div>
        )}
        
        {/* Processing tasks */}
        {processingTasks.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              In Progress ({processingTasks.length})
            </div>
            {processingTasks.map(task => (
              <TaskRow key={task.id} task={task} externalJobId={externalJobId} serverIp={serverIp} />
            ))}
          </div>
        )}
        
        {/* Completed tasks */}
        {completedTasks.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              Completed ({completedTasks.length})
            </div>
            {completedTasks.slice(0, 3).map(task => (
              <TaskRow key={task.id} task={task} externalJobId={externalJobId} serverIp={serverIp} />
            ))}
            {completedTasks.length > 3 && (
              <p className="text-xs text-muted-foreground text-center">
                +{completedTasks.length - 3} more completed tasks
              </p>
            )}
          </div>
        )}
        
        {/* Failed tasks */}
        {failedTasks.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              Failed ({failedTasks.length})
            </div>
            {failedTasks.slice(0, 2).map(task => (
              <TaskRow key={task.id} task={task} externalJobId={externalJobId} serverIp={serverIp} />
            ))}
          </div>
        )}
        
        {/* External API status (as additional context) */}
        {(avatarStatus?.state === 'processing' || jobStatus?.status === 'processing') && 
         processingTasks.length === 0 && (
          <Alert className="py-2 bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <AlertDescription className="text-xs text-blue-700 dark:text-blue-400">
              External processing detected. Progress: {avatarStatus?.progress || jobStatus?.progress || 0}%
              {(avatarStatus?.message || jobStatus?.status_message) && (
                <span className="block mt-1">{avatarStatus?.message || jobStatus?.status_message}</span>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
