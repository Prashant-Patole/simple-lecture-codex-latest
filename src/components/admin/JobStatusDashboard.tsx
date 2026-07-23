import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Activity,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
  Server,
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { JobStatusCard } from "./JobStatusCard";
import { useJobQueueManager, type JobDetailedStatus } from "@/hooks/useJobQueueManager";

interface JobStatusDashboardProps {
  className?: string;
  subjectId?: string;
}

export function JobStatusDashboard({ className, subjectId }: JobStatusDashboardProps) {
  const [queueOpen, setQueueOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);

  const {
    activeJobs,
    queuedJobs,
    completedJobs,
    activeCount,
    queuedCount,
    maxConcurrent,
    removeFromQueue,
    refreshJob,
  } = useJobQueueManager(subjectId);

  const hasActiveJobs = activeCount > 0;
  const hasQueuedJobs = queuedCount > 0;
  const hasCompletedJobs = completedJobs.length > 0;

  if (!hasActiveJobs && !hasQueuedJobs && !hasCompletedJobs) {
    return null; // Don't show dashboard if nothing to display
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-primary" />
            Job Queue Manager
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={activeCount >= maxConcurrent ? "default" : "secondary"} className="gap-1">
              <Loader2 className={`h-3 w-3 ${activeCount > 0 ? 'animate-spin' : ''}`} />
              {activeCount}/{maxConcurrent} Active
            </Badge>
            {hasQueuedJobs && (
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                {queuedCount} Queued
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Active Jobs Section */}
        {hasActiveJobs && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Active Jobs</h4>
            <div className="grid gap-3 md:grid-cols-2">
              {activeJobs.map((job) => (
                <JobStatusCard 
                  key={job.jobId} 
                  job={job} 
                  onRefresh={refreshJob}
                />
              ))}
            </div>
          </div>
        )}

        {/* Queued Jobs Section */}
        {hasQueuedJobs && (
          <Collapsible open={queueOpen} onOpenChange={setQueueOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between h-auto py-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Queue ({queuedCount} waiting)</span>
                </div>
                {queueOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {queuedJobs.map((job) => (
                    <div 
                      key={job.id}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs">
                          #{job.position}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium truncate max-w-[200px]">
                            {job.documentName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Queued {format(job.queuedAt, 'HH:mm:ss')}
                          </p>
                          {job.serverIp && (
                            <p className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                              <Server className="h-3 w-3" />
                              {job.serverIp}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromQueue(job.id)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Jobs will auto-start when capacity frees up
              </p>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Recently Completed Section */}
        {hasCompletedJobs && (
          <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between h-auto py-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium">Recently Completed ({completedJobs.length})</span>
                </div>
                {completedOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {completedJobs.map((job) => (
                    <div 
                      key={job.jobId}
                      className={`flex items-center justify-between p-2 rounded-lg ${
                        job.status === 'completed' 
                          ? 'bg-emerald-50 dark:bg-emerald-950/20' 
                          : 'bg-destructive/10'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {job.status === 'completed' ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <X className="h-4 w-4 text-destructive" />
                        )}
                        <span className="font-mono text-xs">
                          {job.externalJobId.slice(0, 12)}...
                        </span>
                        {job.serverIp && (
                          <span className="font-mono text-xs text-muted-foreground flex items-center gap-0.5">
                            <Server className="h-3 w-3" />
                            {job.serverIp}
                          </span>
                        )}
                      </div>
                      <Badge variant={job.status === 'completed' ? 'secondary' : 'destructive'}>
                        {job.status === 'completed' ? 'Done' : 'Failed'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
