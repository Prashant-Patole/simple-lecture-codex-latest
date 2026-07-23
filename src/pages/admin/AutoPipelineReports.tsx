import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle2, XCircle, Clock, Trash2, ChevronDown, FileX, Server, AlertTriangle, ExternalLink } from "lucide-react";
import { useAutoPipelineReports, useDeletePipelineReport, type AutoPipelineReport } from "@/hooks/useAutoPipelineReports";
import { format } from "date-fns";
import { toast } from "sonner";

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function ReportCard({ report, onDelete }: { report: AutoPipelineReport; onDelete: (id: string) => void }) {
  const isGood = report.category === 'good';
  const sanity = report.sanity_summary as Record<string, number> | null;

  return (
    <Card className={`border-l-4 ${isGood ? 'border-l-green-500' : 'border-l-destructive'}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {isGood ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
            <span className="font-medium text-sm">{report.topic_name || 'Unknown Topic'}</span>
            <Badge variant={isGood ? 'default' : 'destructive'} className="text-xs">
              {report.status}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onDelete(report.id)} className="h-7 w-7 p-0">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground block">Subject</span>
            <span className="font-medium">{report.subject_name}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Chapter</span>
            <span className="font-medium">Ch {report.chapter_number}: {report.chapter_name || '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Topic</span>
            <span className="font-medium">T{report.topic_number}: {report.topic_name || '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Job ID</span>
            {report.external_job_id ? (
              <span className="font-mono font-medium">{report.external_job_id}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <Server className="h-3 w-3 text-muted-foreground" />
            <span>{report.server_ip || '—'}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span>{formatDuration(report.duration_seconds)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Submitted: </span>
            <span>{report.submitted_at ? format(new Date(report.submitted_at), 'MMM d, HH:mm') : '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Completed: </span>
            <span>{report.completed_at ? format(new Date(report.completed_at), 'MMM d, HH:mm') : '—'}</span>
          </div>
        </div>

        {/* Sanity Summary */}
        {sanity && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-xs">
              Avatar: {sanity.avatar_healthy ?? 0}/{sanity.avatar_total ?? 0}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Video: {sanity.topic_healthy ?? 0}/{sanity.topic_total ?? 0}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Images: {sanity.images_healthy ?? 0}/{sanity.images_total ?? 0}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Total: {sanity.total_sections ?? 0} sections
            </Badge>
          </div>
        )}

        {/* No Document Flag */}
        {report.status === 'no_document' && (
          <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 dark:bg-orange-950/20 p-2 rounded">
            <FileX className="h-3.5 w-3.5" />
            No document uploaded for this topic
          </div>
        )}

        {/* Error Details (Bad reports) */}
        {!isGood && report.error_message && (
          <div className="text-xs text-destructive bg-destructive/5 p-2 rounded">
            <span className="font-medium">Error: </span>{report.error_message}
          </div>
        )}

        {!isGood && report.problem_description && (
          <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
            {report.problem_description}
          </div>
        )}

        {/* Failed Phases */}
        {report.failed_phases && report.failed_phases.length > 0 && (
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs">Failed phases: {report.failed_phases.join(', ')}</span>
          </div>
        )}

        {/* Retry Details */}
        {report.retry_count > 0 && report.retry_details && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ChevronDown className="h-3 w-3" />
              {report.retry_count} retry attempt(s)
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1">
              <div className="space-y-1 pl-4 border-l-2 border-muted">
                {(report.retry_details as Array<{ phase: string; attempt: number; error: string; timestamp: string }>).map((detail, idx) => (
                  <div key={idx} className="text-xs text-muted-foreground">
                    <span className="font-medium">Attempt {detail.attempt}</span> — {detail.phase}
                    {detail.error && <span className="text-destructive ml-1">({detail.error})</span>}
                    <span className="ml-1">{format(new Date(detail.timestamp), 'HH:mm:ss')}</span>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* View Video Link (for good reports) */}
        {isGood && report.external_job_id && report.server_ip && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1"
            onClick={() => window.open(`http://${report.server_ip}:5005/player_v2/?job=${report.external_job_id}`, '_blank')}
          >
            <ExternalLink className="h-3 w-3" />
            View Video
          </Button>
        )}

        <div className="text-[10px] text-muted-foreground">
          Created: {format(new Date(report.created_at), 'MMM d, yyyy HH:mm')}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AutoPipelineReports() {
  const [tab, setTab] = useState<'bad' | 'good'>('bad');
  const { data: reports = [], isLoading } = useAutoPipelineReports(tab);
  const deleteMutation = useDeletePipelineReport();

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success('Report deleted'),
      onError: () => toast.error('Failed to delete report'),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pipeline Reports</h1>
        <p className="text-muted-foreground text-sm">Review auto pipeline job results — Good (successful) and Bad (failed) reports.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'bad' | 'good')}>
        <TabsList>
          <TabsTrigger value="bad" className="gap-1">
            <XCircle className="h-3.5 w-3.5" />
            Bad
          </TabsTrigger>
          <TabsTrigger value="good" className="gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Good
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">Loading reports...</div>
          ) : reports.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No {tab} reports yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {reports.map(report => (
                <ReportCard key={report.id} report={report} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
