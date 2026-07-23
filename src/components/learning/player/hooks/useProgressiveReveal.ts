import { useState, useCallback, useRef, useEffect } from 'react';
import { NarrationSegment, VisualBeat } from '../types';

interface SegmentTiming {
  segmentId: string;
  index: number;
  startTime: number;
  endTime: number;
  duration: number;
}

interface UseProgressiveRevealOptions {
  segments: NarrationSegment[];
  beats: VisualBeat[];
  mode: 'accumulate' | 'current-only' | 'quiz-groups';
}

interface UseProgressiveRevealReturn {
  segmentTimings: SegmentTiming[];
  totalDuration: number;
  getRevealedIndices: (currentTime: number) => number[];
  getActiveIndex: (currentTime: number) => number;
  getCurrentSegmentIndex: (currentTime: number) => number;
  getDisplayDirectives: (currentTime: number) => {
    textLayer: 'show' | 'hide';
    visualLayer: 'show' | 'hide';
  };
}

export const useProgressiveReveal = ({
  segments,
  beats,
  mode,
}: UseProgressiveRevealOptions): UseProgressiveRevealReturn => {
  // Build segment timing map
  const segmentTimings = useRef<SegmentTiming[]>([]);
  const totalDuration = useRef(0);

  // Build timing map when segments change
  useEffect(() => {
    let cumulativeTime = 0;
    const timings: SegmentTiming[] = [];

    segments.forEach((segment, index) => {
      const duration = segment.duration_seconds || 5;
      timings.push({
        segmentId: segment.segment_id,
        index,
        startTime: cumulativeTime,
        endTime: cumulativeTime + duration,
        duration,
      });
      cumulativeTime += duration;
    });

    segmentTimings.current = timings;
    totalDuration.current = cumulativeTime;
  }, [segments]);

  // Get current segment index based on time
  const getCurrentSegmentIndex = useCallback((currentTime: number): number => {
    const timings = segmentTimings.current;
    for (let i = 0; i < timings.length; i++) {
      if (currentTime >= timings[i].startTime && currentTime < timings[i].endTime) {
        return i;
      }
    }
    // If past all segments, return last one
    return Math.max(0, timings.length - 1);
  }, []);

  // Get display directives from current segment
  const getDisplayDirectives = useCallback((currentTime: number) => {
    const segmentIndex = getCurrentSegmentIndex(currentTime);
    const segment = segments[segmentIndex];
    
    const directives = segment?.display_directives || {};
    
    return {
      textLayer: (directives.text_layer as 'show' | 'hide') || 'show',
      visualLayer: (directives.visual_layer as 'show' | 'hide') || 'hide',
    };
  }, [segments, getCurrentSegmentIndex]);

  // Get which beat indices should be revealed based on current time
  const getRevealedIndices = useCallback((currentTime: number): number[] => {
    const timings = segmentTimings.current;
    const revealed: number[] = [];

    if (beats.length === 0 || timings.length === 0) return [];

    // Strategy 1: Use beat.start_time if available
    // Strategy 2: Match beat.segment_id to segment timing
    // Strategy 3: Distribute evenly

    const currentSegmentIndex = getCurrentSegmentIndex(currentTime);

    for (let beatIndex = 0; beatIndex < beats.length; beatIndex++) {
      const beat = beats[beatIndex];
      let shouldReveal = false;

      // Strategy 1: Check explicit start_time
      if (beat.start_time !== undefined && beat.start_time !== null) {
        shouldReveal = currentTime >= beat.start_time;
      }
      // Strategy 2: Match segment_id
      else if (beat.segment_id) {
        const segmentTiming = timings.find(t => t.segmentId === beat.segment_id);
        if (segmentTiming) {
          shouldReveal = currentTime >= segmentTiming.startTime;
        }
      }
      // Strategy 3: Distribute evenly across 70% of duration (teach phase)
      else {
        const teachDuration = totalDuration.current * 0.7;
        const beatInterval = teachDuration / Math.max(1, beats.length);
        const beatStartTime = beatIndex * beatInterval;
        shouldReveal = currentTime >= beatStartTime;
      }

      if (shouldReveal) {
        if (mode === 'accumulate') {
          revealed.push(beatIndex);
        } else if (mode === 'current-only') {
          // Only show the most recently revealed beat
          if (revealed.length === 0 || beatIndex > revealed[revealed.length - 1]) {
            revealed.length = 0; // Clear previous
            revealed.push(beatIndex);
          }
        } else if (mode === 'quiz-groups') {
          // Quiz: group by 3 (question, pause, answer)
          const groupIndex = Math.floor(beatIndex / 3);
          const currentGroupStart = groupIndex * 3;
          const currentGroupEnd = currentGroupStart + 2;
          
          // Show all beats in current group
          for (let i = currentGroupStart; i <= Math.min(currentGroupEnd, beats.length - 1); i++) {
            if (!revealed.includes(i)) {
              revealed.push(i);
            }
          }
        }
      }
    }

    return revealed;
  }, [beats, mode, getCurrentSegmentIndex]);

  // Get the active (most recently revealed) index
  const getActiveIndex = useCallback((currentTime: number): number => {
    const revealed = getRevealedIndices(currentTime);
    return revealed.length > 0 ? revealed[revealed.length - 1] : -1;
  }, [getRevealedIndices]);

  return {
    segmentTimings: segmentTimings.current,
    totalDuration: totalDuration.current,
    getRevealedIndices,
    getActiveIndex,
    getCurrentSegmentIndex,
    getDisplayDirectives,
  };
};
