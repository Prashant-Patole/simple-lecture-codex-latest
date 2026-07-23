import { NarrationSegment, VisualBeat, SegmentTiming } from '../types';

/**
 * Build timing map from narration segments
 * Returns array of segment timings with cumulative start/end times
 */
export const buildSegmentTimingMap = (segments: NarrationSegment[]): SegmentTiming[] => {
  let cumulativeTime = 0;
  
  return segments.map((seg, index) => {
    const duration = seg.duration_seconds || 5;
    const timing: SegmentTiming = {
      segmentId: seg.segment_id || `seg_${index}`,
      startTime: cumulativeTime,
      endTime: cumulativeTime + duration,
      text: seg.text,
      beatVideos: seg.beat_videos,
    };
    cumulativeTime += duration;
    return timing;
  });
};

/**
 * Find which segment corresponds to the current playback time
 */
export const findCurrentSegment = (
  currentTime: number,
  timingMap: SegmentTiming[]
): { index: number; segment: SegmentTiming | null } => {
  for (let i = 0; i < timingMap.length; i++) {
    if (currentTime >= timingMap[i].startTime && currentTime < timingMap[i].endTime) {
      return { index: i, segment: timingMap[i] };
    }
  }
  // If past all segments, return last one
  if (timingMap.length > 0 && currentTime >= timingMap[timingMap.length - 1].endTime) {
    return { index: timingMap.length - 1, segment: timingMap[timingMap.length - 1] };
  }
  return { index: 0, segment: timingMap[0] || null };
};

/**
 * Calculate which beat indices should be revealed based on current time
 * Uses segment_id or start_time from beats to determine reveal timing
 */
export const getRevealedBeatIndices = (
  currentTime: number,
  beats: VisualBeat[],
  timingMap: SegmentTiming[]
): number[] => {
  const revealed: number[] = [];
  
  beats.forEach((beat, index) => {
    // Check if beat has explicit start_time
    if (beat.start_time !== undefined) {
      if (currentTime >= beat.start_time) {
        revealed.push(index);
      }
      return;
    }
    
    // Check if beat has segment_id to match against timing map
    if (beat.segment_id) {
      const segmentTiming = timingMap.find(t => t.segmentId === beat.segment_id);
      if (segmentTiming && currentTime >= segmentTiming.startTime) {
        revealed.push(index);
      }
      return;
    }
    
    // Default: reveal based on position ratio
    const totalDuration = timingMap.length > 0 
      ? timingMap[timingMap.length - 1].endTime 
      : 30;
    const beatTime = (index / Math.max(beats.length, 1)) * totalDuration;
    if (currentTime >= beatTime) {
      revealed.push(index);
    }
  });
  
  return revealed;
};

/**
 * Calculate total duration from timing map
 */
export const getTotalDuration = (timingMap: SegmentTiming[]): number => {
  if (timingMap.length === 0) return 0;
  return timingMap[timingMap.length - 1].endTime;
};

/**
 * Format time in MM:SS format
 */
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
