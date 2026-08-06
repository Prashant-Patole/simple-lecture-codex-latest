import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, FileJson, Video, FileText, Image, ChevronDown, ChevronUp, Sparkles, Copy, Check, Filter, X, Link as LinkIcon, Clock, BookOpen, ExternalLink, Eye, AlertCircle, RefreshCw, Activity, Rocket, Wrench, Square, Upload, ListChecks } from "lucide-react";
import { AutoSubmissionPipeline } from "./AutoSubmissionPipeline";
import { useAIAssistantDocuments } from "@/hooks/useAIAssistantDocuments";
import { useServerIpSlots } from "@/hooks/useServerIpSlots";
import { useSubjectChapters, useChapterTopics } from "@/hooks/useSubjectChaptersTopics";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { DocumentImageViewer } from "./DocumentImageViewer";
import { VideoJobsDialog } from "./VideoJobsDialog";
import { AutoPipelineDialog } from "./AutoPipelineDialog";
import { AutoPipelineProgress } from "./AutoPipelineProgress";
import { AutoPipelineScanReport } from "./AutoPipelineScanReport";
import { useAutoPipeline } from "@/hooks/useAutoPipeline";
import { useActivePipelineRun } from "@/hooks/useActivePipelineRun";
import { TopicVisibilityControl } from "./TopicVisibilityControl";

// Generate a unique job prefix: {SubjectNoSpaces}_{YYYYMMDDHHMMSSmmm}_{6CharCode}
async function generateJobPrefix(subjectName: string): Promise<string> {
  const sanitized = subjectName.replace(/\s+/g, '');
  const now = new Date();
  const ts = now.getFullYear().toString()
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0')
    + String(now.getHours()).padStart(2, '0')
    + String(now.getMinutes()).padStart(2, '0')
    + String(now.getSeconds()).padStart(2, '0')
    + String(now.getMilliseconds()).padStart(3, '0');

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const maxRetries = 5;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const fullPrefix = `${sanitized}_${ts}_${code}`;

    const { error } = await supabase.from('video_job_prefixes').insert([{
      random_code: code,
      full_prefix: fullPrefix,
      subject_name: sanitized,
    }]);

    if (!error) {
      console.log('[VideoGen] Generated job_prefix:', fullPrefix);
      return fullPrefix;
    }
    // unique constraint violation → retry
    console.warn(`[VideoGen] job_prefix collision on code ${code}, retrying...`);
  }

  // Fallback: use timestamp + random without DB check
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const fallback = `${sanitized}_${ts}_${code}`;
  console.warn('[VideoGen] Using fallback job_prefix (no DB uniqueness):', fallback);
  return fallback;
}

interface SubjectVideoGeneratorTabProps {
  subjectId: string;
  subjectName: string;
  serverIp?: string;
}

type JobStatus = 'idle' | 'submitting' | 'processing' | 'completed' | 'completed_with_errors' | 'failed';

export function SubjectVideoGeneratorTab({ subjectId, subjectName, serverIp = '69.197.145.4' }: SubjectVideoGeneratorTabProps) {
  const queryClient = useQueryClient();
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("");
  const [viewMode, setViewMode] = useState<"markdown" | "json">("markdown");
  const [isExpanded, setIsExpanded] = useState(false);
  const [generatedId, setGeneratedId] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Job status state
  const [jobStatus, setJobStatus] = useState<JobStatus>('idle');
  const [jobProgress, setJobProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [currentPhase, setCurrentPhase] = useState('');
  const [stepsCompleted, setStepsCompleted] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [externalJobId, setExternalJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Additional status fields from API
  const [statusMessage, setStatusMessage] = useState('');
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [timings, setTimings] = useState<Record<string, number> | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  
  // Viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<{url: string, label?: string}[]>([]);
  const [viewerDocName, setViewerDocName] = useState("");
  
  // Jobs dialog state
  const [jobsDialogOpen, setJobsDialogOpen] = useState(false);
  
  // Auto pipeline state
  const [pipelineMode, setPipelineMode] = useState<'manual' | 'auto' | 'auto-submission' | 'marketing'>('manual');
  const [autoPipelineDialogOpen, setAutoPipelineDialogOpen] = useState(false);
  const [scanReportOpen, setScanReportOpen] = useState(false);
  const scanReportDismissedRef = useRef(false);
  const selectedIpsRef = useRef<string[]>([]);
  const resumeAttemptedRef = useRef<string | null>(null);
  const autoPipeline = useAutoPipeline();
  const { activeRun, dismissRun } = useActivePipelineRun(subjectId);

  // Publish All state
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedCount, setPublishedCount] = useState(0);
  const [totalToPublish, setTotalToPublish] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);

  // Update All Published state (server-side)
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);

  // Poll for active presentation update run
  const { data: activeUpdateRun } = useQuery({
    queryKey: ['presentation-update-run', subjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('presentation_update_runs')
        .select('*')
        .eq('subject_id', subjectId)
        .in('status', ['processing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!subjectId,
    refetchInterval: 30000, // fallback only; realtime handles instant updates
  });

  // Realtime subscription for instant progress updates
  useEffect(() => {
    if (!activeUpdateRun?.id) return;

    const channel = supabase
      .channel(`update-run-${activeUpdateRun.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'presentation_update_runs',
          filter: `id=eq.${activeUpdateRun.id}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ['presentation-update-run', subjectId],
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeUpdateRun?.id, subjectId, queryClient]);

  // Fetch unpublished completed jobs for this subject
  const { data: unpublishedJobs, refetch: refetchUnpublished } = useQuery({
    queryKey: ['unpublished-jobs', subjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_generation_jobs')
        .select('id, external_job_id, server_ip, video_url, document_id, ai_assistant_documents!inner(subject_id, topic_id, chapter_id)')
        .eq('ai_assistant_documents.subject_id', subjectId)
        .eq('status', 'completed')
        .or('is_published.eq.false,is_published.is.null');
      if (error) throw error;
      return (data || []).map((j: any) => ({
        id: j.id,
        external_job_id: j.external_job_id,
        server_ip: j.server_ip,
        video_url: j.video_url,
        topic_id: j.ai_assistant_documents?.topic_id,
        chapter_id: j.ai_assistant_documents?.chapter_id,
      }));
    },
    enabled: !!subjectId,
  });

  // Fetch published completed jobs for Update All
  const { data: publishedJobs } = useQuery({
    queryKey: ['published-jobs-for-update', subjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_generation_jobs')
        .select('id, external_job_id, server_ip, ai_assistant_documents!inner(subject_id)')
        .eq('ai_assistant_documents.subject_id', subjectId)
        .eq('status', 'completed')
        .eq('is_published', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!subjectId,
  });

  const handlePublishAll = useCallback(async () => {
    if (!unpublishedJobs?.length) return;
    setIsPublishing(true);
    setPublishedCount(0);
    setFailedCount(0);
    setTotalToPublish(unpublishedJobs.length);
    setPublishDialogOpen(false);

    let success = 0;
    let failed = 0;

    for (const job of unpublishedJobs) {
      try {
        // Fetch presentation.json from the job's server
        const response = await supabase.functions.invoke('video-generation-proxy', {
          body: { action: 'review', job_id: job.external_job_id, server_ip: job.server_ip }
        });

        // Handle both error property and non-object responses
        if (response.error) {
          const errMsg = typeof response.error === 'object' ? JSON.stringify(response.error) : String(response.error);
          // Skip unreachable servers gracefully
          if (errMsg.includes('No route to host') || errMsg.includes('Connection refused') || errMsg.includes('tcp connect error')) {
            console.warn(`Server ${job.server_ip} unreachable for job ${job.external_job_id}, skipping`);
            failed++;
            setPublishedCount(success);
            setFailedCount(failed);
            continue;
          }
          throw new Error(errMsg);
        }

        const reviewData = response.data;
        const videoUrl = job.video_url || `http://${job.server_ip}:5005/player_v2/?job=${job.external_job_id}`;

        // Update the job as published
        const { error: updateError } = await supabase
          .from('video_generation_jobs')
          .update({
            is_published: true,
            presentation_json: reviewData,
            video_url: videoUrl,
          } as Record<string, unknown>)
          .eq('id', job.id);

        if (updateError) throw updateError;

        success++;
      } catch (err: any) {
        const errStr = err?.message || String(err);
        if (errStr.includes('No route to host') || errStr.includes('Connection refused')) {
          console.warn(`Server ${job.server_ip} unreachable for job ${job.external_job_id}, skipping`);
        } else {
          console.error(`Failed to publish job ${job.external_job_id}:`, err);
        }
        failed++;
      }
      setPublishedCount(success);
      setFailedCount(failed);
    }

    // Invalidate caches
    queryClient.invalidateQueries({ queryKey: ['video-generation-jobs'] });
    queryClient.invalidateQueries({ queryKey: ['video-generation-jobs-paginated'] });
    queryClient.invalidateQueries({ queryKey: ['published-ai-lectures'] });
    queryClient.invalidateQueries({ queryKey: ['content-audit'] });
    queryClient.invalidateQueries({ queryKey: ['unpublished-jobs', subjectId] });

    toast.success(`Published ${success} video${success !== 1 ? 's' : ''}${failed > 0 ? `, ${failed} failed` : ''}`);
    setIsPublishing(false);
  }, [unpublishedJobs, subjectId, queryClient]);

  // Handle Update All Published - insert server-side run
  const handleUpdateAll = useCallback(async () => {
    if (!publishedJobs?.length) return;
    setUpdateDialogOpen(false);

    // Build job queue
    const jobQueue = publishedJobs.map((j: any) => ({
      video_job_id: j.id,
      external_job_id: j.external_job_id,
      server_ip: j.server_ip,
      status: 'pending',
      error_message: null,
    }));

    const { error } = await supabase
      .from('presentation_update_runs')
      .insert({
        subject_id: subjectId,
        subject_name: subjectName,
        status: 'processing',
        job_queue: jobQueue,
        total_jobs: jobQueue.length,
      } as any);

    if (error) {
      toast.error(`Failed to start update: ${error.message}`);
      return;
    }

    toast.success(`Started server-side update for ${jobQueue.length} published jobs. You can close this tab.`);
    queryClient.invalidateQueries({ queryKey: ['presentation-update-run', subjectId] });
  }, [publishedJobs, subjectId, subjectName, queryClient]);

  // When a server-side update run completes, invalidate caches
  useEffect(() => {
    if (activeUpdateRun === null) {
      // No active run - could have just completed, refresh caches
      queryClient.invalidateQueries({ queryKey: ['video-generation-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['published-ai-lectures'] });
      queryClient.invalidateQueries({ queryKey: ['published-jobs-for-update', subjectId] });
    }
  }, [activeUpdateRun, subjectId, queryClient]);

  // Cancel update run
  const handleCancelUpdate = useCallback(async () => {
    if (!activeUpdateRun) return;
    await supabase
      .from('presentation_update_runs')
      .update({ status: 'cancelled' } as any)
      .eq('id', activeUpdateRun.id);
    queryClient.invalidateQueries({ queryKey: ['presentation-update-run', subjectId] });
    toast.info('Update cancelled');
  }, [activeUpdateRun, subjectId, queryClient]);

  // Hydrate pipeline from DB if there's an active run
  // Continuously sync from DB-polled data (server-side pipeline)
  useEffect(() => {
    if (activeRun) {
      // Always restore selectedIps from the active run (survives page refresh)
      if (activeRun.selectedIps && activeRun.selectedIps.length > 0) {
        selectedIpsRef.current = activeRun.selectedIps;
      }

      // If scan_complete from server, load scan results and open the report
      if (activeRun.status === 'scan_complete' && activeRun.scanResults && activeRun.scanResults.length > 0) {
        autoPipeline.hydrateFromRun({
          id: activeRun.id,
          status: activeRun.status,
          chaptersData: activeRun.chaptersData,
          currentChapterIndex: activeRun.currentChapterIndex,
        });
        // Load scan results from DB into autoPipeline state
        autoPipeline.setScanResultsFromServer(activeRun.scanResults);
        if (!scanReportDismissedRef.current) setScanReportOpen(true);
        setPipelineMode('auto');
        return;
      }

      // For scanning state, show progress + partial results in real-time
      if (activeRun.status === 'scanning') {
        autoPipeline.hydrateFromRun({
          id: activeRun.id,
          status: activeRun.status,
          chaptersData: [],
          currentChapterIndex: 0,
        });
        // Update progress counters from DB
        autoPipeline.setScanProgress({
          current: activeRun.completedJobs || 0,
          total: activeRun.totalJobs || 0,
        });
        // Load partial scan results if available, keepScanning=true
        if (activeRun.scanResults && activeRun.scanResults.length > 0) {
          autoPipeline.setScanResultsFromServer(activeRun.scanResults, true);
          if (!scanReportDismissedRef.current) setScanReportOpen(true);
        }
        setPipelineMode('auto');

        // Auto-resume if scan is stalled (no update in 2+ minutes)
        const updatedAt = new Date(activeRun.updatedAt).getTime();
        const stalledMs = Date.now() - updatedAt;
        const isStalled = stalledMs > 2 * 60 * 1000; // 2 minutes

        if (isStalled && resumeAttemptedRef.current !== activeRun.id && chapters?.length) {
          resumeAttemptedRef.current = activeRun.id;

          // Find chapters already scanned
          const scannedChapterIds = new Set(
            (activeRun.scanResults || []).map((r: any) => r.chapterId)
          );

          // Get remaining unscanned chapters
          const remainingChapterIds = chapters
            .filter(c => !scannedChapterIds.has(c.id))
            .map(c => c.id);

          if (remainingChapterIds.length > 0) {
            console.log(`[AutoResume] Resuming stalled scan ${activeRun.id}, ${remainingChapterIds.length} chapters remaining`);
            toast.info(`Resuming scan: ${remainingChapterIds.length} chapters remaining`);

            autoPipeline.scanSubject(
              subjectId,
              activeRun.subjectName,
              chapters,
              activeRun.selectedIps || selectedIpsRef.current,
              remainingChapterIds
            );
          }
        }
        return;
      }

      // Always hydrate when activeRun data changes (polling updates)
      autoPipeline.hydrateFromRun({
        id: activeRun.id,
        status: activeRun.status,
        chaptersData: activeRun.chaptersData,
        currentChapterIndex: activeRun.currentChapterIndex,
      });
      setPipelineMode('auto');
    }
  }, [activeRun]);
  
  // Filter state
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  
  // Fetch chapters and topics
  const { data: chapters } = useSubjectChapters(subjectId);
  const { data: topics } = useChapterTopics(selectedChapterId || undefined);
  
  // Per-IP slot check
  const { activeCount: ipActiveCount, isFull: isIpFull, maxJobs: ipMaxJobs, refetch: refetchSlots } = useServerIpSlots(serverIp);

  const { data: documents, isLoading } = useAIAssistantDocuments(
    subjectId,
    selectedChapterId,
    selectedTopicId
  );
  
  // Reset document selection when filters change
  useEffect(() => {
    setSelectedDocumentId("");
  }, [selectedChapterId, selectedTopicId]);
  
  // Reset topic when chapter changes
  useEffect(() => {
    setSelectedTopicId(null);
  }, [selectedChapterId]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Reset inline job state when user selects a different document
  useEffect(() => {
    if (selectedDocumentId) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      setJobStatus('idle');
      setJobProgress(0);
      setCurrentStep('');
      setCurrentPhase('');
      setStepsCompleted(0);
      setTotalSteps(0);
      setExternalJobId(null);
      setErrorMessage(null);
      setGeneratedId(null);
      setGeneratedVideoUrl(null);
      setStatusMessage('');
      setCreatedAt(null);
      setStartedAt(null);
      setCompletedAt(null);
      setTimings(null);
    }
  }, [selectedDocumentId]);
  
  const hasActiveFilters = selectedChapterId !== null;
  const [showAllDocuments, setShowAllDocuments] = useState(false);
  
  const clearFilters = () => {
    setSelectedChapterId(null);
    setSelectedTopicId(null);
  };

  const displayedDocuments = showAllDocuments ? documents : documents?.slice(0, 5);

  const getChapterName = (chapterId: string | null) => {
    if (!chapterId || !chapters) return null;
    const chapter = chapters.find(c => c.id === chapterId);
    return chapter ? `Ch. ${chapter.chapter_number}` : null;
  };

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case "url": return <LinkIcon className="h-4 w-4 text-blue-500" />;
      case "json": return <FileJson className="h-4 w-4 text-yellow-500" />;
      default: return <FileText className="h-4 w-4 text-red-500" />;
    }
  };
  const selectedDocument = documents?.find(doc => doc.id === selectedDocumentId);
  const fullContent = selectedDocument?.full_content as Record<string, unknown> | null;
  
  // Helper to get JSON without base64 image data for readability
  const getCleanJsonForDisplay = (content: Record<string, unknown>) => {
    const cleaned = { ...content };
    if (cleaned.images && typeof cleaned.images === 'object') {
      const imageKeys = Object.keys(cleaned.images as object);
      cleaned.images = `[${imageKeys.length} images - base64 data hidden for display]`;
    }
    return cleaned;
  };
  
  const metadata = fullContent?.metadata as Record<string, unknown> | undefined;
  const imageCount = fullContent?.images ? Object.keys(fullContent.images as object).length : 0;

  // Generate 9-digit unique ID
  const generateUniqueId = () => {
    return Math.floor(100000000 + Math.random() * 900000000).toString();
  };

  // Update all status state from API response
  const updateStatusFromResponse = (data: Record<string, unknown>) => {
    setJobProgress((data.progress as number) || 0);
    setCurrentStep((data.current_step as string) || '');
    setCurrentPhase((data.current_phase as string) || '');
    setStepsCompleted((data.steps_completed as number) || 0);
    setTotalSteps((data.total_steps as number) || 0);
    setStatusMessage((data.status_message as string) || '');
    setCreatedAt((data.created_at as string) || null);
    setStartedAt((data.started_at as string) || null);
    setCompletedAt((data.completed_at as string) || null);
    setTimings((data.timings as Record<string, number>) || null);
  };

  // Start polling for job status
  const startPolling = (extJobId: string, dbJobId: string) => {
    // Clear any existing interval
    if (pollingRef.current) clearInterval(pollingRef.current);
    
    pollingRef.current = setInterval(async () => {
      try {
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: { action: 'status', job_id: extJobId, server_ip: serverIp }
      });
        
        if (error) {
          console.error('Status check error:', error);
          return;
        }
        
        if (!data) return;
        
        // Update all UI state from API response
        updateStatusFromResponse(data);
        
        // Update database record
        await supabase.from('video_generation_jobs').update({
          progress: data.progress,
          current_step: data.current_step,
          current_phase: data.current_phase,
          steps_completed: data.steps_completed,
          total_steps: data.total_steps
        } as Record<string, unknown>).eq('id', dbJobId);
        
        if (data.status === 'completed' || data.status === 'completed_with_errors') {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          
          setCompletedAt(data.completed_at || new Date().toISOString());
          const videoUrl = `http://${serverIp}:5005/player_v2/?job=${extJobId}`;
          setGeneratedVideoUrl(videoUrl);
          setJobStatus(data.status as JobStatus);
          
          // Update database with final status and URL
          await supabase.from('video_generation_jobs').update({
            status: data.status,
            video_url: videoUrl,
            progress: data.status === 'completed' ? 100 : (data.progress || jobProgress)
          } as Record<string, unknown>).eq('id', dbJobId);
          
          // Save to chapter/topic
          if (selectedDocument?.topic_id) {
            await supabase.from('subject_topics')
              .update({ ai_generated_video_url: videoUrl } as Record<string, unknown>)
              .eq('id', selectedDocument.topic_id);
          } else if (selectedDocument?.chapter_id) {
            await supabase.from('subject_chapters')
              .update({ ai_generated_video_url: videoUrl } as Record<string, unknown>)
              .eq('id', selectedDocument.chapter_id);
          }
          
          if (data.status === 'completed') {
            toast.success('Video generation completed!');
          } else {
            toast.warning('Video completed with errors', { description: 'Some sections may have issues. Review the video.' });
          }
          
        } else if (data.status === 'failed') {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          
          setJobStatus('failed');
          setErrorMessage(data.error || 'Video generation failed');
          
          await supabase.from('video_generation_jobs').update({
            status: 'failed',
            error_message: data.error
          } as Record<string, unknown>).eq('id', dbJobId);
          
          toast.error('Video generation failed', { description: data.error });
        }
        
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000); // Poll every 3 seconds
  };

  // Manual check status
  const handleCheckStatus = async () => {
    if (!externalJobId) return;
    
    setIsCheckingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: { action: 'status', job_id: externalJobId, server_ip: serverIp }
      });
      
      if (error) {
        toast.error('Failed to check status');
        return;
      }
      
      if (data) {
        updateStatusFromResponse(data);
        toast.success('Status updated');
        
        // Handle completed/completed_with_errors/failed status
        if ((data.status === 'completed' || data.status === 'completed_with_errors') && generatedId) {
          const videoUrl = `http://${serverIp}:5005/player_v2/?job=${externalJobId}`;
          setGeneratedVideoUrl(videoUrl);
          setJobStatus(data.status as JobStatus);
          setCompletedAt(data.completed_at || new Date().toISOString());
          
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        } else if (data.status === 'failed') {
          setJobStatus('failed');
          setErrorMessage(data.error || 'Video generation failed');
          
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      }
    } catch (err) {
      console.error('Check status error:', err);
      toast.error('Failed to check status');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Handle generate video click
  const handleGenerateVideo = async () => {
    // Double-check IP slots before submitting
    if (isIpFull) {
      toast.error('Server is at capacity', {
        description: `Server ${serverIp} already has ${ipMaxJobs} active jobs. Please use a different IP.`
      });
      return;
    }

    setJobStatus('submitting');
    setJobProgress(0);
    setCurrentStep('Submitting job...');
    setErrorMessage(null);
    setGeneratedId(null);
    setGeneratedVideoUrl(null);
    
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      // Check if user is authenticated
      if (authError || !user) {
        toast.error('Authentication required', { 
          description: 'Please log in again to generate videos.' 
        });
        setJobStatus('idle');
        return;
      }
      
      // Prefer sending original document file; fall back to markdown
      const documentUrl = selectedDocument?.source_url;
      const fileName = selectedDocument?.file_name;
      const sourceType = selectedDocument?.source_type;
      const markdown = fullContent?.content_markdown as string;

      console.log('[VideoGen] Starting submission for document:', fileName || 'unknown');
      console.log('[VideoGen] Document source_url:', documentUrl || 'NONE');
      console.log('[VideoGen] Document source_type:', sourceType || 'NONE');

      if (!documentUrl && !markdown) {
        toast.error('No document or markdown content available');
        setJobStatus('idle');
        return;
      }
      
      if (documentUrl) {
        console.log('[VideoGen] Using DOCUMENT URL path (not markdown)');
      } else {
        console.log('[VideoGen] Using MARKDOWN fallback (no source_url)');
      }

      // 1. Generate unique job prefix
      const jobPrefix = await generateJobPrefix(subjectName);

      // 2. Submit job to external API via edge function
      const payload: Record<string, any> = {
        action: 'submit',
        server_ip: '69.197.145.4',
        target_port: 5005,
        subject: subjectName,
        grade: '12',
        job_prefix: jobPrefix,
        dry_run: false,
        skip_wan: false,
        skip_avatar: false,
        audio_only: false,
        tts_provider: 'our_tts',
        pipeline_version: 'v15_v2_director',
        generation_scope: 'full',
        video_provider: 'kie',
        ocr_provider: 'local',
        skip_threejs: false,
        avatar_language: 'english',
        llm_routing: {
          chunker: 'openrouter',
          director: 'openrouter',
          manim_renderer: 'openrouter',
          remotion_renderer: 'openrouter',
          video_renderer: 'openrouter',
          prompt_enhancer: 'openrouter',
        },
      };

      if (subjectData?.avatar_id) {
        payload.avatar_id = subjectData.avatar_id;
      }

      if (documentUrl) {
        payload.document_url = documentUrl;
        payload.file_name = fileName;
        payload.source_type = sourceType;
      } else {
        payload.markdown = markdown;
      }

      console.log('[VideoGen] Payload to edge function:', { ...payload, markdown: payload.markdown ? `(${payload.markdown.length} chars)` : undefined });

      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: payload
      });
      
      if (error) {
        console.error('[VideoGen] Edge function error:', error);
        throw new Error(error.message || 'Failed to submit job');
      }
      
      console.log('[VideoGen] Edge function response:', data);

      if (!data?.job_id) {
        throw new Error(data?.message || 'No job ID returned from API');
      }
      
      const extJobId = data.job_id;
      setExternalJobId(extJobId);
      
      // 2. Create database record
      const uniqueId = generateUniqueId();
      const { error: dbError } = await supabase.from('video_generation_jobs').insert([{
        id: uniqueId,
        external_job_id: extJobId,
        document_id: selectedDocumentId,
        subject_id: subjectId,
        document_name: selectedDocument?.display_name || selectedDocument?.file_name,
        status: 'processing',
        created_by: user?.id,
        server_ip: serverIp
      }]);
      
      if (dbError) {
        console.error('[VideoGen] DB insert error:', dbError);
        throw new Error('Failed to create job record');
      }
      
      console.log('[VideoGen] DB record created:', { id: uniqueId, external_job_id: extJobId });
      setGeneratedId(uniqueId);

      // Invalidate jobs table caches so VideoJobsDialog shows the new job immediately
      queryClient.invalidateQueries({ queryKey: ['video-generation-jobs'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['video-generation-jobs-paginated'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['video-job-stats'], exact: false });
      setJobStatus('processing');
      toast.success('Video generation started!', { description: `Job ID: ${extJobId}` });
      
      // Refresh IP slot count
      refetchSlots();
      
      // 3. Start polling for status
      startPolling(extJobId, uniqueId);
      
    } catch (err) {
      console.error('Error:', err);
      setJobStatus('failed');
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred');
      toast.error('Failed to start video generation');
    }
  };

  const handleViewVideo = () => {
    if (generatedVideoUrl) {
      window.open(generatedVideoUrl, '_blank');
    }
  };

  const copyToClipboard = () => {
    if (generatedVideoUrl) {
      navigator.clipboard.writeText(generatedVideoUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('URL copied to clipboard');
    }
  };

  const handleViewDocument = (doc: { full_content: unknown; display_name?: string | null; file_name?: string | null }) => {
    const docContent = doc.full_content as Record<string, unknown> | null;
    const uploadedImages = (docContent?.uploaded_images as { url: string; pageNumber?: number }[]) || [];
    
    if (uploadedImages.length === 0) {
      toast.error("No preview available. This document doesn't have page images.");
      return;
    }
    
    const images = uploadedImages.map((img, idx) => ({
      url: img.url,
      label: `Page ${img.pageNumber || idx + 1}`,
    }));
    
    setViewerImages(images);
    setViewerDocName(doc.display_name || doc.file_name || "Document");
    setViewerOpen(true);
  };

  const isGenerating = jobStatus === 'submitting' || jobStatus === 'processing';
  const isCompletedWithErrors = jobStatus === 'completed_with_errors';
  const isButtonDisabled = isGenerating || isIpFull;

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Generate Video
            </CardTitle>
            <CardDescription>
              Select a parsed document to view its content and generate AI video scripts for {subjectName}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={pipelineMode} onValueChange={(v) => setPipelineMode(v as 'manual' | 'auto' | 'auto-submission' | 'marketing')}>
              <TabsList className="h-8">
                <TabsTrigger value="manual" className="text-xs gap-1 px-3">
                  <Wrench className="h-3.5 w-3.5" />
                  Manual
                </TabsTrigger>
                <TabsTrigger value="auto" className="text-xs gap-1 px-3">
                  <Rocket className="h-3.5 w-3.5" />
                  Auto
                </TabsTrigger>
                <TabsTrigger value="auto-submission" className="text-xs gap-1 px-3">
                  <ListChecks className="h-3.5 w-3.5" />
                  Auto Submission
                </TabsTrigger>
                <TabsTrigger value="marketing" className="text-xs gap-1 px-3">
                  <Video className="h-3.5 w-3.5" />
                  Marketing Videos
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button 
              variant="outline" 
              onClick={() => setJobsDialogOpen(true)}
              className="gap-2"
            >
              <Activity className="h-4 w-4" />
              View All Jobs
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auto Mode */}
        {pipelineMode === 'auto' && (
          <div className="space-y-4">
            {(autoPipeline.pipelineState === 'idle' || autoPipeline.pipelineState === 'cancelled') && !autoPipelineDialogOpen && !scanReportOpen ? (
              <div className="text-center py-6 border rounded-lg bg-muted/20">
                <Rocket className="h-10 w-10 mx-auto mb-3 opacity-60" />
                <p className="text-sm text-muted-foreground mb-3">
                  Auto mode scans all topics, audits existing jobs, and lets you review before starting.
                </p>
                <Button onClick={() => setAutoPipelineDialogOpen(true)} className="gap-2">
                  <Rocket className="h-4 w-4" />
                  Configure & Scan
                </Button>
              </div>
            ) : autoPipeline.pipelineState === 'scanning' && !scanReportOpen ? (
              <div className="text-center py-6 border rounded-lg bg-muted/20">
                <RefreshCw className="h-10 w-10 mx-auto mb-3 opacity-60 animate-spin" />
                <p className="text-sm font-medium mb-1">Scan running on server...</p>
                <p className="text-xs text-muted-foreground mb-3">
                  You can close this tab. The scan will continue on the server.
                  {activeRun && ` Progress: ${activeRun.completedJobs}/${activeRun.totalJobs} topics scanned.`}
                </p>
                <div className="flex items-center justify-center gap-2">
                  {activeRun && (
                    <Button variant="destructive" size="sm" onClick={async () => {
                      await dismissRun(activeRun.id);
                      autoPipeline.resetPipeline();
                    }} className="gap-2">
                      <Square className="h-4 w-4" />
                      Stop Scan
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => {
                    scanReportDismissedRef.current = false;
                    setScanReportOpen(true);
                  }} className="gap-2">
                    <Eye className="h-4 w-4" />
                    View Progress
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ['active-pipeline-run'], exact: false });
                  }} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </div>
            ) : autoPipeline.pipelineState === 'scan_complete' && !scanReportOpen ? (
              <div className="text-center py-6 border rounded-lg bg-muted/20">
                <Eye className="h-10 w-10 mx-auto mb-3 opacity-60" />
                <p className="text-sm font-medium mb-1">Scan Complete!</p>
                <p className="text-xs text-muted-foreground mb-3">Review the scan report and approve to start the pipeline.</p>
                <Button onClick={() => setScanReportOpen(true)} className="gap-2">
                  <Eye className="h-4 w-4" />
                  Review Scan Report
                </Button>
              </div>
            ) : (
              <AutoPipelineProgress
                pipelineState={autoPipeline.pipelineState}
                chapters={autoPipeline.chapters}
                currentChapterIndex={autoPipeline.currentChapterIndex}
                activeIpSlots={autoPipeline.activeIpSlots}
                onApproveChapter={autoPipeline.approveChapter}
                onCancel={autoPipeline.cancelPipeline}
                onReset={() => {
                  if (activeRun) dismissRun(activeRun.id);
                  autoPipeline.resetPipeline();
                }}
              />
            )}

            <AutoPipelineDialog
              open={autoPipelineDialogOpen}
              onOpenChange={setAutoPipelineDialogOpen}
              chapters={chapters || []}
              subjectName={subjectName}
              onStart={(selectedIps, filteredChapters) => {
                if (filteredChapters.length > 0) {
                  selectedIpsRef.current = selectedIps;
                  scanReportDismissedRef.current = false;
                  setScanReportOpen(true);
                  autoPipeline.scanSubject(subjectId, subjectName, filteredChapters, selectedIps);
                }
              }}
            />

            <AutoPipelineScanReport
              open={scanReportOpen}
              onOpenChange={(open) => {
                setScanReportOpen(open);
                if (!open) scanReportDismissedRef.current = true;
              }}
              scanResults={autoPipeline.scanResults}
              isScanning={autoPipeline.pipelineState === 'scanning'}
              scanProgress={autoPipeline.scanProgress}
              onStart={(selectedResults) => {
                setScanReportOpen(false);
                if (chapters) {
                  autoPipeline.startPipelineFromScan(subjectId, subjectName, chapters, selectedResults, selectedIpsRef.current);
                }
              }}
              onCancel={() => {
                setScanReportOpen(false);
                autoPipeline.resetPipeline();
              }}
            />
          </div>
        )}

        {/* Auto Submission Mode */}
        {pipelineMode === 'auto-submission' && (
          <AutoSubmissionPipeline subjectId={subjectId} subjectName={subjectName} serverIp={serverIp} />
        )}

        {/* Marketing Videos Mode */}
        {pipelineMode === 'marketing' && (
          <AutoSubmissionPipeline
            subjectId={subjectId}
            subjectName={subjectName}
            serverIp="204.12.237.78"
            kind="marketing"
            pipelineConfig={{
              server_ip: "204.12.237.78",
              target_port: 5006,
              pipeline_version: "v3_visual_first",
              no_quiz: true,
              image_provider: "gpu",
              image_model: "flux_dev",
              grade: "9",
              tts_provider: "edge_tts",
              video_provider: "kie",
              ocr_provider: "local",
              avatar_language: "english",
              target_languages: ["kannada", "hindi"],
              llm_routing: {
                chunker: "local",
                director: "local",
                manim_renderer: "openrouter",
                remotion_renderer: "local",
                video_renderer: "local",
                prompt_enhancer: "local",
                story_enhancer: "local",
              },
            }}
          />
        )}

        {/* Manual Mode - existing content */}
        {pipelineMode === 'manual' && (
        <>
        {/* Filter Section */}
        <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-lg border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>Filter by:</span>
          </div>
          
          <Select
            value={selectedChapterId || "all"}
            onValueChange={(val) => setSelectedChapterId(val === "all" ? null : val)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Chapters" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="all">All Chapters</SelectItem>
              {chapters?.map((chapter) => (
                <SelectItem key={chapter.id} value={chapter.id}>
                  Ch {chapter.chapter_number}: {chapter.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {selectedChapterId && (
            <Select
              value={selectedTopicId || "all"}
              onValueChange={(val) => setSelectedTopicId(val === "all" ? null : val)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Topics" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="all">All Topics</SelectItem>
                {topics?.map((topic) => (
                  <SelectItem key={topic.id} value={topic.id}>
                    Topic {topic.topic_number}: {topic.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>

        {selectedTopicId && (
          <TopicVisibilityControl topicId={selectedTopicId} />
        )}

        {/* Document List */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Documents ({documents?.length || 0})
          </Label>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground p-8">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading documents...
            </div>
          ) : !documents || documents.length === 0 ? (
            <div className="text-sm text-muted-foreground p-4 border rounded-lg bg-muted/30 text-center">
              <FileJson className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No documents found{hasActiveFilters ? " for selected filters" : ""}.</p>
              <p className="text-xs mt-1">
                {hasActiveFilters 
                  ? "Try clearing filters or select different chapter/topic." 
                  : "Go to the Documents tab to upload and parse PDFs first."}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Upload Date</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedDocuments?.map((doc) => (
                      <TableRow 
                        key={doc.id}
                        className={`cursor-pointer ${selectedDocumentId === doc.id ? "bg-primary/10" : "hover:bg-muted/50"}`}
                        onClick={() => setSelectedDocumentId(doc.id)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {getSourceIcon(doc.source_type)}
                            <span className="break-words">
                              {doc.display_name || doc.file_name || "Untitled"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {doc.chapter_id ? (
                            <Badge variant="outline" className="text-xs">
                              {getChapterName(doc.chapter_id)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs capitalize">
                            {doc.source_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <div className="flex flex-col">
                              <span>{format(new Date(doc.created_at), "MMM d, yyyy")}</span>
                              <span className="text-xs text-muted-foreground/70">
                                {format(new Date(doc.created_at), "HH:mm")}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewDocument(doc);
                              }}
                              title="View document pages"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant={selectedDocumentId === doc.id ? "default" : "outline"}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDocumentId(doc.id);
                              }}
                            >
                              {selectedDocumentId === doc.id ? "Selected" : "Select"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {documents.length > 5 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllDocuments(!showAllDocuments)}
                  className="w-full"
                >
                  {showAllDocuments ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Show All ({documents.length})
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </div>

        {/* Document Content Display */}
        {selectedDocumentId && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Document Content</Label>
              {fullContent && (
                <div className="flex gap-2">
                  <Button
                    variant={viewMode === "markdown" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("markdown")}
                    className="gap-1.5"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Markdown
                  </Button>
                  <Button
                    variant={viewMode === "json" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("json")}
                    className="gap-1.5"
                  >
                    <FileJson className="h-3.5 w-3.5" />
                    JSON
                  </Button>
                </div>
              )}
            </div>
            
            {fullContent ? (
              <>
                {/* Metadata bar */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground border rounded-md px-3 py-2 bg-muted/30">
                  <span className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    Pages: {(metadata?.pages as number) || 'N/A'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Image className="h-3.5 w-3.5" />
                    Images: {imageCount}
                  </span>
                  <span className={fullContent.success ? "text-green-600" : "text-red-600"}>
                    Status: {fullContent.success ? "✓ Success" : "✗ Failed"}
                  </span>
                </div>
                
                <ScrollArea className={`${isExpanded ? "h-[600px]" : "h-[200px]"} rounded-lg border bg-muted/50 p-4 transition-all duration-300`}>
                  {viewMode === "markdown" ? (
                    <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
                      {(fullContent.content_markdown as string) || "No markdown content available"}
                    </pre>
                  ) : (
                    <pre className="text-xs font-mono whitespace-pre-wrap">
                      {JSON.stringify(getCleanJsonForDisplay(fullContent), null, 2)}
                    </pre>
                  )}
                </ScrollArea>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="w-full mt-2"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Show More
                    </>
                  )}
                </Button>

                {/* Server IP Slot Indicator */}
                <div className={`mt-4 p-3 rounded-lg border flex items-center justify-between ${
                  isIpFull 
                    ? 'bg-destructive/10 border-destructive/30' 
                    : ipActiveCount > 0 
                      ? 'bg-amber-500/10 border-amber-500/30' 
                      : 'bg-green-500/10 border-green-500/30'
                }`}>
                  <div className="flex items-center gap-2 text-sm">
                    <div className={`h-2 w-2 rounded-full ${
                      isIpFull ? 'bg-destructive' : ipActiveCount > 0 ? 'bg-amber-500' : 'bg-green-500'
                    }`} />
                    <span className="font-medium">
                      Server {serverIp}: {ipActiveCount}/{ipMaxJobs} slots used
                    </span>
                  </div>
                  {isIpFull && (
                    <span className="text-xs text-destructive font-medium">
                      Server at capacity — use a different IP
                    </span>
                  )}
                </div>

                {/* Generate Video Button */}
                <div className="mt-3 p-4 border rounded-lg bg-gradient-to-r from-primary/5 to-secondary/5">
                  <Button 
                    onClick={handleGenerateVideo}
                    disabled={isButtonDisabled}
                    className="w-full gap-2"
                    size="lg"
                  >
                    {isIpFull ? (
                      <>
                        <AlertCircle className="h-4 w-4" />
                        Server Busy ({ipActiveCount}/{ipMaxJobs})
                      </>
                    ) : jobStatus === 'submitting' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : jobStatus === 'processing' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating... {jobProgress}%
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate Video
                      </>
                    )}
                  </Button>
                  
                  {/* Processing Status */}
                  {jobStatus === 'processing' && (
                    <div className="mt-4 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/30 space-y-3">
                      {/* Header with spinner and step count */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                          <span className="font-medium">Generating Video...</span>
                        </div>
                        {totalSteps > 0 && (
                          <span className="text-sm text-muted-foreground">
                            Step {stepsCompleted} of {totalSteps}
                          </span>
                        )}
                      </div>
                      
                      {/* Progress Bar */}
                      <Progress value={jobProgress} className="h-2" />
                      
                      {/* Current Step and Progress % */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{currentStep || 'Processing...'}</span>
                        <span className="font-medium">{jobProgress}%</span>
                      </div>
                      
                      {/* Status Message (from API) */}
                      {statusMessage && (
                        <p className="text-sm text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 px-3 py-2 rounded">
                          {statusMessage}
                        </p>
                      )}
                      
                      {/* Phase and Job ID */}
                      <div className="flex flex-wrap items-center gap-2">
                        {currentPhase && (
                          <Badge variant="outline" className="text-xs">
                            Phase: {currentPhase.replace(/_/g, ' ')}
                          </Badge>
                        )}
                        {externalJobId && (
                          <Badge variant="secondary" className="text-xs">
                            Job ID: {externalJobId}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Timestamps */}
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-2 border-t">
                        {createdAt && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>Created: {format(new Date(createdAt), "HH:mm:ss")}</span>
                          </div>
                        )}
                        {startedAt && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>Started: {format(new Date(startedAt), "HH:mm:ss")}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Timings (if available) */}
                      {timings && Object.keys(timings).length > 0 && (
                        <div className="text-xs text-muted-foreground pt-2 border-t">
                          <span className="font-medium">Timings:</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {Object.entries(timings).map(([key, value]) => (
                              <Badge key={key} variant="outline" className="text-xs">
                                {key.replace(/_/g, ' ')}: {typeof value === 'number' ? `${value.toFixed(1)}s` : String(value)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Check Status Button - Bottom Right */}
                      <div className="flex justify-end pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCheckStatus}
                          disabled={isCheckingStatus}
                          className="gap-2"
                        >
                          {isCheckingStatus ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                          Check Status
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Completed with Errors State */}
                  {isCompletedWithErrors && generatedVideoUrl && (
                    <div className="mt-4 space-y-4">
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-5 w-5 text-amber-600" />
                          <p className="font-medium text-amber-700 dark:text-amber-300">
                            Completed with Errors
                          </p>
                        </div>
                        <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                          The video was generated but some sections may have issues. Please review the output.
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Job ID: {externalJobId}
                        </p>
                      </div>
                      
                      {/* Embedded Video Player */}
                      <div className="rounded-lg overflow-hidden border shadow-lg">
                        <iframe
                          src={generatedVideoUrl}
                          className="w-full h-[500px]"
                          allow="autoplay; fullscreen; picture-in-picture"
                          allowFullScreen
                          title="Generated Presentation"
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          onClick={handleViewVideo}
                          className="gap-2"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open in New Tab
                        </Button>
                        <Button 
                          variant="ghost" 
                          onClick={copyToClipboard}
                          className="gap-2"
                        >
                          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          Copy URL
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Completed State */}
                  {jobStatus === 'completed' && generatedVideoUrl && (
                    <div className="mt-4 space-y-4">
                      <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2">
                          <Check className="h-5 w-5 text-green-600" />
                          <p className="font-medium text-green-700 dark:text-green-300">
                            Video Generated Successfully!
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Job ID: {externalJobId}
                        </p>
                      </div>
                      
                      {/* Embedded Video Player */}
                      <div className="rounded-lg overflow-hidden border shadow-lg">
                        <iframe
                          src={generatedVideoUrl}
                          className="w-full h-[500px]"
                          allow="autoplay; fullscreen; picture-in-picture"
                          allowFullScreen
                          title="Generated Presentation"
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          onClick={handleViewVideo}
                          className="gap-2"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open in New Tab
                        </Button>
                        <Button 
                          variant="ghost" 
                          onClick={copyToClipboard}
                          className="gap-2"
                        >
                          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          Copy URL
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Failed State */}
                  {jobStatus === 'failed' && (
                    <div className="mt-4 p-4 border rounded-lg bg-red-50 dark:bg-red-950/30">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                        <p className="font-medium text-red-700 dark:text-red-300">
                          Video Generation Failed
                        </p>
                      </div>
                      {errorMessage && (
                        <p className="text-sm text-red-600 mt-2">{errorMessage}</p>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-3 gap-2"
                        onClick={handleGenerateVideo}
                      >
                        <RefreshCw className="h-4 w-4" />
                        Retry
                      </Button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground p-4 border rounded-lg bg-muted/30 text-center">
                <p>No full content available for this document.</p>
                <p className="text-xs mt-1">
                  This document was saved before full content storage was enabled. 
                  Re-parse the document in the Documents tab to store the full content.
                </p>
              </div>
            )}
          </div>
        )}

        {!selectedDocumentId && documents && documents.length > 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Video className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Select a document above to view its parsed content</p>
          </div>
        )}
        </>
        )}
      </CardContent>

      <DocumentImageViewer
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        images={viewerImages}
        fileName={viewerDocName}
      />
    </Card>
    
    <VideoJobsDialog 
      open={jobsDialogOpen} 
      onOpenChange={setJobsDialogOpen}
      subjectId={subjectId}
      subjectName={subjectName}
      serverIp={serverIp}
    />
    </>
  );
}
