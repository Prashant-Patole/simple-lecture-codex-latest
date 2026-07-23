import { useState, useEffect, useRef, useCallback } from 'react';
import { getMediaSrc, logV4Source } from '../utils';
import type { V4Section, V4VisualBeat } from '../types';

export interface BeatEntry {
  start: number;
  end: number;
  type: 'video' | 'image';
  src: string;        // proxy URL
  blobUrl?: string;    // pre-fetched blob
}

interface UseVideoScheduleOpts {
  section: V4Section | null;
  jobId: string;
  avatarVideoRef: React.RefObject<HTMLVideoElement | null>;
  getBlob?: (src: string) => string | null;
  sectionIndex?: number;
}

export function useVideoSchedule({ section, jobId, avatarVideoRef, getBlob, sectionIndex = -1 }: UseVideoScheduleOpts) {
  const [schedule, setSchedule] = useState<BeatEntry[]>([]);
  const [currentBeatIndex, setCurrentBeatIndex] = useState(-1);
  const blobCacheRef = useRef<Map<string, string>>(new Map());
  const epochRef = useRef(0);

  // Build schedule when section changes
  useEffect(() => {
    epochRef.current++;
    const epoch = epochRef.current;

    // Cleanup old blobs
    blobCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
    blobCacheRef.current.clear();
    setCurrentBeatIndex(-1);

    if (!section) { setSchedule([]); return; }

    const beats: BeatEntry[] = [];

    // Strategy A: visual_beats
    if (section.visual_beats && section.visual_beats.length > 0) {
      for (const vb of section.visual_beats) {
        const isImageBeat = vb.visual_type === 'image' || vb.visual_type === 'infographic';
        const path = isImageBeat
          ? (vb.image_source || vb.video_path || '')
          : (vb.video_path || vb.image_source || '');
        if (!path) continue;
        beats.push({
          start: vb.beat_start_seconds,
          end: vb.beat_end_seconds,
          type: vb.visual_type === 'image' || vb.visual_type === 'infographic' ? 'image' : 'video',
          src: getMediaSrc(path, jobId),
        });
      }
    }
    // Strategy B: beat_video_paths with narration segments
    else if (section.beat_video_paths && section.beat_video_paths.length > 0) {
      const segs = section.narration?.segments || [];
      let cumTime = 0;
      section.beat_video_paths.forEach((p, i) => {
        const dur = segs[i]?.duration_seconds || segs[i]?.duration || 10;
        beats.push({
          start: cumTime,
          end: cumTime + dur,
          type: 'video',
          src: getMediaSrc(p, jobId),
        });
        cumTime += dur;
      });
    }

    // Merge infographic_beats overlay
    const infos = section.render_spec?.infographic_beats;
    if (infos && infos.length > 0) {
      for (const ib of infos) {
        if (!ib.image_source) continue;
        beats.push({
          start: ib.start_seconds || 0,
          end: ib.end_seconds || 9999,
          type: 'image',
          src: getMediaSrc(ib.image_source, jobId),
        });
      }
      beats.sort((a, b) => a.start - b.start);
    }

    // Assign preloaded blobs immediately if available
    let preloadedCount = 0;
    let needFetchCount = 0;
    const updatedBeats = beats.map((b) => {
      const blob = getBlob?.(b.src);
      if (blob) {
        preloadedCount++;
        return { ...b, blobUrl: blob };
      }
      if (b.type === 'video') needFetchCount++;
      return b;
    });
    console.log(`[VideoSchedule] Built ${updatedBeats.length} beats — ${preloadedCount} from preloader blobs, ${needFetchCount} videos need fetch — section="${section.title || ''}"`);
    setSchedule(updatedBeats);

    // Non-preloaded videos stream directly via HTTP Range on the <video> element.
    // No redundant blob-fetch here — it duplicates preloader work and delays first frame.


    return () => {
      // Cleanup handled on next run
    };
  }, [section, jobId]);

  // Track current beat by avatar time
  useEffect(() => {
    const vid = avatarVideoRef.current;
    if (!vid || schedule.length === 0) return;

    const onTime = () => {
      const t = vid.currentTime;
      let idx = -1;
      for (let i = schedule.length - 1; i >= 0; i--) {
        if (t >= schedule[i].start && t < schedule[i].end) { idx = i; break; }
      }
      setCurrentBeatIndex(idx);
    };

    vid.addEventListener('timeupdate', onTime);
    vid.addEventListener('seeked', onTime);
    return () => {
      vid.removeEventListener('timeupdate', onTime);
      vid.removeEventListener('seeked', onTime);
    };
  }, [avatarVideoRef, schedule]);

  // Cleanup blobs on unmount
  useEffect(() => {
    return () => {
      blobCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  return { schedule, currentBeatIndex };
}
