import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Copy,
  Video,
  Image,
  Sparkles,
  User,
  RefreshCw,
  Server,
} from "lucide-react";
import { toast } from "sonner";
import type { JobDetailedStatus, PhaseProgress } from "@/hooks/useJobQueueManager";

interface JobStatusCardProps {
  job: JobDetailedStatus;
  onRefresh?: (jobId: string) => void;
}

interface PhaseRowProps {
  label: string;
  icon: React.ReactNode;
  progress: PhaseProgress | { status: 'pending' | 'processing' | 'completed' | 'failed' };
  isLlm?: boolean;
}

function PhaseRow({ label, icon, progress, isLlm }: PhaseRowProps) {
  if (isLlm) {
    const llmProgress = progress as { status: 'pending' | 'processing' | 'completed' | 'failed' };
    const statusConfig: Record<string, { icon: typeof Clock; color: string; bgColor: string; text: string; animate?: boolean }> = {
      pending: { icon: Clock, color: 'text-muted-foreground', bgColor: 'bg-muted', text: 'Waiting' },
      processing: { icon: Loader2, color: 'text-primary', bgColor: 'bg-primary/10', text: 'Processing', animate: true },
      completed: { icon: CheckCircle2, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', text: 'Done' },
      failed: { icon: XCircle, color: 'text-destructive', bgColor: 'bg-destructive/10', text: 'Failed' },
    };
    
    const config = statusConfig[llmProgress.status];
    const Icon = config.icon;
    
    return (
      <div className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{label}</span>
        </div>
        <Badge variant="secondary" className={`${config.bgColor} ${config.color} gap-1`}>
          <Icon className={`h-3 w-3 ${config.animate ? 'animate-spin' : ''}`} />
          {config.text}
        </Badge>
      </div>
    );
  }

  const phaseProgress = progress as PhaseProgress;
  const { total, completed, failed, inProgress = 0 } = phaseProgress;
  
  if (total === 0) {
    return (
      <div className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-xs text-muted-foreground">N/A</span>
      </div>
    );
  }

  const percentComplete = Math.round((completed / total) * 100);
  const isComplete = completed === total && failed === 0;
  const hasFailed = failed > 0;

  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-xs">
          <span className={isComplete ? 'text-emerald-500 font-medium' : 'text-muted-foreground'}>
            {completed}/{total}
          </span>
          {hasFailed && (
            <span className="text-destructive">({failed} failed)</span>
          )}
          {inProgress > 0 && (
            <span className="text-primary flex items-center gap-0.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              {inProgress}
            </span>
          )}
        </div>
        {isComplete ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : hasFailed ? (
          <XCircle className="h-4 w-4 text-destructive" />
        ) : (
          <div className="w-16">
            <Progress value={percentComplete} className="h-1.5" />
          </div>
        )}
      </div>
    </div>
  );
}

export function JobStatusCard({ job, onRefresh }: JobStatusCardProps) {
  const handleCopyJobId = () => {
    navigator.clipboard.writeText(job.externalJobId);
    toast.success('Job ID copied');
  };

  const statusColors = {
    queued: 'border-muted',
    active: 'border-primary',
    completed: 'border-emerald-500',
    failed: 'border-destructive',
  };

  return (
    <Card className={`${statusColors[job.status]} border-l-4`}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge 
              variant={job.status === 'active' ? 'default' : job.status === 'completed' ? 'secondary' : 'destructive'}
              className="gap-1"
            >
              {job.status === 'active' && <Loader2 className="h-3 w-3 animate-spin" />}
              {job.status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
              {job.status === 'failed' && <XCircle className="h-3 w-3" />}
              {job.status === 'queued' && <Clock className="h-3 w-3" />}
              {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
            </Badge>
            <span 
              className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded cursor-pointer hover:bg-muted/80"
              onClick={handleCopyJobId}
              title="Click to copy"
            >
              {job.externalJobId.slice(0, 12)}...
              <Copy className="h-3 w-3 inline ml-1 opacity-50" />
            </span>
            {job.serverIp && (
              <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded flex items-center gap-1 text-muted-foreground">
                <Server className="h-3 w-3" />
                {job.serverIp}
              </span>
            )}
          </div>
          {onRefresh && job.status === 'active' && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onRefresh(job.jobId)}
              className="h-6 w-6 p-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Overall Progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">{job.overallProgress}%</span>
          </div>
          <Progress value={job.overallProgress} className="h-2" />
          {job.currentStep && (
            <p className="text-xs text-muted-foreground truncate">
              {job.currentStep}
            </p>
          )}
        </div>

        {/* Phase Breakdown */}
        <div className="space-y-1 pt-2 border-t">
          <PhaseRow
            label="LLM Script"
            icon={<Sparkles className="h-4 w-4 text-violet-500" />}
            progress={job.llm}
            isLlm
          />
          <PhaseRow
            label="Manim"
            icon={<Video className="h-4 w-4 text-blue-500" />}
            progress={job.manim}
          />
          <PhaseRow
            label="WAN Video"
            icon={<Image className="h-4 w-4 text-amber-500" />}
            progress={job.wan}
          />
          <PhaseRow
            label="Avatar"
            icon={<User className="h-4 w-4 text-emerald-500" />}
            progress={job.avatar}
          />
        </div>

        {/* Error Message */}
        {job.error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
            {job.error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
