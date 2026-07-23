import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAllPipelineRuns, PipelineRunSummary } from "@/hooks/useAllPipelineRuns";
import { Activity, CheckCircle, XCircle, Clock, Trash2, Play, Eye, AlertTriangle, RefreshCw, Rocket } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  running: { label: "Running", variant: "default", icon: <Activity className="h-3 w-3 animate-pulse" /> },
  scanning: { label: "Scanning", variant: "secondary", icon: <RefreshCw className="h-3 w-3 animate-spin" /> },
  scan_complete: { label: "Scan Complete", variant: "outline", icon: <Eye className="h-3 w-3" /> },
  building_queue: { label: "Building Queue", variant: "secondary", icon: <Clock className="h-3 w-3" /> },
  paused_for_approval: { label: "Awaiting Approval", variant: "destructive", icon: <AlertTriangle className="h-3 w-3" /> },
  interrupted: { label: "Interrupted", variant: "destructive", icon: <AlertTriangle className="h-3 w-3" /> },
  completed: { label: "Completed", variant: "default", icon: <CheckCircle className="h-3 w-3" /> },
  cancelled: { label: "Cancelled", variant: "secondary", icon: <XCircle className="h-3 w-3" /> },
};

function RunCard({ run, onCancel, onApprove }: { run: PipelineRunSummary; onCancel: (id: string) => void; onApprove: (id: string) => void }) {
  const navigate = useNavigate();
  const progress = run.totalJobs > 0 ? Math.round((run.completedJobs / run.totalJobs) * 100) : 0;
  const config = statusConfig[run.status] || statusConfig.running;

  return (
    <Card className="border-l-4" style={{ borderLeftColor: run.status === 'running' ? 'hsl(var(--primary))' : run.status === 'paused_for_approval' ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))' }}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">{run.subjectName}</h3>
            <p className="text-xs text-muted-foreground">
              Started {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
              {run.updatedAt && ` · Updated ${formatDistanceToNow(new Date(run.updatedAt), { addSuffix: true })}`}
            </p>
          </div>
          <Badge variant={config.variant} className="gap-1 text-xs">
            {config.icon}
            {config.label}
          </Badge>
        </div>

        {run.totalJobs > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress: {run.completedJobs}/{run.totalJobs} jobs</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex gap-3 text-xs">
              <span className="text-green-600">✓ {run.goodJobs} good</span>
              <span className="text-red-600">✗ {run.badJobs} bad</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          {run.status === 'paused_for_approval' && (
            <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => onApprove(run.id)}>
              <Play className="h-3 w-3" /> Approve & Continue
            </Button>
          )}
          {['running', 'scanning', 'building_queue', 'paused_for_approval', 'interrupted'].includes(run.status) && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive" onClick={() => onCancel(run.id)}>
              <XCircle className="h-3 w-3" /> Cancel
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 ml-auto"
            onClick={() => {
              // Navigate to the subject's popular subjects page
              navigate(`/admin/popular-subjects`);
            }}
          >
            <Eye className="h-3 w-3" /> View Subject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PipelineMonitorPage() {
  const { activeRuns, recentRuns, isLoading, cancelRun, approveChapter, cleanupStaleRuns } = useAllPipelineRuns();

  const handleCancel = async (id: string) => {
    await cancelRun(id);
    toast.success("Pipeline run cancelled");
  };

  const handleApprove = async (id: string) => {
    await approveChapter(id);
    toast.success("Chapter approved, pipeline resuming");
  };

  const handleCleanup = async () => {
    await cleanupStaleRuns();
    toast.success("Stale runs cleaned up");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Rocket className="h-6 w-6" />
            Pipeline Monitor
          </h1>
          <p className="text-sm text-muted-foreground">Track all pipeline runs across subjects</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleCleanup}>
          <Trash2 className="h-4 w-4" />
          Clean Up Stale
        </Button>
      </div>

      {/* Active Runs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Active Runs
            {activeRuns.length > 0 && (
              <Badge variant="default" className="ml-2">{activeRuns.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>Currently running or awaiting action</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
          ) : activeRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No active pipeline runs</p>
          ) : (
            <div className="space-y-3">
              {activeRuns.map(run => (
                <RunCard key={run.id} run={run} onCancel={handleCancel} onApprove={handleApprove} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Runs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Runs (Last 7 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No recent runs</p>
          ) : (
            <div className="space-y-2">
              {recentRuns.map(run => {
                const config = statusConfig[run.status] || statusConfig.completed;
                return (
                  <div key={run.id} className="flex items-center justify-between p-3 rounded-md border bg-muted/20">
                    <div className="flex items-center gap-3">
                      <Badge variant={config.variant} className="gap-1 text-xs">
                        {config.icon}
                        {config.label}
                      </Badge>
                      <span className="text-sm font-medium">{run.subjectName}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-green-600">✓ {run.goodJobs}</span>
                      <span className="text-red-600">✗ {run.badJobs}</span>
                      <span className="text-muted-foreground">{run.completedJobs}/{run.totalJobs}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
