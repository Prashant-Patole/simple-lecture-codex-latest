import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Video,
  AlertCircle,
  Upload,
  Search,
} from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { JobActionsMenu } from './JobActionsMenu';
import { useSubjectChapters, useChapterTopics } from '@/hooks/useSubjectManagement';
import {
  useVideoGenerationJobsInfinite,
  useVideoJobStats,
  useCheckVideoJobStatus,
  useGenerateAvatar,
  useAvatarStatus,
  usePublishVideoToStudents,
  useUnpublishVideo,
  useAutoSyncJobStatuses,
  VideoJobWithDocument,
} from '@/hooks/useVideoGenerationJobs';
import { VideoReviewDialog } from './VideoReviewDialog';
import { SanityCheckDialog } from './SanityCheckDialog';
import { EducationalVideoPlayerDialog } from '@/components/learning/player';
import { MultiLanguageAvatarDialog } from './MultiLanguageAvatarDialog';
import { JobStatusDashboard } from './JobStatusDashboard';
import { SelectDemoCourseDialog } from './SelectDemoCourseDialog';


interface VideoJobsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectId: string;
  subjectName: string;
  serverIp?: string;
}

interface AvatarStatusDisplayProps {
  externalJobId: string;
  onComplete?: () => void;
  onError?: (errorMessage: string) => void;
}

function AvatarStatusDisplay({ externalJobId, onComplete, onError }: AvatarStatusDisplayProps) {
  const { data: avatarStatus, isLoading, isError } = useAvatarStatus(externalJobId);
  
  // API returns 'state' field, normalize to 'status'
  const status = avatarStatus?.status || avatarStatus?.state;
  const httpStatus = avatarStatus?.http_status;
  
  // Check if it's an error state
  const isErrorState = isError || 
    status === 'not_found' || 
    status === 'failed' || 
    (httpStatus && httpStatus >= 400);
  
  useEffect(() => {
    if (status === 'completed' && onComplete) {
      onComplete();
    }
    // Call onError when there's an error state
    if (isErrorState && onError) {
      const errorMsg = avatarStatus?.error || avatarStatus?.message || 'Generation failed';
      onError(errorMsg);
    }
  }, [status, isErrorState, onComplete, onError, avatarStatus]);
  
  if (isLoading) {
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking...
      </span>
    );
  }
  
  if (!avatarStatus) return null;
  
  const getStatusDisplay = () => {
    // Check for HTTP error first
    if (httpStatus && httpStatus >= 400) {
      return { icon: XCircle, text: avatarStatus.error || avatarStatus.message || `Error (${httpStatus})`, color: 'text-destructive', animate: false };
    }
    
    switch (status) {
      case 'pending':
        return { icon: Clock, text: 'Pending...', color: 'text-amber-600 dark:text-amber-400', animate: false };
      case 'processing':
        return { icon: Loader2, text: avatarStatus.current_step || 'Processing...', color: 'text-primary', animate: true };
      case 'completed':
        return { icon: CheckCircle2, text: 'Avatar Ready!', color: 'text-emerald-600 dark:text-emerald-400', animate: false };
      case 'failed':
        return { icon: XCircle, text: avatarStatus.error || avatarStatus.message || 'Generation Failed', color: 'text-destructive', animate: false };
      case 'not_found':
        return { icon: XCircle, text: avatarStatus.error || avatarStatus.message || 'Not Found - Retry', color: 'text-destructive', animate: false };
      default:
        return { icon: Loader2, text: 'Generating...', color: 'text-muted-foreground', animate: true };
    }
  };
  
  const { icon: Icon, text, color, animate } = getStatusDisplay();
  
  return (
    <span className={`text-xs flex items-center gap-1 ${color}`}>
      <Icon className={`h-3 w-3 ${animate ? 'animate-spin' : ''}`} />
      <span className="max-w-[120px] truncate">{text}</span>
      {avatarStatus.progress !== undefined && avatarStatus.progress > 0 && (
        <span>({avatarStatus.progress}%)</span>
      )}
    </span>
  );
}

export function VideoJobsDialog({
  open,
  onOpenChange,
  subjectId,
  subjectName,
  serverIp,
}: VideoJobsDialogProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [chapterFilter, setChapterFilter] = useState<string>('all');
  const [topicFilter, setTopicFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [checkingJobId, setCheckingJobId] = useState<string | null>(null);
  const [generatingAvatarJobId, setGeneratingAvatarJobId] = useState<string | null>(null);
  const [avatarJobsInProgress, setAvatarJobsInProgress] = useState<Set<string>>(new Set());
  const [avatarJobErrors, setAvatarJobErrors] = useState<Map<string, string>>(new Map());
  const [reviewingJob, setReviewingJob] = useState<{
    externalJobId: string;
    documentName: string;
    serverIp?: string;
  } | null>(null);
  const [watchingJob, setWatchingJob] = useState<{
    externalJobId: string;
    documentName: string;
    serverIp?: string;
  } | null>(null);
  const [sanityCheckJob, setSanityCheckJob] = useState<{
    externalJobId: string;
    documentName: string;
    serverIp?: string;
  } | null>(null);
  const [publishingJob, setPublishingJob] = useState<{
    jobId: string;
    externalJobId: string;
    videoUrl: string;
    topicId?: string | null;
    chapterId?: string | null;
    topicTitle?: string;
    chapterTitle?: string;
    isUpdate?: boolean;
    serverIp?: string;
  } | null>(null);
  const [languageDialogJob, setLanguageDialogJob] = useState<{
    externalJobId: string;
    videoJobId: string;
    documentName: string;
    serverIp?: string;
  } | null>(null);
  const [demoJob, setDemoJob] = useState<VideoJobWithDocument | null>(null);
  

  // Helper to check if job is already published - now checks the job's own is_published field
  const isAlreadyPublished = (job: VideoJobWithDocument): boolean => {
    // Cast to any since is_published is newly added and types may not be updated yet
    return (job as any).is_published === true;
  };

  const { 
    data: jobsData, 
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useVideoGenerationJobsInfinite({
    subjectId,
    status: statusFilter,
    chapterId: chapterFilter,
    topicId: topicFilter,
    searchQuery: debouncedSearch,
  });
  
  // Flatten paginated data
  const jobs = jobsData?.pages.flatMap(page => page.items) || [];
  
  const { data: stats } = useVideoJobStats(subjectId);
  const checkStatusMutation = useCheckVideoJobStatus();
  const generateAvatarMutation = useGenerateAvatar();
  const publishMutation = usePublishVideoToStudents();
  const unpublishMutation = useUnpublishVideo();
  
  // Auto-sync job statuses from external API
  useAutoSyncJobStatuses(jobs);

  // Chapter & Topic filter data
  const { data: chapters } = useSubjectChapters(subjectId);
  const { data: topics } = useChapterTopics(chapterFilter !== 'all' ? chapterFilter : undefined);

  // Handle chapter change: reset topic
  const handleChapterFilterChange = (value: string) => {
    setChapterFilter(value);
    setTopicFilter('all');
  };

  // Jobs are now filtered server-side via the hook

  const handleUnpublish = async (jobId: string) => {
    await unpublishMutation.mutateAsync(jobId);
  };

  const handleCheckStatus = async (externalJobId: string, jobId: string) => {
    setCheckingJobId(jobId);
    try {
      // Find the job to get server_ip
      const job = jobs.find(j => j.id === jobId);
      await checkStatusMutation.mutateAsync({ externalJobId, jobId, serverIp: job?.server_ip || undefined, targetPort: (job as any)?.target_port ?? undefined });
    } finally {
      setCheckingJobId(null);
    }
  };

  const handleConfirmPublish = async () => {
    if (!publishingJob) return;
    
    await publishMutation.mutateAsync({
      videoUrl: publishingJob.videoUrl,
      topicId: publishingJob.topicId,
      chapterId: publishingJob.chapterId,
      jobId: publishingJob.jobId,
      externalJobId: publishingJob.externalJobId,
      serverIp: publishingJob.serverIp,
    });
    
    setPublishingJob(null);
  };

  const handleGenerateAvatar = async (externalJobId: string) => {
    // Clear any existing error for this job when retrying
    setAvatarJobErrors(prev => {
      const next = new Map(prev);
      next.delete(externalJobId);
      return next;
    });
    
    setGeneratingAvatarJobId(externalJobId);
    try {
      await generateAvatarMutation.mutateAsync(externalJobId);
      // Add to in-progress set after successful trigger
      setAvatarJobsInProgress(prev => new Set(prev).add(externalJobId));
    } finally {
      setGeneratingAvatarJobId(null);
    }
  };

  const getPlayerUrl = (job: { video_url?: string | null; external_job_id?: string | null }) => {
    if (job.video_url) return job.video_url;
    if (job.external_job_id) {
      return `http://${(job as any).server_ip || '69.197.145.4'}:5005/player_v2/?job=${job.external_job_id}`;
    }
    return null;
  };

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
          <Badge variant="default" className="gap-1 bg-blue-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="default" className="gap-1 bg-green-500">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </Badge>
        );
      case 'completed_with_errors':
        return (
          <Badge variant="default" className="gap-1 bg-amber-500">
            <AlertCircle className="h-3 w-3" />
            Completed (Errors)
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

  const statCards = [
    { label: 'Pending', value: stats?.pending || 0, color: 'text-yellow-600', bgColor: 'bg-yellow-50 dark:bg-yellow-950/30' },
    { label: 'Processing', value: stats?.processing || 0, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30' },
    { label: 'Completed', value: stats?.completed || 0, color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-950/30' },
    { label: 'Failed', value: stats?.failed || 0, color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-950/30' },
    { label: 'Total', value: stats?.total || 0, color: 'text-foreground', bgColor: 'bg-muted' },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-screen max-w-none sm:max-w-none h-screen p-0 overflow-hidden flex flex-col">
        <div className="flex h-full flex-col p-6 overflow-hidden">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Video Generation Jobs
          </SheetTitle>
          <SheetDescription>
            Track all video generation jobs for {subjectName}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 mt-4">
          <ScrollArea className="h-full" type="auto">
            <div className="flex flex-col gap-4 pr-4 pb-4">
              {/* Real-time Job Status Dashboard */}
              <JobStatusDashboard className="mb-2" subjectId={subjectId} />

              {/* Stats Cards */}
              <div className="grid grid-cols-5 gap-2">
                {statCards.map((stat) => (
                  <Card key={stat.label} className={`${stat.bgColor} border-0`}>
                    <CardContent className="p-3 text-center">
                      <div className={`text-2xl font-bold ${stat.color}`}>
                        {stat.value}
                      </div>
                      <div className="text-xs text-muted-foreground">{stat.label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Filter:</span>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or job ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-[220px] h-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="completed_with_errors">Completed (Errors)</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={chapterFilter} onValueChange={handleChapterFilterChange}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All Chapters" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50 max-h-[300px]">
                    <SelectItem value="all">All Chapters</SelectItem>
                    {chapters?.map((ch) => (
                      <SelectItem key={ch.id} value={ch.id}>
                        {ch.chapter_number}. {ch.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={topicFilter} onValueChange={setTopicFilter} disabled={chapterFilter === 'all'}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All Topics" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50 max-h-[300px]">
                    <SelectItem value="all">All Topics</SelectItem>
                    {topics?.map((tp) => (
                      <SelectItem key={tp.id} value={tp.id}>
                        {tp.topic_number}. {tp.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex-1" />
              </div>


              {/* Jobs Table */}
              <div className="border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !jobs?.length ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Video className="h-8 w-8 mb-2 opacity-50" />
                <p>No video generation jobs found</p>
              </div>
            ) : (
              <Table className="min-w-[1000px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead className="w-24">Job ID</TableHead>
                    <TableHead className="w-28">IP Address</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Current Step</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Published</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium max-w-[150px]">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block truncate cursor-help">
                                {job.document_name || 'Unknown Document'}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p>{job.document_name || 'Unknown Document'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        {job.external_job_id ? (
                          <span 
                            className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded cursor-pointer hover:bg-muted/80 transition-colors"
                            onClick={() => {
                              navigator.clipboard.writeText(job.external_job_id!);
                              toast.success('Job ID copied');
                            }}
                            title={`Click to copy: ${job.external_job_id}`}
                          >
                            {job.external_job_id.slice(0, 8)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span 
                          className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded cursor-pointer hover:bg-muted/80 transition-colors"
                          onClick={() => {
                            const ip = job.server_ip || '69.197.145.4';
                            navigator.clipboard.writeText(ip);
                            toast.success('IP Address copied');
                          }}
                          title={`Click to copy: ${job.server_ip || '69.197.145.4'}`}
                        >
                          {job.server_ip || '69.197.145.4'}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(job.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <Progress value={job.progress || 0} className="w-16 h-2" />
                          <span className="text-xs text-muted-foreground">
                            {job.progress || 0}%
                          </span>
                        </div>
                        {job.steps_completed !== null && job.total_steps !== null && job.total_steps > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Step {job.steps_completed}/{job.total_steps}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[150px]">
                          {job.current_step && (
                            <div className="text-sm truncate">{job.current_step}</div>
                          )}
                          {job.current_phase && (
                            <Badge variant="outline" className="text-xs mt-1">
                              {job.current_phase.replace(/_/g, ' ')}
                            </Badge>
                          )}
                          {job.error_message && (
                            <div className="flex items-center gap-1 text-xs text-destructive mt-1">
                              <AlertCircle className="h-3 w-3" />
                              <span className="truncate">{job.error_message}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {job.created_at
                          ? format(new Date(job.created_at), 'MMM dd, HH:mm')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {isAlreadyPublished(job) ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/30">
                            Published
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Unpublished
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <JobActionsMenu
                          job={job}
                          checkingJobId={checkingJobId}
                          unpublishPending={unpublishMutation.isPending}
                          onCheckStatus={handleCheckStatus}
                          onWatch={(externalJobId, documentName, jobServerIp) => setWatchingJob({ externalJobId, documentName, serverIp: jobServerIp })}
                          onReview={(externalJobId, documentName, jobServerIp) => setReviewingJob({ externalJobId, documentName, serverIp: jobServerIp })}
                          onSanityCheck={(externalJobId, documentName, jobServerIp) => setSanityCheckJob({ externalJobId, documentName, serverIp: jobServerIp })}
                          onLanguages={(externalJobId, videoJobId, documentName, jobServerIp) => setLanguageDialogJob({ externalJobId, videoJobId, documentName, serverIp: jobServerIp })}
                          onPublish={(j) => {
                            const doc = j.ai_assistant_documents;
                            const topicInfo = doc?.subject_topics;
                            const chapterInfo = doc?.subject_chapters;
                            
                            setPublishingJob({
                              jobId: j.id,
                              externalJobId: j.external_job_id!,
                              videoUrl: getPlayerUrl(j)!,
                              topicId: doc?.topic_id,
                              chapterId: doc?.chapter_id,
                              topicTitle: topicInfo?.title,
                              chapterTitle: chapterInfo?.title,
                              isUpdate: isAlreadyPublished(j),
                              serverIp: j.server_ip || undefined,
                            });
                          }}
                          onUnpublish={handleUnpublish}
                          onSelectForDemo={(j) => setDemoJob(j)}
                          isAlreadyPublished={isAlreadyPublished}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            
            {/* Load More Button */}
            {hasNextPage && (
              <div className="flex justify-center pt-4 pb-2">
                <Button
                  variant="outline"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="gap-2"
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      Load next 5 jobs
                    </>
                  )}
                </Button>
              </div>
            )}
              </div>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        {/* Publish/Update Confirmation Dialog */}
        <AlertDialog open={!!publishingJob} onOpenChange={(open) => !open && setPublishingJob(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {publishingJob?.isUpdate ? 'Update Published Video' : 'Publish Video to Students'}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    {publishingJob?.isUpdate 
                      ? 'This will update the existing video with the latest generated content.'
                      : 'This will make the AI-generated video available to students for this content.'}
                  </p>
                  
                  <div className="bg-muted p-3 rounded-md">
                    {publishingJob?.chapterTitle && (
                      <p><strong>Chapter:</strong> {publishingJob.chapterTitle}</p>
                    )}
                    {publishingJob?.topicTitle && (
                      <p><strong>Topic:</strong> {publishingJob.topicTitle}</p>
                    )}
                    {!publishingJob?.chapterTitle && !publishingJob?.topicTitle && (
                      <p className="text-muted-foreground">Target location will be determined by document settings</p>
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    {publishingJob?.isUpdate 
                      ? 'The latest presentation data will replace the current version.'
                      : `The video will appear on the learning page for this ${publishingJob?.topicId ? 'topic' : 'chapter'}.`}
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={publishMutation.isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleConfirmPublish}
                disabled={publishMutation.isPending}
              >
                {publishMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {publishingJob?.isUpdate ? 'Updating...' : 'Publishing...'}
                  </>
                ) : publishingJob?.isUpdate ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Confirm & Update
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Confirm & Publish
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Video Review Dialog */}
        {reviewingJob && (
          <VideoReviewDialog
            open={!!reviewingJob}
            onOpenChange={(open) => !open && setReviewingJob(null)}
            externalJobId={reviewingJob.externalJobId}
            documentName={reviewingJob.documentName}
            serverIp={reviewingJob.serverIp}
          />
        )}

        {/* Video Player Dialog */}
        {/* Video Player Dialog */}
        {watchingJob && (
          <EducationalVideoPlayerDialog
            open={!!watchingJob}
            onOpenChange={(open) => !open && setWatchingJob(null)}
            externalJobId={watchingJob.externalJobId}
            documentName={watchingJob.documentName}
            serverIp={watchingJob.serverIp}
          />
        )}

        {/* Sanity Check Dialog */}
        {sanityCheckJob && (
          <SanityCheckDialog
            open={!!sanityCheckJob}
            onOpenChange={(open) => !open && setSanityCheckJob(null)}
            externalJobId={sanityCheckJob.externalJobId}
            documentName={sanityCheckJob.documentName}
            serverIp={sanityCheckJob.serverIp}
          />
        )}

        {/* Multi-Language Avatar Dialog */}
        {languageDialogJob && (
          <MultiLanguageAvatarDialog
            open={!!languageDialogJob}
            onOpenChange={(open) => !open && setLanguageDialogJob(null)}
            externalJobId={languageDialogJob.externalJobId}
            videoJobId={languageDialogJob.videoJobId}
            documentName={languageDialogJob.documentName}
            serverIp={languageDialogJob.serverIp}
          />
        )}

        {/* Select Demo Course Dialog */}
        <SelectDemoCourseDialog
          job={demoJob}
          open={!!demoJob}
          onOpenChange={(open) => !open && setDemoJob(null)}
        />

        </div>
      </SheetContent>
    </Sheet>
  );
}
