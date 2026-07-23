import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProcessingJobs, useJobStats, useRetryJob, useCancelJob } from "@/hooks/useProcessingJobs";
import { JobLogsViewer } from "@/components/admin/JobLogsViewer";
import { format } from "date-fns";
import { Activity, RefreshCw, X, Eye, AlertCircle } from "lucide-react";

const ProcessingJobsMonitor = () => {
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);

  const { data: jobs, isLoading } = useProcessingJobs({
    jobType: jobTypeFilter,
    status: statusFilter,
  });
  const { data: stats } = useJobStats();
  const retryMutation = useRetryJob();
  const cancelMutation = useCancelJob();

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string; color: string }> = {
      pending: { variant: 'secondary', label: '⏳ Pending', color: 'text-yellow-500' },
      running: { variant: 'default', label: '🔄 Running', color: 'text-blue-500' },
      completed: { variant: 'outline', label: '✅ Completed', color: 'text-green-500' },
      failed: { variant: 'destructive', label: '❌ Failed', color: 'text-red-500' },
      timeout: { variant: 'destructive', label: '⏱️ Timeout', color: 'text-orange-500' },
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getJobTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      mathpix_processing: '📄 Mathpix Processing',
      llm_extraction: '🤖 LLM Extraction',
      llm_verification: '✓ LLM Verification',
    };
    return labels[type] || type;
  };

  const handleViewLogs = (jobId: string) => {
    setSelectedJobId(jobId);
    setLogsDialogOpen(true);
  };

  const handleRetry = (jobId: string) => {
    if (confirm('Are you sure you want to retry this job?')) {
      retryMutation.mutate(jobId);
    }
  };

  const handleCancel = (jobId: string) => {
    if (confirm('Are you sure you want to cancel this job?')) {
      cancelMutation.mutate(jobId);
    }
  };

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8" />
            Document Processing Jobs Monitor
          </h1>
          <p className="text-muted-foreground mt-2">
            Track document parsing, extraction, and verification jobs in real-time
          </p>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-6 border rounded-lg bg-card">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-3xl font-bold text-yellow-500">{stats.pending}</p>
              </div>
            </div>
            <div className="p-6 border rounded-lg bg-card">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Running</p>
                <p className="text-3xl font-bold text-blue-500">{stats.running}</p>
              </div>
            </div>
            <div className="p-6 border rounded-lg bg-card">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-3xl font-bold text-green-500">{stats.completed}</p>
              </div>
            </div>
            <div className="p-6 border rounded-lg bg-card">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-3xl font-bold text-red-500">{stats.failed}</p>
              </div>
            </div>
            <div className="p-6 border rounded-lg bg-card">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="w-48">
                <label className="text-sm font-medium mb-2 block">Job Type</label>
                <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="mathpix_processing">Mathpix Processing</SelectItem>
                    <SelectItem value="llm_extraction">LLM Extraction</SelectItem>
                    <SelectItem value="llm_verification">LLM Verification</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-48">
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="running">Running</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="timeout">Timeout</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Jobs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Processing Jobs</CardTitle>
            <CardDescription>
              Real-time updates every 5 seconds
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : jobs && jobs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Job Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Current Step</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job: any) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">
                        {job.uploaded_question_documents?.file_name || 'Unknown'}
                      </TableCell>
                      <TableCell>{getJobTypeLabel(job.job_type)}</TableCell>
                      <TableCell>{getStatusBadge(job.status)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Progress value={job.progress_percentage} className="h-2 w-32" />
                          <span className="text-xs text-muted-foreground">
                            {job.progress_percentage}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {job.current_step || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(job.created_at), 'MMM dd, HH:mm')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewLogs(job.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(job.status === 'failed' || job.status === 'timeout') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRetry(job.id)}
                              disabled={job.retry_count >= job.max_retries}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                          {job.status === 'running' && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleCancel(job.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4" />
                <p>No jobs found matching the filters</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logs Dialog */}
        <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Job Logs</DialogTitle>
              <DialogDescription>
                Detailed step-by-step logs for job: {selectedJobId?.substring(0, 8)}
              </DialogDescription>
            </DialogHeader>
            <JobLogsViewer jobId={selectedJobId} />
          </DialogContent>
        </Dialog>
      </div>
  );
};

export default ProcessingJobsMonitor;