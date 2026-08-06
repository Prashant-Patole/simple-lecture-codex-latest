import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCheckerReviews } from "@/hooks/useCheckerReviews";
import { CheckerReviewPanel } from "@/components/checker/CheckerReviewPanel";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Play, Video, Sparkles, X, Globe, CheckCircle, Megaphone, Loader2 } from "lucide-react";
import { useTopicVideos, INDIAN_LANGUAGES, TopicVideo } from "@/hooks/useTopicVideos";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EducationalVideoPlayerDialog } from "./player/EducationalVideoPlayerDialog";
import { V4PlayerDialog } from "./V4PlayerDialog";
import { V4Notes } from "./v4/V4Notes";

import { extractJobIdFromUrl } from "./player/utils/mediaResolver";
import { useLanguageTopupStatus } from "@/hooks/useLanguageTopup";
import { useAvailableLanguages, getLanguageInfo } from "@/hooks/useAvailableLanguages";
import { usePublishedAILectures, useAILectureDetails, PublishedAILecture } from "@/hooks/usePublishedAILectures";
import { useMarkVideoWatched, useUpdateVideoWatchTime } from "@/hooks/useMarkVideoWatched";
import type { PresentationReview } from "@/hooks/useVideoGenerationJobs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

import type { QuickActionItem } from './player/EducationalVideoPlayerDialog';

const PENDING_LECTURE_KEY = 'preview_pending_lecture';
const PENDING_TTL_MS = 15 * 60 * 1000;
const PREVIEW_REPLAY_LOG_PREFIX = '[PreviewLectureReplay]';

const logPreviewReplay = (event: string, details?: Record<string, unknown>) => {
  if (typeof console === 'undefined') return;
  if (console.groupCollapsed) {
    console.groupCollapsed(`${PREVIEW_REPLAY_LOG_PREFIX} ${event}`);
    if (details) console.log(details);
    console.groupEnd?.();
    return;
  }
  console.log(`${PREVIEW_REPLAY_LOG_PREFIX} ${event}`, details || {});
};

type PendingLecture = {
  courseId?: string;
  topicId?: string;
  chapterId?: string;
  lectureId?: string;
  language?: string | null;
  legacy?: boolean;
  ts: number;
};

const writePendingLecture = (payload: Omit<PendingLecture, 'ts'>, source: 'published-card' | 'legacy-card') => {
  const savedPayload = { ...payload, ts: Date.now() };
  try {
    sessionStorage.setItem(PENDING_LECTURE_KEY, JSON.stringify(savedPayload));
    logPreviewReplay('pending-write', { source, payload: savedPayload });
  } catch (error) {
    logPreviewReplay('pending-write-failed', { source, payload: savedPayload, error });
  }
};

const readPendingLecture = (): PendingLecture | null => {
  try {
    const raw = sessionStorage.getItem(PENDING_LECTURE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingLecture;
    if (!p?.ts || Date.now() - p.ts > PENDING_TTL_MS) {
      sessionStorage.removeItem(PENDING_LECTURE_KEY);
      return null;
    }
    return p;
  } catch {
    return null;
  }
};

const clearPendingLecture = () => {
  try { sessionStorage.removeItem(PENDING_LECTURE_KEY); } catch {}
};

// V4 player is only enabled for the first chapter of a subject.
// Every other chapter continues to use the legacy EducationalVideoPlayerDialog (V3).
const isV4EligibleChapter = (chapterNumber?: number | null) =>
  typeof chapterNumber === 'number' && chapterNumber === 1;

interface RecordedVideosProps {
  topicId?: string;
  chapterId?: string;
  subjectId?: string;
  topicVideoId?: string;
  topicVideoPlatform?: string;
  topicTitle?: string;
  aiGeneratedVideoUrl?: string;
  aiPresentationJson?: PresentationReview | null;
  courseId?: string;
  availableLanguages?: string[] | null;
  languageTopupPrice?: number;
  languageTopupOriginalPrice?: number;
  isChecker?: boolean;
  onNavigateTab?: (tab: string) => void;
  quickActions?: QuickActionItem[];
  onRequireAuth?: () => boolean;
  /** When set, treat as preferred initial language for free-preview visitors. */
  restrictToLanguage?: string | null;
  /** Chapter number — controls whether V4 player is eligible (Chapter 1 only). */
  chapterNumber?: number | null;
}

export const RecordedVideos = ({ 
  topicId, 
  chapterId,
  subjectId,
  topicVideoId, 
  topicVideoPlatform, 
  topicTitle, 
  aiGeneratedVideoUrl, 
  aiPresentationJson,
  courseId,
  availableLanguages,
  languageTopupPrice,
  languageTopupOriginalPrice,
  isChecker = false,
  onNavigateTab,
  quickActions,
  onRequireAuth,
  restrictToLanguage,
  chapterNumber,
}: RecordedVideosProps) => {
  const navigate = useNavigate();
  const { data: additionalVideos, isLoading } = useTopicVideos(topicId);
  const { data: topupStatus } = useLanguageTopupStatus(courseId);
  const {
    data: publishedLectures,
    isLoading: lecturesLoading,
    isFetching: lecturesFetching,
    error: lecturesError,
    status: lecturesStatus,
    fetchStatus: lecturesFetchStatus,
    refetch: refetchPublishedLectures,
  } = usePublishedAILectures(topicId, chapterId);

  const markWatched = useMarkVideoWatched();
  const updateWatchTime = useUpdateVideoWatchTime();
  
  // Checker reviews for lectures
  const lectureIds = useMemo(() => 
    (publishedLectures || []).map(l => l.id), 
    [publishedLectures]
  );
  const { data: lectureReviews } = useCheckerReviews("lecture", isChecker ? lectureIds : []);
  const getReview = (id: string) => lectureReviews?.find(r => r.entity_id === id);

  const [selectedVideo, setSelectedVideo] = useState<TopicVideo | null>(null);
  const [filterLanguage, setFilterLanguage] = useState<string>("all");
  const [watchingLectureId, setWatchingLectureId] = useState<string | null>(null);
  // In free-preview mode we default to the preferred language (Kannada). The user can
  // still switch by clicking the English badge (which sets this back to null).
  const [selectedAILanguage, setSelectedAILanguage] = useState<string | null>(restrictToLanguage ?? null);
  const [activeAILanguage, setActiveAILanguage] = useState<string | null>(null);
  // OPTIMIZED: Lazy-load heavy presentation_json only when opening player dialog
  const { data: lectureDetails } = useAILectureDetails(watchingLectureId || undefined);
  
  // Get the watching lecture from list to access metadata
  const watchingLecture = useMemo(() => 
    publishedLectures?.find(l => l.id === watchingLectureId) || null, 
    [publishedLectures, watchingLectureId]
  );
  
  // Timer tracking for AI lectures
  const lectureStartTimeRef = useRef<number | null>(null);
  const currentLectureTitleRef = useRef<string | null>(null);

  // "My Notes" — controlled V4 notes dialog triggered from a lecture card.
  // We keep the *target lecture* in state so the dialog always loads the same
  // note row the player would, and we close the dialog when the user switches
  // to a different lecture (or any other video) so notes from one lecture
  // never leak into another lecture's notes panel.
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesTarget, setNotesTarget] = useState<{
    jobId: string;
    lectureTitle?: string;
  } | null>(null);

  // Auto-open after auth: if redirected back with ?autoplay=1, open the lecture saved before login.
  const { isAuthenticated, user } = useAuth();
  const autoOpenedRef = useRef(false);
  const [legacyAutoOpen, setLegacyAutoOpen] = useState(false);
  const postLoginRefetchedRef = useRef(false);

  // One-shot: when we land back authenticated with ?autoplay=1, force a refetch
  // of published lectures so a stale anonymous empty cache doesn't push us into
  // the legacy fallback player.
  useEffect(() => {
    if (postLoginRefetchedRef.current) return;
    if (!isAuthenticated) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autoplay') !== '1') return;
    postLoginRefetchedRef.current = true;
    logPreviewReplay('auto-open-post-login-refetch', { courseId, topicId, chapterId });
    refetchPublishedLectures();
  }, [isAuthenticated, courseId, topicId, chapterId, refetchPublishedLectures]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasAutoplay = params.get('autoplay') === '1';
    const pending = readPendingLecture();
    const matchesScope = !!pending &&
      (!pending.courseId || pending.courseId === courseId) &&
      ((pending.topicId && pending.topicId === topicId) ||
       (pending.chapterId && pending.chapterId === chapterId));

    logPreviewReplay('auto-open-effect', {
      autoOpened: autoOpenedRef.current,
      hasAutoplay,
      isAuthenticated,
      lecturesLoading,
      lecturesFetching,
      pending,
      matchesScope,
      courseId,
      topicId,
      chapterId,
      publishedLectureIds: publishedLectures?.map(l => l.id) || [],
    });

    if (autoOpenedRef.current) return;
    if (!isAuthenticated) return;
    if (!hasAutoplay) return;
    // Wait for both initial load AND any in-flight refetch (e.g. the post-login
    // invalidation triggered by AuthContext) before deciding which player to open.
    if (lecturesLoading || lecturesFetching) {
      logPreviewReplay('auto-open-waiting-for-lectures', { courseId, topicId, chapterId, pending, lecturesLoading, lecturesFetching });
      return;
    }

    if (!pending) {
      // No pending payload; just strip the autoplay flag.
      autoOpenedRef.current = true;
      params.delete('autoplay');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
      logPreviewReplay('auto-open-no-pending', { action: 'cleared-autoplay' });
      return;
    }

    if (!matchesScope) return; // wait for the right instance to mount

    const target =
      (pending.lectureId && publishedLectures?.find(l => l.id === pending.lectureId)) ||
      publishedLectures?.[0];

    if (target) {
      autoOpenedRef.current = true;
      clearPendingLecture();
      params.delete('autoplay');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));

      const lectureTitle = topicTitle || target.document_name || 'AI Lecture';
      lectureStartTimeRef.current = Date.now();
      currentLectureTitleRef.current = lectureTitle;
      markWatched.mutate({
        videoTitle: lectureTitle,
        subjectId,
        chapterId,
        topicId,
      });
      setSelectedAILanguage(pending.language ?? null);
      setActiveAILanguage(pending.language ?? null);
      setWatchingLectureId(target.id);
      logPreviewReplay('auto-open-published-target', {
        pending,
        targetLectureId: target.id,
        targetExternalJobId: target.external_job_id,
        player: target.external_job_id ? 'v4' : 'educational',
      });
      return;
    }

    // No published target after an authenticated, non-fetching read.
    // Only NOW is it safe to fall back to the legacy player.
    if (pending.legacy) {
      autoOpenedRef.current = true;
      clearPendingLecture();
      params.delete('autoplay');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
      setSelectedAILanguage(pending.language ?? null);
      setLegacyAutoOpen(true);
      logPreviewReplay('auto-open-legacy-target', { pending, reason: 'no-published-lecture-target' });
      return;
    }

    logPreviewReplay('auto-open-no-published-target', {
      pending,
      reason: 'published lecture payload found but publishedLectures is empty or missing target',
      publishedLecturesCount: publishedLectures?.length || 0,
    });
  }, [isAuthenticated, lecturesLoading, lecturesFetching, publishedLectures, courseId, topicId, chapterId, topicTitle, subjectId, markWatched]);


  // "My Notes" affordance — for every published lecture, look up whether the
  // signed-in student has ever saved a note against the same `(job_id,
  // subject_id, chapter_id, topic_id)` tuple that V4Notes uses. We pull *all*
  // notes for this scope in one round trip and build a Set of job ids the
  // card can check against, instead of firing a query per card.
  const { data: notesJobIds } = useQuery<Set<string>>({
    queryKey: [
      'student-lecture-notes-exists',
      user?.id ?? null,
      subjectId ?? null,
      chapterId ?? null,
      topicId ?? null,
      (publishedLectures || []).map((l) => l.external_job_id).filter(Boolean).join(',') || null,
    ],
    enabled: !!user && !!topicId,
    staleTime: 30_000,
    queryFn: async () => {
      const ids = new Set<string>();
      const jobs = (publishedLectures || [])
        .map((l) => l.external_job_id)
        .filter((id): id is string => !!id);

      if (jobs.length === 0) return ids;

      let query = supabase
        .from('student_lecture_notes')
        .select('job_id')
        .eq('student_id', user!.id);

      query = subjectId ? query.eq('subject_id', subjectId) : query.is('subject_id', null);
      query = chapterId ? query.eq('chapter_id', chapterId) : query.is('chapter_id', null);
      query = query.eq('topic_id', topicId);
      query = query.in('job_id', jobs);

      const { data, error } = await query;
      if (error) {
        console.error('[RecordedVideos] notes-existence lookup failed', error);
        return ids;
      }
      for (const row of data || []) {
        if (row.job_id) ids.add(row.job_id);
      }
      return ids;
    },
  });
  // Check if there are any AI lectures (from published jobs or legacy props)
  const hasPublishedLectures = (publishedLectures?.length ?? 0) > 0;
  const hasLegacyAILecture = !hasPublishedLectures && (aiPresentationJson || aiGeneratedVideoUrl);

  const hasLegacyNotes = useQuery<boolean>({
    queryKey: [
      'student-lecture-notes-exists-legacy',
      user?.id ?? null,
      subjectId ?? null,
      chapterId ?? null,
      topicId ?? null,
      extractJobIdFromUrl(aiGeneratedVideoUrl) ?? null,
    ],
    enabled: !!user && !!topicId && !!hasLegacyAILecture && !!extractJobIdFromUrl(aiGeneratedVideoUrl),
    staleTime: 30_000,
    queryFn: async () => {
      const legacyJobId = extractJobIdFromUrl(aiGeneratedVideoUrl);
      if (!legacyJobId) return false;
      let query = supabase
        .from('student_lecture_notes')
        .select('id')
        .eq('student_id', user!.id)
        .eq('job_id', legacyJobId);
      query = subjectId ? query.eq('subject_id', subjectId) : query.is('subject_id', null);
      query = chapterId ? query.eq('chapter_id', chapterId) : query.is('chapter_id', null);
      query = query.eq('topic_id', topicId);
      const { data, error } = await query.maybeSingle();
      if (error) {
        console.error('[RecordedVideos] legacy notes-existence lookup failed', error);
        return false;
      }
      return !!data;
    },
  }).data === true;


  // Show unlock button only if course has multiple languages AND user hasn't purchased.
  // Hide entirely for free-preview visitors (restrictToLanguage is set) — they're on a
  // free Kannada preview and shouldn't be prompted to purchase a language pack.
  const showUnlockButton = 
    !restrictToLanguage &&
    courseId && 
    availableLanguages && 
    availableLanguages.length > 1 && 
    !topupStatus?.hasPurchased &&
    (languageTopupPrice || 0) > 0;

  // Combine the direct topic video with additional videos from topic_videos table
  const allVideos = useMemo(() => {
    const videos: TopicVideo[] = [];
    
    // Add direct video from subject_topics if exists
    if (topicVideoId && topicVideoPlatform) {
      videos.push({
        id: `topic-direct-${topicId}`,
        topic_id: topicId,
        video_name: topicTitle || "Topic Video",
        language: "en",
        video_platform: topicVideoPlatform as "youtube" | "vimeo",
        video_id: topicVideoId,
        description: null,
        display_order: 0,
        is_active: true,
        created_at: null,
        updated_at: null,
      });
    }
    
    // Add additional videos from topic_videos table
    if (additionalVideos?.length) {
      videos.push(...additionalVideos);
    }
    
    return videos;
  }, [topicId, topicVideoId, topicVideoPlatform, topicTitle, additionalVideos]);

  // Get unique languages from videos
  const videoLanguages = [...new Set(allVideos.map(v => v.language))];

  const filteredVideos = filterLanguage === "all" 
    ? allVideos
    : allVideos.filter(v => v.language === filterLanguage);

  // Get embed URL based on platform
  const getEmbedUrl = (video: TopicVideo) => {
    if (video.video_platform === "youtube") {
      return `https://www.youtube.com/embed/${video.video_id}?autoplay=1`;
    } else if (video.video_platform === "vimeo") {
      return `https://player.vimeo.com/video/${video.video_id}?autoplay=1`;
    }
    return "";
  };

  // Get language label
  const getLanguageLabel = (langValue: string) => {
    const lang = INDIAN_LANGUAGES.find(l => l.value === langValue);
    return lang?.label || langValue;
  };

  useEffect(() => {
    logPreviewReplay('render-decision', {
      courseId,
      topicId,
      chapterId,
      isAuthenticated,
      lecturesLoading,
      lecturesStatus,
      lecturesFetchStatus,
      lecturesError: lecturesError ? String((lecturesError as Error)?.message || lecturesError) : null,
      publishedLecturesCount: publishedLectures?.length || 0,
      publishedLectureIds: publishedLectures?.map(l => l.id) || [],
      hasPublishedLectures,
      hasLegacyAILecture: !!hasLegacyAILecture,
      hasAiGeneratedVideoUrl: !!aiGeneratedVideoUrl,
      hasAiPresentationJson: !!aiPresentationJson,
    });
  }, [courseId, topicId, chapterId, isAuthenticated, lecturesLoading, lecturesStatus, lecturesFetchStatus, lecturesError, publishedLectures, hasPublishedLectures, hasLegacyAILecture, aiGeneratedVideoUrl, aiPresentationJson]);

  useEffect(() => {
    if (!watchingLecture) return;
    logPreviewReplay('player-open-branch', {
      branch: watchingLecture.external_job_id &&
        (watchingLecture.is_marketing || isV4EligibleChapter(chapterNumber))
          ? 'v4-player'
          : 'educational-player',
      lectureId: watchingLecture.id,
      externalJobId: watchingLecture.external_job_id,
      courseId,
      topicId,
      chapterId,
    });
  }, [watchingLecture, courseId, topicId, chapterId]);


  if ((isLoading || lecturesLoading) && !topicVideoId) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map(i => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (allVideos.length === 0 && !hasPublishedLectures && !hasLegacyAILecture) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Videos Available</h3>
            <p className="text-muted-foreground">
              Videos for this topic will be added soon.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Language Tabs */}
      {allVideos.length > 0 && (
        <Tabs value={filterLanguage} onValueChange={setFilterLanguage} className="w-full">
          <TabsList className="h-auto flex-wrap gap-1">
            <TabsTrigger value="all" className="text-xs px-3 py-1.5">
              All ({allVideos.length})
            </TabsTrigger>
            {videoLanguages.map((lang) => {
              const langLabel = getLanguageLabel(lang);
              const count = allVideos.filter(v => v.language === lang).length;
              return (
                <TabsTrigger key={lang} value={lang} className="text-xs px-3 py-1.5">
                  {langLabel} ({count})
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      )}

      {/* Video Grid */}
      <div className={isChecker ? "space-y-4" : "grid gap-4 md:grid-cols-2 lg:grid-cols-3"}>
        {/* Published AI Lectures from video_generation_jobs - Multiple lectures supported */}
        {publishedLectures?.map((lecture) => {
          const review = getReview(lecture.id);
          return isChecker ? (
            <div key={lecture.id} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                {review?.is_approved && (
                  <Badge className="absolute top-2 right-2 z-10 bg-green-600 text-white text-[10px]">
                    <CheckCircle className="h-3 w-3 mr-0.5" />Approved
                  </Badge>
                )}
            <AILectureCard
                  lecture={lecture}
                  topicTitle={topicTitle}
                  courseId={courseId}
                  showUnlockButton={showUnlockButton}
                  languageTopupPrice={languageTopupPrice}
                  purchasedLanguages={topupStatus?.purchasedLanguages || []}
                  courseAvailableLanguages={availableLanguages}
                  selectedAILanguage={selectedAILanguage}
                  onLanguageChange={setSelectedAILanguage}
                restrictToLanguage={restrictToLanguage ?? null}
                onWatch={() => {
                  if (onRequireAuth?.()) {
                    writePendingLecture({ courseId, topicId, chapterId, lectureId: lecture.id, language: selectedAILanguage, legacy: false }, 'published-card');
                    return true;
                  }
                  const lectureTitle = topicTitle || lecture.document_name || 'AI Lecture';
                  lectureStartTimeRef.current = Date.now();
                  currentLectureTitleRef.current = lectureTitle;
                  setActiveAILanguage(selectedAILanguage);
                  setWatchingLectureId(lecture.id);
                  return false;
                }}
                onUnlock={() => navigate(`/language-topup/${courseId}`)}
              />

              </div>
              <CheckerReviewPanel
                entityType="lecture"
                entityId={lecture.id}
                existingComment={review?.comment || ""}
                isApproved={review?.is_approved || false}
              />
            </div>
          ) : (
            <React.Fragment key={lecture.id}>
              <AILectureCard
                lecture={lecture}
                topicTitle={topicTitle}
                courseId={courseId}
                showUnlockButton={showUnlockButton}
                languageTopupPrice={languageTopupPrice}
                purchasedLanguages={topupStatus?.purchasedLanguages || []}
                courseAvailableLanguages={availableLanguages}
                selectedAILanguage={selectedAILanguage}
                onLanguageChange={setSelectedAILanguage}
                restrictToLanguage={restrictToLanguage ?? null}
                onWatch={() => {
                  if (onRequireAuth?.()) {
                    writePendingLecture({ courseId, topicId, chapterId, lectureId: lecture.id, language: selectedAILanguage, legacy: false }, 'published-card');
                    return true;
                  }
                  const lectureTitle = topicTitle || lecture.document_name || 'AI Lecture';
                  lectureStartTimeRef.current = Date.now();
                  currentLectureTitleRef.current = lectureTitle;
                  setActiveAILanguage(selectedAILanguage);
                  setWatchingLectureId(lecture.id);
                  return false;
                }}
                onUnlock={() => navigate(`/language-topup/${courseId}`)}
              />
            </React.Fragment>

          );
        })}

        {/* Legacy AI Lecture - Backward compatibility for topics with old ai_presentation_json */}
        {hasLegacyAILecture && (
          <LegacyAILectureCard
            topicTitle={topicTitle}
            aiPresentationJson={aiPresentationJson}
            aiGeneratedVideoUrl={aiGeneratedVideoUrl}
            courseId={courseId}
            subjectId={subjectId}
            chapterId={chapterId}
            topicId={topicId}
            showUnlockButton={showUnlockButton}
            purchasedLanguages={topupStatus?.purchasedLanguages || []}
            courseAvailableLanguages={availableLanguages}
            selectedAILanguage={selectedAILanguage}
            onLanguageChange={setSelectedAILanguage}
            restrictToLanguage={restrictToLanguage ?? null}
            chapterNumber={chapterNumber}
            onUnlock={() => navigate(`/language-topup/${courseId}`)}
            autoOpen={legacyAutoOpen}
            onAutoOpenConsumed={() => setLegacyAutoOpen(false)}
            onWatch={() => {
              if (onRequireAuth?.()) {
                writePendingLecture({ courseId, topicId, chapterId, language: selectedAILanguage, legacy: true }, 'legacy-card');
                return true;
              }
              markWatched.mutate({
                videoTitle: `${topicTitle} - AI Generated Lecture`,
                subjectId,
                chapterId,
                topicId,
              });
              return false;
            }}
          />
        )}

        {/* Regular Videos */}
        {filteredVideos.map((video) => (
          <Card
            key={video.id}
            className="cursor-pointer hover:border-primary transition-colors overflow-hidden"
            onClick={() => {
              if (onRequireAuth?.()) return;
              // Mark as watched when clicked
              markWatched.mutate({
                videoTitle: video.video_name,
                subjectId,
                chapterId,
                topicId,
              });
              setSelectedVideo(video);
            }}
          >
            <CardHeader className="p-0">
              <div className="relative aspect-video bg-muted overflow-hidden">
                {/* Thumbnail based on platform */}
                {video.video_platform === "youtube" ? (
                  <img
                    src={`https://img.youtube.com/vi/${video.video_id}/hqdefault.jpg`}
                    alt={video.video_name}
                    className="w-full h-full object-cover"
                  />
                ) : video.video_platform === "vimeo" ? (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <Video className="h-12 w-12 text-primary/50" />
                  </div>
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Video className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                
                {/* Play overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <div className="bg-primary rounded-full p-4">
                    <Play className="h-6 w-6 text-primary-foreground" />
                  </div>
                </div>

                {/* Platform badge */}
                <Badge 
                  variant="secondary" 
                  className="absolute top-2 left-2 capitalize"
                >
                  {video.video_platform}
                </Badge>

                {/* Language badge */}
                <Badge 
                  className="absolute top-2 right-2 bg-primary/90"
                >
                  {getLanguageLabel(video.language)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <h3 className="font-semibold mb-1 line-clamp-2">{video.video_name}</h3>
              {video.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {video.description}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Video Player Dialog for YouTube/Vimeo */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>{selectedVideo?.video_name}</DialogTitle>
          </DialogHeader>
          {selectedVideo && (
            <div className="space-y-4 p-4 pt-2">
              <div className="aspect-video rounded-lg overflow-hidden bg-black">
                <iframe
                  src={getEmbedUrl(selectedVideo)}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {selectedVideo.video_platform}
                  </Badge>
                  <Badge>
                    {getLanguageLabel(selectedVideo.language)}
                  </Badge>
                </div>
                <Button variant="outline" onClick={() => setSelectedVideo(null)}>
                  Close
                </Button>
              </div>

              {selectedVideo.description && (
                <p className="text-sm text-muted-foreground">
                  {selectedVideo.description}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AI Lecture Player Dialog - For published lectures from jobs */}
      {watchingLecture && (
        watchingLecture.external_job_id &&
        (watchingLecture.is_marketing || isV4EligibleChapter(chapterNumber)) ? (
          <V4PlayerDialog
            open={!!watchingLecture}
            onOpenChange={(open) => {
              if (!open) {
                if (lectureStartTimeRef.current && currentLectureTitleRef.current) {
                  const secondsWatched = Math.floor((Date.now() - lectureStartTimeRef.current) / 1000);
                  if (secondsWatched > 0) {
                    updateWatchTime.mutate({
                      videoTitle: currentLectureTitleRef.current,
                      additionalSeconds: secondsWatched,
                    });
                  }
                  lectureStartTimeRef.current = null;
                  currentLectureTitleRef.current = null;
                }
                setWatchingLectureId(null);
                setActiveAILanguage(null);
              }
            }}
            documentName={topicTitle || watchingLecture.document_name || 'AI Lecture'}
            initialJobId={watchingLecture.external_job_id}
            initialLanguage={activeAILanguage ?? selectedAILanguage}
            restrictToLanguage={restrictToLanguage ?? null}
            topicId={topicId}
            chapterId={chapterId}
            subjectId={subjectId}
            courseId={courseId}
          />
        ) : (
          <EducationalVideoPlayerDialog
            open={!!watchingLecture}
            onOpenChange={(open) => {
              if (!open) {
                // Save watch time when closing
                if (lectureStartTimeRef.current && currentLectureTitleRef.current) {
                  const secondsWatched = Math.floor((Date.now() - lectureStartTimeRef.current) / 1000);
                  if (secondsWatched > 0) {
                    updateWatchTime.mutate({
                      videoTitle: currentLectureTitleRef.current,
                      additionalSeconds: secondsWatched,
                    });
                  }
                  lectureStartTimeRef.current = null;
                  currentLectureTitleRef.current = null;
                }
                setWatchingLectureId(null);
                setActiveAILanguage(null);
              }
            }}
            presentationData={lectureDetails?.presentation_json || undefined}
            externalJobId={watchingLecture.external_job_id || undefined}
            documentName={topicTitle || watchingLecture.document_name || 'AI Lecture'}
            initialLanguage={activeAILanguage ?? selectedAILanguage}
            purchasedLanguages={topupStatus?.purchasedLanguages || []}
            courseAvailableLanguages={availableLanguages}
            quickActions={quickActions}
            onQuickAction={onNavigateTab}
            topicId={topicId}
            chapterId={chapterId}
            subjectId={subjectId}
            courseId={courseId}
          />
        )
      )}

    </div>
  );
};

// Sub-component for AI Lecture Cards (from published jobs)
interface AILectureCardProps {
  lecture: PublishedAILecture;
  topicTitle?: string;
  courseId?: string;
  showUnlockButton?: boolean;
  languageTopupPrice?: number;
  purchasedLanguages?: string[];
  courseAvailableLanguages?: string[] | null;
  selectedAILanguage: string | null;
  onLanguageChange: (lang: string | null) => void;
  onWatch: () => boolean | void;
  onUnlock: () => void;
  /** Free-preview: lock UI to this language (hide English & unlock CTA). */
  restrictToLanguage?: string | null;
}

const AILectureCard = ({
  lecture,
  topicTitle,
  showUnlockButton,
  purchasedLanguages = [],
  courseAvailableLanguages,
  selectedAILanguage,
  onLanguageChange,
  onWatch,
  onUnlock,
  restrictToLanguage,
}: AILectureCardProps) => {
  const { languages: allAiLanguages, isLoading: languagesLoading } = useAvailableLanguages(lecture.external_job_id);

  const isPreviewMode = !!restrictToLanguage;

  // Language badges shown next to the card.
  // - Free-preview: show every language available for this job (English + others).
  // - Paid: only show purchased non-English languages (English badge is rendered separately).
  const aiLanguages = isPreviewMode
    ? allAiLanguages.filter(lang => lang !== 'english')
    : allAiLanguages.filter(lang => {
        if (!courseAvailableLanguages || courseAvailableLanguages.length <= 1) return false;
        return purchasedLanguages.includes(lang);
      });


  useEffect(() => {
    console.log('[AI Lecture Language Badges]', {
      lectureId: lecture.id,
      externalJobId: lecture.external_job_id,
      topicTitle,
      allAiLanguages,
      purchasedLanguages,
      courseAvailableLanguages,
      renderedBadgeLanguages: aiLanguages,
      isLoading: languagesLoading,
    });
  }, [lecture.id, lecture.external_job_id, topicTitle, allAiLanguages, purchasedLanguages, courseAvailableLanguages, aiLanguages, languagesLoading]);

  const isMarketing = lecture.is_marketing;

  return (
    <Card
      className={
        isMarketing
          ? "cursor-pointer transition-all overflow-hidden border-2 border-accent hover:border-accent/70 shadow-lg shadow-accent/10 hover:shadow-accent/20 relative"
          : "cursor-pointer hover:border-primary transition-colors overflow-hidden border-primary/30 dark:border-primary"
      }
      onClick={onWatch}
    >
      <div className="flex flex-row md:flex-col">
        <CardHeader className="p-0">
          <div
            className={
              isMarketing
                ? "relative w-28 h-28 shrink-0 md:w-full md:h-auto md:aspect-video bg-gradient-to-br from-accent via-accent/70 to-primary flex items-center justify-center overflow-hidden"
                : "relative w-28 h-28 shrink-0 md:w-full md:h-auto md:aspect-video bg-gradient-to-br from-slate-900 via-primary-dark to-primary-dark flex items-center justify-center overflow-hidden"
            }
          >
            {/* Subtle radial glow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
            
            {/* Logo and content */}
            <div className="relative z-10 text-center space-y-2 md:space-y-4">
              {/* SimpleLectures Logo */}
              <div className="flex items-center justify-center gap-1 md:gap-2">
                <span className="text-lg md:text-2xl">{isMarketing ? '🎬' : '📚'}</span>
                <span className="text-lg md:text-2xl font-light tracking-wide text-white">
                  Simple<span className="font-semibold">Lectures</span>
                </span>
              </div>
              
              {/* Decorative gradient line - hidden on mobile */}
              <div className="hidden md:block w-32 h-0.5 mx-auto bg-gradient-to-r from-transparent via-primary to-transparent" />
              
              {/* Play button */}
              <div className="w-10 h-10 md:w-14 md:h-14 mx-auto rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                <Play className="h-4 w-4 md:h-6 md:w-6 text-white ml-0.5" fill="white" />
              </div>
              
              {/* Tagline - hidden on mobile */}
              <div className="hidden md:flex items-center justify-center gap-1.5 text-white/90 text-sm">
                <Sparkles className="h-3.5 w-3.5" />
                <span>AI-Powered Learning</span>
              </div>
            </div>

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-primary/20 opacity-0 hover:opacity-100 transition-opacity duration-300" />
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-between py-2 px-3 md:pt-4 md:px-6 md:pb-6">
          <div>
            <h3 className="font-semibold text-sm md:text-base line-clamp-2">{topicTitle || lecture.document_name || 'AI Lecture'}</h3>
            <p className="text-xs md:text-sm text-muted-foreground mb-1.5 md:mb-2">
              AI-generated lecture
            </p>
          </div>
          
          {/* Language Selection Badges */}
          {(aiLanguages.length > 0 || !languagesLoading) && (
            <div className="flex flex-wrap items-center gap-1 md:gap-1.5 mb-1.5 md:mb-3">
              <Badge
                variant={selectedAILanguage === null ? "default" : "outline"}
                className="cursor-pointer text-[10px] md:text-xs hover:bg-primary/80 transition-colors"
                onClick={(e) => { e.stopPropagation(); onLanguageChange(null); }}
              >
                🇬🇧 EN
              </Badge>
              {languagesLoading ? (
                <Skeleton className="h-5 w-16" />
              ) : (
                aiLanguages.map((lang) => {
                  const langInfo = getLanguageInfo(lang);
                  return (
                    <Badge
                      key={lang}
                      variant={selectedAILanguage === lang ? "default" : "outline"}
                      className="cursor-pointer text-[10px] md:text-xs hover:bg-primary/80 transition-colors"
                      onClick={(e) => { e.stopPropagation(); onLanguageChange(lang); }}
                    >
                      {langInfo?.flag} {langInfo?.name || lang}
                    </Badge>
                  );
                })
              )}
            </div>
          )}

          {/* Unlock More Languages Button — never shown in free-preview mode */}
          {showUnlockButton && !isPreviewMode && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onUnlock();
              }}
              className="relative w-full mt-1 md:mt-3 text-xs md:text-sm py-1 md:py-2 bg-gradient-to-r from-primary via-primary to-primary hover:from-primary-dark hover:via-primary hover:to-primary-dark transition-all duration-300 border-0 overflow-hidden"
            >
              <span className="absolute inset-0 overflow-hidden pointer-events-none">
                <span className="absolute h-full w-8 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12 animate-shine" />
              </span>
              <Globe className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="font-semibold">Unlock Your Language</span>
              <Sparkles className="h-2.5 w-2.5 md:h-3 md:w-3 ml-1 text-yellow-300" />
            </Button>
          )}

        </CardContent>
      </div>
    </Card>
  );
};

// Legacy AI Lecture Card - For backward compatibility with old ai_presentation_json on topics
interface LegacyAILectureCardProps {
  topicTitle?: string;
  aiPresentationJson?: PresentationReview | null;
  aiGeneratedVideoUrl?: string;
  courseId?: string;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  showUnlockButton?: boolean;
  purchasedLanguages?: string[];
  courseAvailableLanguages?: string[] | null;
  selectedAILanguage: string | null;
  onLanguageChange: (lang: string | null) => void;
  onUnlock: () => void;
  onWatch?: () => boolean | void;
  autoOpen?: boolean;
  onAutoOpenConsumed?: () => void;
  /** Free-preview: preferred initial language. */
  restrictToLanguage?: string | null;
  /** Chapter number — controls whether V4 player is eligible (Chapter 1 only). */
  chapterNumber?: number | null;
}

const LegacyAILectureCard = ({
  topicTitle,
  aiPresentationJson,
  aiGeneratedVideoUrl,
  courseId,
  subjectId,
  chapterId,
  topicId,
  showUnlockButton,
  purchasedLanguages = [],
  courseAvailableLanguages,
  selectedAILanguage,
  onLanguageChange,
  onUnlock,
  onWatch,
  autoOpen,
  onAutoOpenConsumed,
  restrictToLanguage,
  chapterNumber,
}: LegacyAILectureCardProps) => {
  const [showPlayer, setShowPlayer] = useState(false);
  const autoOpenedRef = useRef(false);

  useEffect(() => {
    if (autoOpen && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      setShowPlayer(true);
      onAutoOpenConsumed?.();
    }
  }, [autoOpen, onAutoOpenConsumed]);
  const externalJobId = extractJobIdFromUrl(aiGeneratedVideoUrl);
  const { languages: allAiLanguages, isLoading: languagesLoading } = useAvailableLanguages(externalJobId);
  
  const isPreviewMode = !!restrictToLanguage;

  // Free-preview shows every available language (English + others); paid shows only purchased non-English.
  const aiLanguages = isPreviewMode
    ? allAiLanguages.filter(lang => lang !== 'english')
    : allAiLanguages.filter(lang => {
        if (!courseAvailableLanguages || courseAvailableLanguages.length <= 1) return false;
        return purchasedLanguages.includes(lang);
      });

  useEffect(() => {
    console.log('[Legacy AI Lecture Language Badges]', {
      externalJobId,
      topicTitle,
      allAiLanguages,
      purchasedLanguages,
      courseAvailableLanguages,
      renderedBadgeLanguages: aiLanguages,
      isLoading: languagesLoading,
    });
  }, [externalJobId, topicTitle, allAiLanguages, purchasedLanguages, courseAvailableLanguages, aiLanguages, languagesLoading]);

  useEffect(() => {
    if (!showPlayer) return;
    logPreviewReplay('player-open-branch', {
      branch: aiPresentationJson
        ? 'legacy-educational-player'
        : 'legacy-iframe-fallback',
      courseId,
      topicId,
      chapterId,
      hasAiPresentationJson: !!aiPresentationJson,
      hasAiGeneratedVideoUrl: !!aiGeneratedVideoUrl,
      externalJobId,
    });
  }, [showPlayer, aiPresentationJson, aiGeneratedVideoUrl, externalJobId, courseId, topicId, chapterId]);

  const handleCardClick = () => {
    const blocked = onWatch?.();
    if (blocked) {
      logPreviewReplay('legacy-card-click-blocked-for-auth', { courseId, topicId, chapterId, externalJobId });
      return;
    }
    logPreviewReplay('legacy-card-click-open', { courseId, topicId, chapterId, externalJobId });
    setShowPlayer(true);
  };


  return (
    <>
      <Card
        className="cursor-pointer hover:border-primary transition-colors overflow-hidden border-primary/30 dark:border-primary"
        onClick={handleCardClick}
      >
        <CardHeader className="p-0">
          <div className="relative aspect-video bg-gradient-to-br from-slate-900 via-primary-dark to-primary-dark flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
            
            <div className="relative z-10 text-center space-y-4">
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl">📚</span>
                <span className="text-2xl font-light tracking-wide text-white">
                  Simple<span className="font-semibold">Lectures</span>
                </span>
              </div>
              <div className="w-32 h-0.5 mx-auto bg-gradient-to-r from-transparent via-primary to-transparent" />
              <div className="w-14 h-14 mx-auto rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                <Play className="h-6 w-6 text-white ml-1" fill="white" />
              </div>
              <div className="flex items-center justify-center gap-1.5 text-primary/80 text-sm">
                <Sparkles className="h-3.5 w-3.5" />
                <span>AI-Powered Learning</span>
              </div>
            </div>
            <div className="absolute inset-0 bg-primary/20 opacity-0 hover:opacity-100 transition-opacity duration-300" />
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <h3 className="font-semibold">{topicTitle} - AI Generated Lecture</h3>
          <p className="text-sm text-muted-foreground mb-2">
            Watch the AI-generated video lecture with embedded player
          </p>
          
          {(aiLanguages.length > 0 || !languagesLoading) && (
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <span className="text-xs text-muted-foreground">Watch in:</span>
              <Badge
                variant={selectedAILanguage === null ? "default" : "outline"}
                className="cursor-pointer text-xs hover:bg-primary/80 transition-colors"
                onClick={(e) => { e.stopPropagation(); onLanguageChange(null); }}
              >
                🇬🇧 English
              </Badge>
              {languagesLoading ? (
                <Skeleton className="h-5 w-16" />
              ) : (
                aiLanguages.map((lang) => {
                  const langInfo = getLanguageInfo(lang);
                  return (
                    <Badge
                      key={lang}
                      variant={selectedAILanguage === lang ? "default" : "outline"}
                      className="cursor-pointer text-xs hover:bg-primary/80 transition-colors"
                      onClick={(e) => { e.stopPropagation(); onLanguageChange(lang); }}
                    >
                      {langInfo?.flag} {langInfo?.name || lang}
                    </Badge>
                  );
                })
              )}
            </div>
          )}

          {showUnlockButton && !isPreviewMode && (

            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onUnlock();
              }}
              className="relative w-full mt-3 bg-gradient-to-r from-primary via-primary to-primary hover:from-primary-dark hover:via-primary hover:to-primary-dark transition-all duration-300 border-0 overflow-hidden"
            >
              <span className="absolute inset-0 overflow-hidden pointer-events-none">
                <span className="absolute h-full w-8 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12 animate-shine" />
              </span>
              <Globe className="h-4 w-4 mr-2" />
              <span className="font-semibold">Unlock Your Language</span>
              <Sparkles className="h-3 w-3 ml-1.5 text-yellow-300" />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Legacy Player Dialog — prefer in-app player whenever we can resolve a job id.
          Chapter 1 with a job id opens in V4; everything else stays on V3. */}
      {showPlayer && externalJobId && isV4EligibleChapter(chapterNumber) ? (
        <V4PlayerDialog
          open={showPlayer}
          onOpenChange={setShowPlayer}
          documentName={topicTitle || 'AI Lecture'}
          initialJobId={externalJobId}
          initialLanguage={selectedAILanguage ?? restrictToLanguage ?? null}
          restrictToLanguage={restrictToLanguage ?? null}
          topicId={topicId}
          chapterId={chapterId}
          subjectId={subjectId}
          courseId={courseId}
        />
      ) : showPlayer && (aiPresentationJson || externalJobId) ? (
        <EducationalVideoPlayerDialog
          open={showPlayer}
          onOpenChange={setShowPlayer}
          presentationData={aiPresentationJson || undefined}
          externalJobId={externalJobId || undefined}
          documentName={topicTitle || 'AI Lecture'}
          initialLanguage={selectedAILanguage ?? restrictToLanguage ?? null}
          courseId={courseId}
          subjectId={subjectId}
          chapterId={chapterId}
          topicId={topicId}
        />
      ) : showPlayer && aiGeneratedVideoUrl ? (
        <Dialog open={showPlayer} onOpenChange={setShowPlayer}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden max-h-[85vh] flex flex-col">
            <DialogHeader className="p-4 pb-0 flex flex-row items-center justify-between">
              <DialogTitle>{topicTitle} - AI Generated Lecture</DialogTitle>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowPlayer(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogHeader>
            <div className="flex flex-col gap-4 p-4 pt-2 overflow-y-auto">
              <div className="h-[60vh] max-h-[600px] rounded-lg overflow-hidden bg-black flex-shrink-0">
                <iframe
                  src={aiGeneratedVideoUrl}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              </div>
              <div className="flex items-center justify-between flex-shrink-0">
                <Badge className="bg-primary">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI Generated
                </Badge>
                <Button variant="outline" onClick={() => setShowPlayer(false)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    {notesOpen && notesTarget && (
      <V4Notes
        notesId={notesTarget.jobId}
        subjectId={subjectId || undefined}
        chapterId={chapterId || undefined}
        topicId={topicId || undefined}
        open={notesOpen}
        onOpenChange={setNotesOpen}
      />
    )}
    </>
  );
};
