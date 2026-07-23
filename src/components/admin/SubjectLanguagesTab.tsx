import { useState, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Play, Square, CheckCircle, Loader2, Clock, ChevronDown, ChevronRight,
  AlertTriangle, SkipForward, Server,
} from 'lucide-react';
import {
  SUPPORTED_LANGUAGES,
  SUPPORTED_VOICES,
} from '@/hooks/useLanguageAvatarJobs';
import { SectionAvatarProgressGrid } from './SectionAvatarProgressGrid';
import { useSectionAvatarProgress, getCompletedLanguages } from '@/hooks/useSectionAvatarProgress';

// --- Types ---
interface SubjectLanguagesTabProps {
  subjectId: string;
  subjectName: string;
  serverIp: string;
}

interface Chapter {
  id: string;
  chapter_number: number;
  title: string;
  sequence_order: number | null;
}

interface VideoJobWithDoc {
  id: string;
  external_job_id: string;
  document_name: string | null;
  server_ip: string | null;
  chapter_id: string | null;
  topic_id: string | null;
}

type JobQueueItem = {
  video_job_id: string;
  external_job_id: string;
  server_ip: string;
  chapter_title: string;
  document_name: string | null;
  languages: string[];
  status: 'pending' | 'submitted' | 'processing' | 'completed' | 'failed' | 'skipped';
  error_message: string | null;
  submitted_at: string | null;
  completed_at: string | null;
};

type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'skipped';

// --- TopicLanguageBadges: derives completion from presentation.json ---
function TopicLanguageBadges({ externalJobId, serverIp }: { externalJobId: string; serverIp: string }) {
  const { sections, avatarStatusMap, allLanguagesInData, hasProcessingAvatars } = useSectionAvatarProgress(externalJobId, serverIp);
  const completedLangs = useMemo(
    () => getCompletedLanguages(sections, avatarStatusMap, allLanguagesInData),
    [sections, avatarStatusMap, allLanguagesInData]
  );

  const allDone = sections.length > 0 && allLanguagesInData.length > 0 
    && completedLangs.length === allLanguagesInData.length;

  return (
    <div className="flex items-center gap-1 shrink-0">
      {hasProcessingAvatars && (
        <div className="flex items-center gap-1 shrink-0">
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Processing</span>
        </div>
      )}
      {allDone && (
        <div className="flex items-center gap-1 shrink-0">
          <CheckCircle className="h-3 w-3 text-emerald-500" />
          <span className="text-xs text-emerald-600">Done</span>
        </div>
      )}
      {completedLangs.map(l => (
        <Badge key={l} variant="outline" className="text-[10px] px-1.5 py-0">
          {SUPPORTED_LANGUAGES.find(x => x.code === l)?.flag || ''} {l.slice(0, 2).toUpperCase()}
        </Badge>
      ))}
    </div>
  );
}

// --- Main Component ---
export function SubjectLanguagesTab({ subjectId, subjectName, serverIp }: SubjectLanguagesTabProps) {
  const queryClient = useQueryClient();

  // Selection state
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [speaker, setSpeaker] = useState('');
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set());
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // --- Data Fetching ---
  const { data: chapters = [], isLoading: loadingChapters } = useQuery({
    queryKey: ['subject-chapters-lang', subjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subject_chapters')
        .select('id, chapter_number, title, sequence_order')
        .eq('subject_id', subjectId)
        .order('sequence_order', { ascending: true });
      if (error) throw error;
      return (data || []) as Chapter[];
    },
  });

  const { data: videoJobs = [], isLoading: loadingJobs } = useQuery({
    queryKey: ['subject-video-jobs-with-docs', subjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_generation_jobs')
        .select('id, external_job_id, document_name, server_ip, ai_assistant_documents(chapter_id, topic_id)')
        .eq('subject_id', subjectId)
        .eq('status', 'completed')
        .eq('is_published', true)
        .not('external_job_id', 'is', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map((j: any) => ({
        id: j.id,
        external_job_id: j.external_job_id,
        document_name: j.document_name,
        server_ip: j.server_ip,
        chapter_id: j.ai_assistant_documents?.chapter_id || null,
        topic_id: j.ai_assistant_documents?.topic_id || null,
      })) as VideoJobWithDoc[];
    },
  });

  // completedLangsMap removed — completion now derived from presentation.json via TopicLanguageBadges

  // Group jobs by chapter
  const { chapterJobsMap, unassignedJobs } = useMemo(() => {
    const map: Record<string, VideoJobWithDoc[]> = {};
    const unassigned: VideoJobWithDoc[] = [];
    for (const job of videoJobs) {
      if (job.chapter_id) {
        if (!map[job.chapter_id]) map[job.chapter_id] = [];
        map[job.chapter_id].push(job);
      } else {
        unassigned.push(job);
      }
    }
    return { chapterJobsMap: map, unassignedJobs: unassigned };
  }, [videoJobs]);

  // --- Active Run Polling (DB-based) ---
  const { data: activeRun, isLoading: loadingActiveRun } = useQuery({
    queryKey: ['language-generation-run', subjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('language_generation_runs')
        .select('*')
        .eq('subject_id', subjectId)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;
      return data as any;
    },
    refetchInterval: 5000, // Poll every 5 seconds
    refetchOnWindowFocus: true,
  });

  const isProcessing = !!activeRun;
  const activeJobQueue: JobQueueItem[] = activeRun?.job_queue || [];
  const activeCurrentIdx = activeRun?.current_job_index || 0;

  // Build jobStatuses from active run's job_queue
  const jobStatuses = useMemo(() => {
    const statuses: Record<string, JobStatus> = {};
    for (const qj of activeJobQueue) {
      let s: JobStatus = 'queued';
      if (qj.status === 'completed') s = 'done';
      else if (qj.status === 'failed') s = 'failed';
      else if (qj.status === 'skipped') s = 'skipped';
      else if (qj.status === 'processing' || qj.status === 'submitted') s = 'running';
      statuses[qj.video_job_id] = s;
    }
    return statuses;
  }, [activeJobQueue]);

  // Find the currently processing job ID
  const currentJobId = activeJobQueue[activeCurrentIdx]?.video_job_id || null;

  // --- Handlers ---
  const toggleLanguage = (code: string) => {
    if (isProcessing) return;
    setSelectedLanguages(prev => prev.includes(code) ? prev.filter(l => l !== code) : [...prev, code]);
  };

  const toggleChapter = (chapterId: string) => {
    if (isProcessing) return;
    setSelectedChapters(prev => {
      const next = new Set(prev);
      next.has(chapterId) ? next.delete(chapterId) : next.add(chapterId);
      return next;
    });
  };

  const selectAllChapters = () => {
    if (isProcessing) return;
    const allIds = chapters.map(c => c.id);
    if (unassignedJobs.length > 0) allIds.push('__unassigned__');
    setSelectedChapters(new Set(allIds));
  };

  const deselectAllChapters = () => {
    if (isProcessing) return;
    setSelectedChapters(new Set());
  };

  // isJobDone removed — completion derived from presentation.json

  // Count total topics in selected chapters
  const selectedTopicCount = useMemo(() => {
    let count = 0;
    for (const chId of selectedChapters) {
      if (chId === '__unassigned__') {
        count += unassignedJobs.length;
      } else {
        count += (chapterJobsMap[chId] || []).length;
      }
    }
    return count;
  }, [selectedChapters, chapterJobsMap, unassignedJobs]);

  // --- Start Generation: Insert DB row ---
  const startGeneration = useCallback(async () => {
    setShowConfirmDialog(false);

    // Build the job queue from selected chapters
    const orderedChapters = chapters
      .filter(c => selectedChapters.has(c.id))
      .sort((a, b) => (a.sequence_order ?? a.chapter_number) - (b.sequence_order ?? b.chapter_number));

    const hasUnassigned = selectedChapters.has('__unassigned__') && unassignedJobs.length > 0;

    const jobQueue: JobQueueItem[] = [];

    const addJobs = (jobs: VideoJobWithDoc[], chapterTitle: string) => {
      for (const job of jobs) {
        jobQueue.push({
          video_job_id: job.id,
          external_job_id: job.external_job_id,
          server_ip: job.server_ip || serverIp,
          chapter_title: chapterTitle,
          document_name: job.document_name,
          languages: selectedLanguages,
          status: 'pending',
          error_message: null,
          submitted_at: null,
          completed_at: null,
        });
      }
    };

    for (const chapter of orderedChapters) {
      const jobs = chapterJobsMap[chapter.id] || [];
      if (jobs.length > 0) addJobs(jobs, chapter.title);
    }
    if (hasUnassigned) addJobs(unassignedJobs, 'Unassigned');

    if (jobQueue.length === 0) {
      toast.error('No topics to process');
      return;
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    // Insert the run record
    const { error } = await supabase
      .from('language_generation_runs')
      .insert({
        subject_id: subjectId,
        subject_name: subjectName,
        status: 'processing',
        languages: selectedLanguages,
        speaker,
        server_ip: serverIp,
        job_queue: jobQueue,
        total_jobs: jobQueue.length,
        completed_jobs: 0,
        failed_jobs: 0,
        skipped_jobs: 0,
        current_job_index: 0,
        created_by: user?.id || null,
      });

    if (error) {
      toast.error(`Failed to start generation: ${error.message}`);
      return;
    }

    toast.success(`Started server-side generation for ${jobQueue.length} topics. You can close this page — processing continues in the background.`);
    queryClient.invalidateQueries({ queryKey: ['language-generation-run', subjectId] });
  }, [chapters, selectedChapters, unassignedJobs, chapterJobsMap, selectedLanguages, speaker, serverIp, subjectId, subjectName, queryClient]);

  // --- Stop: Set run status to cancelled ---
  const stopProcessing = useCallback(async () => {
    if (!activeRun) return;
    const { error } = await supabase
      .from('language_generation_runs')
      .update({ status: 'cancelled' })
      .eq('id', activeRun.id);

    if (error) {
      toast.error(`Failed to stop: ${error.message}`);
    } else {
      toast.info('Generation stopped.');
      queryClient.invalidateQueries({ queryKey: ['language-generation-run', subjectId] });
    }
  }, [activeRun, subjectId, queryClient]);

  // --- Helpers ---
  const getStatusIcon = (status: JobStatus) => {
    switch (status) {
      case 'done': return <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />;
      case 'running': return <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />;
      case 'failed': return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
      case 'skipped': return <SkipForward className="h-3.5 w-3.5 text-muted-foreground" />;
      default: return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  // getTopicCompletedLangs removed — replaced by TopicLanguageBadges component

  const canStart = selectedLanguages.length > 0 && speaker !== '' && selectedChapters.size > 0 && selectedTopicCount > 0;

  // Progress stats from active run
  const doneCount = activeRun ? (activeRun.completed_jobs + activeRun.skipped_jobs) : 0;
  const totalProcessing = activeRun ? activeRun.total_jobs : 0;
  const progressPercent = totalProcessing > 0 ? Math.round((doneCount / totalProcessing) * 100) : 0;

  if (loadingChapters || loadingJobs) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  const renderChapterBlock = (chapter: { id: string; title: string; chapter_number: number }, jobs: VideoJobWithDoc[]) => {
    const isExpanded = expandedChapter === chapter.id;
    const isSelected = selectedChapters.has(chapter.id);
    // Removed chapterDone - TopicLanguageBadges is the source of truth for completion
    const chapterRunning = isProcessing && jobs.some(j => jobStatuses[j.id] === 'running');

    return (
      <div key={chapter.id} className="border border-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-muted/30">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleChapter(chapter.id)}
            disabled={isProcessing}
          />
          <button
            className="flex items-center gap-2 flex-1 text-left"
            onClick={() => setExpandedChapter(isExpanded ? null : chapter.id)}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <span className="font-medium text-sm">
              Ch {chapter.chapter_number}: {chapter.title}
            </span>
          </button>
          <Badge variant="secondary" className="text-xs">
            {jobs.length} topic{jobs.length !== 1 ? 's' : ''}
          </Badge>
          {chapterRunning && (
            <div className="flex items-center gap-1">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs text-primary font-medium">Processing</span>
            </div>
          )}
          
        </div>

        {isExpanded && (
          <div className="divide-y divide-border/50">
            {jobs.map((job) => {
              const status = jobStatuses[job.id];
              const isTopicExpanded = expandedTopic === job.id;
              const jobServer = job.server_ip || serverIp;

              return (
                <div key={job.id}>
                  <button
                    className="w-full flex items-center gap-3 px-6 py-2.5 hover:bg-muted/30 transition-colors text-left"
                    onClick={() => setExpandedTopic(isTopicExpanded ? null : job.id)}
                  >
                    {isTopicExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className="text-sm truncate flex-1">
                      {job.document_name || job.external_job_id}
                    </span>
                    <Badge
                      variant="outline"
                      className="font-mono text-[10px] px-1.5 py-0 shrink-0 text-muted-foreground cursor-pointer hover:bg-muted"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(job.external_job_id || job.id);
                        toast.success('Job ID copied');
                      }}
                    >
                      {job.external_job_id || job.id}
                    </Badge>
                    {jobServer && (
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] px-1.5 py-0 shrink-0 text-muted-foreground flex items-center gap-1 cursor-pointer hover:bg-muted"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(jobServer);
                          toast.success('Server IP copied');
                        }}
                      >
                        <Server className="h-3 w-3" />
                        {jobServer}
                      </Badge>
                    )}
                    {status && isProcessing && status !== 'done' && status !== 'skipped' && (
                      <div className="flex items-center gap-1 shrink-0">
                        {getStatusIcon(status)}
                        <span className="text-xs capitalize text-muted-foreground">{status}</span>
                      </div>
                    )}
                    <TopicLanguageBadges externalJobId={job.external_job_id} serverIp={jobServer} />
                  </button>
                  {isTopicExpanded && (
                    <div className="px-6 pb-3">
                      <SectionAvatarProgressGrid
                        externalJobId={job.external_job_id}
                        serverIp={jobServer}
                        selectedLanguages={selectedLanguages}
                        isGenerating={status === 'running' || currentJobId === job.id}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Languages</CardTitle>
          <CardDescription>
            Generate multi-language avatars for {subjectName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Language selector */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Languages <span className="text-destructive">*</span></p>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_LANGUAGES.filter(l => l.code !== 'english').map(lang => (
                <Badge
                  key={lang.code}
                  variant={selectedLanguages.includes(lang.code) ? 'default' : 'outline'}
                  className="cursor-pointer select-none"
                  onClick={() => toggleLanguage(lang.code)}
                >
                  {lang.flag} {lang.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Speaker selector */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Speaker / Voice <span className="text-destructive">*</span></p>
            <Select value={speaker} onValueChange={setSpeaker} disabled={isProcessing}>
              <SelectTrigger className="max-w-sm">
                <SelectValue placeholder="Select a speaker..." />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {SUPPORTED_VOICES.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name} — {v.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Progress bar during processing */}
      {isProcessing && totalProcessing > 0 && (
        <Card>
          <CardContent className="py-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Progress: {doneCount}/{totalProcessing} topics</span>
              <span className="text-muted-foreground">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} />
            <p className="text-xs text-muted-foreground">
              Processing continues in the background — you can close this page safely.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Chapter selection + select all */}
      {chapters.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <Button variant="link" size="sm" className="h-auto p-0" onClick={selectAllChapters} disabled={isProcessing}>
            Select All
          </Button>
          <span className="text-muted-foreground">|</span>
          <Button variant="link" size="sm" className="h-auto p-0" onClick={deselectAllChapters} disabled={isProcessing}>
            Deselect All
          </Button>
          {selectedChapters.size > 0 && (
            <Badge variant="secondary" className="ml-2">
              {selectedChapters.size} chapter{selectedChapters.size !== 1 ? 's' : ''}, {selectedTopicCount} topic{selectedTopicCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      )}

      {/* Chapter list */}
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {chapters.map(chapter => {
          const jobs = chapterJobsMap[chapter.id] || [];
          if (jobs.length === 0) return null;
          return renderChapterBlock(chapter, jobs);
        })}

        {unassignedJobs.length > 0 && renderChapterBlock(
          { id: '__unassigned__', title: 'Unassigned', chapter_number: 0 },
          unassignedJobs
        )}
      </div>

      {videoJobs.length === 0 && (
        <p className="text-sm text-muted-foreground">No completed video jobs found for this subject.</p>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        {!isProcessing ? (
          <Button
            onClick={() => setShowConfirmDialog(true)}
            disabled={!canStart}
            className="gap-2"
          >
            <Play className="h-4 w-4" /> Start Generation
          </Button>
        ) : (
          <Button variant="destructive" onClick={stopProcessing} className="gap-2">
            <Square className="h-4 w-4" /> Stop
          </Button>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Language Generation</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>You are about to generate avatars with the following settings:</p>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium text-foreground">Languages: </span>
                    <span className="flex flex-wrap gap-1 mt-1">
                      {selectedLanguages.map(l => {
                        const lang = SUPPORTED_LANGUAGES.find(x => x.code === l);
                        return (
                          <Badge key={l} variant="default" className="text-xs">
                            {lang?.flag} {lang?.name || l}
                          </Badge>
                        );
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-foreground">Speaker: </span>
                    <Badge variant="secondary">
                      {SUPPORTED_VOICES.find(v => v.id === speaker)?.name || speaker}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-foreground">Scope: </span>
                    <span className="text-sm text-muted-foreground">
                      {selectedChapters.size} chapter{selectedChapters.size !== 1 ? 's' : ''}, {selectedTopicCount} topic{selectedTopicCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Topics will be processed sequentially on the server. You can safely close this page — generation continues in the background.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={startGeneration}>
              Confirm & Generate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
