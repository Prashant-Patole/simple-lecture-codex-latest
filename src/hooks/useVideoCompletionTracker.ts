import { useState, useRef, useCallback, useEffect } from 'react';
import { useMarkVideoWatched } from './useMarkVideoWatched';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface CompletionTrackerParams {
  sections: Array<{ narration?: { total_duration_seconds?: number } }>;
  videoTitle: string;
  topicId?: string;
  chapterId?: string;
  subjectId?: string;
  courseId?: string;
}

const TAG = '[CompletionTracker]';

export const useVideoCompletionTracker = ({
  sections,
  videoTitle,
  topicId,
  chapterId,
  subjectId,
  courseId,
}: CompletionTrackerParams) => {
  const [isCompleted, setIsCompleted] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [chapterTestReady, setChapterTestReady] = useState<{ selfTestId: string; chapterTitle: string } | null>(null);
  const accumulatedTimeRef = useRef(0);
  const completedRef = useRef(false);
  const lastLogTimeRef = useRef(0);
  const markWatched = useMarkVideoWatched();
  const queryClient = useQueryClient();

  const totalDuration = sections.reduce(
    (acc, s) => acc + (s.narration?.total_duration_seconds || 0),
    0
  );

  // Calculate required watch time: sum of all section durations - 60 seconds
  const requiredWatchSeconds = Math.max(0, totalDuration - 60);

  // Log initialization ONCE per mount (was spamming every render)
  const loggedInitRef = useRef(false);
  useEffect(() => {
    if (loggedInitRef.current) return;
    loggedInitRef.current = true;
    console.log(`${TAG} INIT | video="${videoTitle}" | sections=${sections.length} | totalDuration=${totalDuration.toFixed(1)}s | requiredWatch=${requiredWatchSeconds.toFixed(1)}s`);
    console.log(`${TAG} IDs  | topicId=${topicId} | chapterId=${chapterId} | subjectId=${subjectId} | courseId=${courseId}`);
  }, [videoTitle, sections.length, totalDuration, requiredWatchSeconds, topicId, chapterId, subjectId, courseId]);

  const reportWatchTime = useCallback(
    (deltaSeconds: number) => {
      if (completedRef.current || requiredWatchSeconds <= 0) return;

      accumulatedTimeRef.current += deltaSeconds;
      const now = Date.now();

      // Throttled progress log every 10 seconds
      if (now - lastLogTimeRef.current >= 10000) {
        const pct = ((accumulatedTimeRef.current / requiredWatchSeconds) * 100).toFixed(1);
        console.log(`${TAG} PROGRESS | accumulated=${accumulatedTimeRef.current.toFixed(1)}s / ${requiredWatchSeconds.toFixed(1)}s (${pct}%) | delta=${deltaSeconds.toFixed(2)}s`);
        lastLogTimeRef.current = now;
      }

      if (accumulatedTimeRef.current >= requiredWatchSeconds) {
        completedRef.current = true;
        setIsCompleted(true);
        setShowCompletionDialog(true);

        console.log(`${TAG} ✅ COMPLETED! | accumulated=${accumulatedTimeRef.current.toFixed(1)}s >= required=${requiredWatchSeconds.toFixed(1)}s`);

        // Mark video as watched in DB
        console.log(`${TAG} Calling markWatched mutation | video="${videoTitle}" topicId=${topicId}`);
        markWatched.mutate(
          {
            videoTitle,
            subjectId,
            chapterId,
            topicId,
          },
          {
            onSuccess: (data) => console.log(`${TAG} markWatched SUCCESS`, data),
            onError: (err) => console.error(`${TAG} markWatched ERROR`, err),
          }
        );

        // Call award-badge edge function
        const badgePayload = {
          topicId,
          chapterId,
          subjectId,
          courseId,
          topicTitle: videoTitle,
        };
        console.log(`${TAG} Invoking award-badge with payload:`, JSON.stringify(badgePayload));

        supabase.functions
          .invoke('award-badge', { body: badgePayload })
          .then(({ data, error }) => {
            if (error) {
              console.error(`${TAG} award-badge INVOKE ERROR:`, error);
            } else {
              console.log(`${TAG} award-badge RESPONSE:`, JSON.stringify(data));
            }
            queryClient.invalidateQueries({ queryKey: ['student-badges'] });

            // Chapter completion check (auto-generate chapter test)
            if (chapterId && courseId && subjectId) {
              console.log(`${TAG} Invoking check-chapter-completion`);
              supabase.functions
                .invoke('check-chapter-completion', {
                  body: { chapterId, courseId, subjectId },
                })
                .then(({ data: ccData, error: ccErr }) => {
                  if (ccErr) {
                    console.error(`${TAG} check-chapter-completion ERROR:`, ccErr);
                    return;
                  }
                  console.log(`${TAG} check-chapter-completion RESPONSE:`, JSON.stringify(ccData));
                  if (ccData?.completed && ccData?.selfTestId) {
                    setChapterTestReady({
                      selfTestId: ccData.selfTestId,
                      chapterTitle: ccData.chapterTitle || 'this chapter',
                    });
                    queryClient.invalidateQueries({ queryKey: ['pending-auto-chapter-tests'] });
                    queryClient.invalidateQueries({ queryKey: ['self-tests'] });
                  }
                })
                .catch((err) => console.error(`${TAG} check-chapter-completion CATCH:`, err));
            }
          })
          .catch((err) => console.error(`${TAG} award-badge CATCH ERROR:`, err));
      }
    },
    [requiredWatchSeconds, videoTitle, topicId, chapterId, subjectId, courseId, markWatched, queryClient]
  );

  const dismissDialog = useCallback(() => {
    setShowCompletionDialog(false);
  }, []);

  const dismissChapterTestDialog = useCallback(() => {
    setChapterTestReady(null);
  }, []);

  return {
    isCompleted,
    showCompletionDialog,
    dismissDialog,
    chapterTestReady,
    dismissChapterTestDialog,
    reportWatchTime,
    requiredWatchSeconds,
    accumulatedTime: accumulatedTimeRef.current,
  };
};
