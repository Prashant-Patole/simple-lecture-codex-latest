import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { checkServerIpSlots } from './useServerIpSlots';

// Constants
const MAX_CONCURRENT_PER_IP = 2;
const POLLING_INTERVAL = 5000;

// Types
export interface PhaseProgress {
  total: number;
  completed: number;
  failed: number;
  inProgress?: number;
}

export interface JobDetailedStatus {
  jobId: string;
  externalJobId: string;
  submittedAt: number;
  status: 'queued' | 'active' | 'completed' | 'failed';
  llm: { status: 'pending' | 'processing' | 'completed' | 'failed' };
  manim: PhaseProgress;
  wan: PhaseProgress;
  avatar: PhaseProgress;
  overallProgress: number;
  currentStep?: string;
  currentPhase?: string;
  error?: string;
  serverIp?: string;
}

export interface QueuedJob {
  id: string;
  documentId: string;
  documentName: string;
  subjectId: string;
  markdown: string;
  subjectName: string;
  queuedAt: number;
  position: number;
  serverIp?: string;
}

interface JobSubmission {
  documentId: string;
  documentName: string;
  subjectId: string;
  subjectName: string;
  markdown: string;
  serverIp?: string;
}

interface SubmitResult {
  status: 'started' | 'queued';
  position?: number;
  jobId?: string;
  externalJobId?: string;
}

// Helper to determine LLM status from phase - fixes "Waiting in Queue" bug
function determineLlmStatus(currentPhase?: string): 'pending' | 'processing' | 'completed' {
  if (!currentPhase) return 'pending';
  if (currentPhase === 'llm') return 'processing';
  // If we have any phase that isn't 'llm', LLM is done
  return 'completed';
}

export function useJobQueueManager(subjectId?: string) {
  const queryClient = useQueryClient();
  
  // State
  const [queuedJobs, setQueuedJobs] = useState<QueuedJob[]>([]);
  const [activeJobs, setActiveJobs] = useState<Map<string, JobDetailedStatus>>(new Map());
  const [completedJobs, setCompletedJobs] = useState<JobDetailedStatus[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Refs for stable polling (fixes stale closure bug)
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processingQueueRef = useRef(false);
  const activeJobsRef = useRef<Map<string, JobDetailedStatus>>(new Map());
  const queuedJobsRef = useRef<QueuedJob[]>([]);
  const pollErrorCountsRef = useRef<Map<string, number>>(new Map());


  // Sync refs with state
  useEffect(() => {
    activeJobsRef.current = activeJobs;
  }, [activeJobs]);

  useEffect(() => {
    queuedJobsRef.current = queuedJobs;
  }, [queuedJobs]);

  // Invalidate React Query caches
  const invalidateCaches = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['video-generation-jobs'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['video-job-stats'], exact: false });
  }, [queryClient]);

  // Helper to fetch detailed job analytics
  const fetchJobDetails = useCallback(async (externalJobId: string, serverIp?: string): Promise<Partial<JobDetailedStatus> | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: { action: 'job_details', job_id: externalJobId, server_ip: serverIp }
      });
      
      if (error || !data) {
        console.error('Failed to fetch job details:', error);
        return null;
      }
      
      // Parse the combined response
      const { jobStatus, analytics, avatarStatus } = data;
      
      // Determine LLM status correctly using phase
      const llmStatus = determineLlmStatus(jobStatus?.current_phase);
      
      // Parse Manim stats from analytics
      const manimTotal = analytics?.manim_total || analytics?.total_manim || 0;
      const manimCompleted = analytics?.manim_completed || analytics?.completed_manim || 0;
      const manimFailed = analytics?.manim_failed || analytics?.failed_manim || 0;
      
      // Parse WAN stats from analytics
      const wanTotal = analytics?.wan_total || analytics?.total_wan || 0;
      const wanCompleted = analytics?.wan_completed || analytics?.completed_wan || 0;
      const wanFailed = analytics?.wan_failed || analytics?.failed_wan || 0;
      const wanInProgress = analytics?.wan_in_progress || 0;
      
      // Parse Avatar stats
      const avatarTotal = avatarStatus?.total || 0;
      const avatarCompleted = avatarStatus?.completed || 0;
      const avatarFailed = avatarStatus?.failed || 0;
      const avatarInProgress = avatarStatus?.in_progress || 0;
      
      return {
        llm: { status: llmStatus },
        manim: { total: manimTotal, completed: manimCompleted, failed: manimFailed },
        wan: { total: wanTotal, completed: wanCompleted, failed: wanFailed, inProgress: wanInProgress },
        avatar: { total: avatarTotal, completed: avatarCompleted, failed: avatarFailed, inProgress: avatarInProgress },
        overallProgress: jobStatus?.progress || 0,
        currentStep: jobStatus?.current_step,
        currentPhase: jobStatus?.current_phase,
      };
    } catch (err) {
      console.error('Error fetching job details:', err);
      return null;
    }
  }, []);

  // Stable poll function that reads from refs (fixes stale closure)
  const pollActiveJobsStable = useCallback(async () => {
    const currentActiveJobs = activeJobsRef.current;
    
    if (currentActiveJobs.size === 0) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        setIsPolling(false);
      }
      return;
    }

    const updatedJobs = new Map(currentActiveJobs);
    const jobsToRemove: string[] = [];
    const newlyCompletedJobs: JobDetailedStatus[] = [];

    for (const [jobId, job] of currentActiveJobs) {
      try {
        // Fetch basic status first with server_ip
        const { data: statusData, error } = await supabase.functions.invoke('video-generation-proxy', {
          body: { action: 'status', job_id: job.externalJobId, server_ip: job.serverIp }
        });

        if (error) {
          console.error(`Failed to poll job ${jobId}:`, error);
          const prev = pollErrorCountsRef.current.get(job.externalJobId) || 0;
          const next = prev + 1;
          pollErrorCountsRef.current.set(job.externalJobId, next);
          if (next >= 5) {
            const failedJob: JobDetailedStatus = { ...job, status: 'failed', error: 'Upstream unreachable' };
            updatedJobs.set(jobId, failedJob);
            jobsToRemove.push(jobId);
            newlyCompletedJobs.push(failedJob);
            await supabase.from('video_generation_jobs')
              .update({ status: 'failed', error_message: 'Upstream unreachable', completed_at: new Date().toISOString() })
              .eq('external_job_id', job.externalJobId);
            pollErrorCountsRef.current.delete(job.externalJobId);
          }
          continue;
        }
        pollErrorCountsRef.current.delete(job.externalJobId);


        // Fetch detailed analytics with server_ip
        const details = await fetchJobDetails(job.externalJobId, job.serverIp);
        
        // Determine LLM status correctly
        const llmStatus = determineLlmStatus(statusData?.current_phase || details?.currentPhase);
        
        const updatedJob: JobDetailedStatus = {
          ...job,
          overallProgress: statusData?.progress || details?.overallProgress || job.overallProgress,
          currentStep: statusData?.current_step || details?.currentStep,
          currentPhase: statusData?.current_phase || details?.currentPhase,
          llm: { status: llmStatus },
          manim: details?.manim || job.manim,
          wan: details?.wan || job.wan,
          avatar: details?.avatar || job.avatar,
        };

        if (statusData?.status === 'completed' || statusData?.status === 'completed_with_errors') {
          updatedJob.status = 'completed';
          updatedJob.overallProgress = statusData?.status === 'completed' ? 100 : (statusData?.progress || updatedJob.overallProgress);
          updatedJob.llm = { status: 'completed' };
          jobsToRemove.push(jobId);
          newlyCompletedJobs.push(updatedJob);
          
          // Persist exact status to DB (e.g. 'completed_with_errors')
          await supabase.from('video_generation_jobs')
            .update({ 
              status: statusData.status,
              progress: statusData?.status === 'completed' ? 100 : (statusData?.progress || updatedJob.overallProgress),
              completed_at: new Date().toISOString()
            })
            .eq('external_job_id', job.externalJobId);
        } else if (statusData?.status === 'failed') {
          updatedJob.status = 'failed';
          updatedJob.error = statusData?.error || 'Job failed';
          jobsToRemove.push(jobId);
          newlyCompletedJobs.push(updatedJob);
        }

        updatedJobs.set(jobId, updatedJob);
      } catch (err) {
        console.error(`Error polling job ${jobId}:`, err);
      }
    }

    // Remove completed/failed jobs from active
    jobsToRemove.forEach(id => updatedJobs.delete(id));
    setActiveJobs(updatedJobs);

    // Add to completed list
    if (newlyCompletedJobs.length > 0) {
      setCompletedJobs(prev => [...newlyCompletedJobs, ...prev].slice(0, 10));
      // Invalidate caches when jobs complete
      invalidateCaches();
    }
  }, [fetchJobDetails, invalidateCaches]);

  // Start polling if not already running
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return;
    
    setIsPolling(true);
    pollingIntervalRef.current = setInterval(pollActiveJobsStable, POLLING_INTERVAL);
  }, [pollActiveJobsStable]);

  // Process queue - start next job if capacity available
  const processQueue = useCallback(async () => {
    const currentActiveJobs = activeJobsRef.current;
    const currentQueuedJobs = queuedJobsRef.current;
    
    if (processingQueueRef.current) return;
    if (currentActiveJobs.size >= MAX_CONCURRENT_PER_IP) return;
    if (currentQueuedJobs.length === 0) return;

    processingQueueRef.current = true;

    try {
      const slotsAvailable = MAX_CONCURRENT_PER_IP - currentActiveJobs.size;
      const jobsToStart = currentQueuedJobs.slice(0, slotsAvailable);

      for (const queuedJob of jobsToStart) {
        // Submit to API with server_ip
        const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
          body: {
            action: 'submit',
            server_ip: '69.197.145.4',
            target_port: 5005,
            markdown: queuedJob.markdown,
            subject: queuedJob.subjectName,
            grade: '12',
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
          }
        });

        if (error || !data?.job_id) {
          toast.error(`Failed to start queued job: ${queuedJob.documentName}`);
          continue;
        }

        const externalJobId = data.job_id;

        // Create database record with server_ip
        const uniqueId = Math.floor(100000000 + Math.random() * 900000000).toString();
        await supabase.from('video_generation_jobs').insert([{
          id: uniqueId,
          external_job_id: externalJobId,
          document_id: queuedJob.documentId,
          subject_id: queuedJob.subjectId,
          document_name: queuedJob.documentName,
          status: 'processing',
          server_ip: queuedJob.serverIp
        }]);

        // Add to active jobs
        const newActiveJob: JobDetailedStatus = {
          jobId: uniqueId,
          externalJobId,
          submittedAt: Date.now(),
          status: 'active',
          llm: { status: 'processing' },
          manim: { total: 0, completed: 0, failed: 0 },
          wan: { total: 0, completed: 0, failed: 0 },
          avatar: { total: 0, completed: 0, failed: 0 },
          overallProgress: 0,
          serverIp: queuedJob.serverIp,
        };

        setActiveJobs(prev => new Map(prev).set(uniqueId, newActiveJob));
        toast.success(`Started: ${queuedJob.documentName}`, { description: `Job ID: ${externalJobId}` });
        
        // Invalidate caches after job starts
        invalidateCaches();
      }

      // Remove started jobs from queue
      setQueuedJobs(prev => {
        const startedIds = new Set(jobsToStart.map(j => j.id));
        return prev
          .filter(j => !startedIds.has(j.id))
          .map((j, idx) => ({ ...j, position: idx + 1 }));
      });

      // Start polling if we have active jobs
      if (currentActiveJobs.size > 0 || jobsToStart.length > 0) {
        startPolling();
      }
    } finally {
      processingQueueRef.current = false;
    }
  }, [startPolling, invalidateCaches]);

  // Effect to process queue when capacity frees up
  useEffect(() => {
    if (activeJobs.size < MAX_CONCURRENT_PER_IP && queuedJobs.length > 0) {
      processQueue();
    }
  }, [activeJobs.size, queuedJobs.length, processQueue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Load existing processing jobs from database on mount
  useEffect(() => {
    if (!subjectId || isInitialized) return;
    
    const loadExistingJobs = async () => {
      // Fire-and-forget server-side reconciliation so the UI reflects truth ASAP
      supabase.functions.invoke('reconcile-video-jobs', { body: {} }).catch(() => {});
      try {

        const { data: dbJobs, error } = await supabase
          .from('video_generation_jobs')
          .select('*')
          .eq('subject_id', subjectId)
          .in('status', ['processing', 'pending']);
        
        if (error) {
          console.error('Failed to load existing jobs:', error);
          return;
        }
        
        if (dbJobs?.length) {
          const jobMap = new Map<string, JobDetailedStatus>();
          for (const dbJob of dbJobs) {
            if (dbJob.external_job_id) {
              jobMap.set(dbJob.id, {
                jobId: dbJob.id,
                externalJobId: dbJob.external_job_id,
                submittedAt: new Date(dbJob.created_at).getTime(),
                status: 'active',
                llm: { status: 'pending' },
                manim: { total: 0, completed: 0, failed: 0 },
                wan: { total: 0, completed: 0, failed: 0 },
                avatar: { total: 0, completed: 0, failed: 0 },
                overallProgress: dbJob.progress || 0,
                currentStep: dbJob.current_step || undefined,
                currentPhase: dbJob.current_phase || undefined,
                serverIp: dbJob.server_ip || undefined,
              });
            }
          }
          
          if (jobMap.size > 0) {
            setActiveJobs(jobMap);
            startPolling();
          }
        }
      } finally {
        setIsInitialized(true);
      }
    };
    
    loadExistingJobs();
  }, [subjectId, isInitialized, startPolling]);

  // Submit a new job
  const submitJob = useCallback(async (submission: JobSubmission): Promise<SubmitResult> => {
    const { documentId, documentName, subjectId, subjectName, markdown, serverIp } = submission;

    // Check per-IP capacity
    if (serverIp) {
      const ipCount = await checkServerIpSlots(serverIp);
      if (ipCount >= MAX_CONCURRENT_PER_IP) {
        throw new Error(`Server ${serverIp} is at capacity (${ipCount}/${MAX_CONCURRENT_PER_IP} active jobs). Please use a different server IP.`);
      }
    }

    // Check if we have capacity
    if (activeJobs.size < MAX_CONCURRENT_PER_IP) {
      // Start immediately
      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: {
          action: 'submit',
          server_ip: '69.197.145.4',
          target_port: 5005,
          markdown,
          subject: subjectName,
          grade: '12',
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
        }
      });

      if (error || !data?.job_id) {
        throw new Error(error?.message || 'Failed to submit job');
      }

      const externalJobId = data.job_id;

      // Create database record with server_ip
      const uniqueId = Math.floor(100000000 + Math.random() * 900000000).toString();
      await supabase.from('video_generation_jobs').insert([{
        id: uniqueId,
        external_job_id: externalJobId,
        document_id: documentId,
        subject_id: subjectId,
        document_name: documentName,
        status: 'processing',
        server_ip: serverIp
      }]);

      // Add to active jobs
      const newActiveJob: JobDetailedStatus = {
        jobId: uniqueId,
        externalJobId,
        submittedAt: Date.now(),
        status: 'active',
        llm: { status: 'processing' },
        manim: { total: 0, completed: 0, failed: 0 },
        wan: { total: 0, completed: 0, failed: 0 },
        avatar: { total: 0, completed: 0, failed: 0 },
        overallProgress: 0,
        serverIp,
      };

      setActiveJobs(prev => new Map(prev).set(uniqueId, newActiveJob));
      startPolling();
      
      // Invalidate caches after submission
      invalidateCaches();

      return { status: 'started', jobId: uniqueId, externalJobId };
    } else {
      // Add to queue
      const queuedJob: QueuedJob = {
        id: `queue_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        documentId,
        documentName,
        subjectId,
        subjectName,
        markdown,
        queuedAt: Date.now(),
        position: queuedJobs.length + 1,
        serverIp,
      };

      setQueuedJobs(prev => [...prev, queuedJob]);

      return { status: 'queued', position: queuedJob.position };
    }
  }, [activeJobs, queuedJobs, startPolling, invalidateCaches]);

  // Remove a job from queue
  const removeFromQueue = useCallback((jobId: string) => {
    setQueuedJobs(prev => 
      prev
        .filter(j => j.id !== jobId)
        .map((j, idx) => ({ ...j, position: idx + 1 }))
    );
  }, []);

  // Manual refresh for a specific job
  const refreshJob = useCallback(async (jobId: string) => {
    const job = activeJobs.get(jobId);
    if (!job) return;

    const details = await fetchJobDetails(job.externalJobId, job.serverIp);
    if (details) {
      setActiveJobs(prev => {
        const updated = new Map(prev);
        updated.set(jobId, { ...job, ...details });
        return updated;
      });
    }
  }, [activeJobs, fetchJobDetails]);

  return {
    // State
    activeJobs: Array.from(activeJobs.values()),
    queuedJobs,
    completedJobs,
    isPolling,
    activeCount: activeJobs.size,
    queuedCount: queuedJobs.length,
    maxConcurrent: MAX_CONCURRENT_PER_IP,
    
    // Actions
    submitJob,
    removeFromQueue,
    refreshJob,
  };
}
