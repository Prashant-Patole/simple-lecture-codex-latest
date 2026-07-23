import { useState, useEffect, useRef } from 'react';
import { getMediaSrc, logV4Source } from '../utils';
import type { V4Section } from '../types';

export interface ManimBeat {
  start: number;
  end: number;
  type: 'video' | 'image';
  src: string;
}

interface UseManimScheduleOpts {
  section: V4Section | null;
  jobId: string;
  avatarVideoRef: React.RefObject<HTMLVideoElement | null>;
  manimVideoRef: React.RefObject<HTMLVideoElement | null>;
  getBlob?: (src: string) => string | null;
  sectionIndex?: number;
}

export function useManimSchedule({ section, jobId, avatarVideoRef, manimVideoRef, getBlob, sectionIndex = -1 }: UseManimScheduleOpts) {
  const [schedule, setSchedule] = useState<ManimBeat[]>([]);
  const [currentBeatIndex, setCurrentBeatIndex] = useState(-1);
  const intervalRef = useRef<number | null>(null);
  const lastBeatRef = useRef(-1);

  // Build schedule
  useEffect(() => {
    setCurrentBeatIndex(-1);
    lastBeatRef.current = -1;

    if (!section || !section.manim_video_paths || section.manim_video_paths.length === 0) {
      setSchedule([]);
      return;
    }

    const beats: ManimBeat[] = [];
    const segs = section.narration?.segments || [];
    let cumTime = 0;

    section.manim_video_paths.forEach((p, i) => {
      const dur = segs[i]?.duration_seconds || segs[i]?.duration || 10;
      beats.push({
        start: cumTime,
        end: cumTime + dur,
        type: 'video',
        src: getMediaSrc(p, jobId),
      });
      cumTime += dur;
    });

    // Merge infographic image beats
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

    console.log(`[ManimSchedule] Built ${beats.length} beats for section="${section.title || ''}"`);
    setSchedule(beats);
  }, [section, jobId]);

  // 120ms sync interval
  useEffect(() => {
    if (schedule.length === 0) return;

    const sync = () => {
      const avatar = avatarVideoRef.current;
      const manim = manimVideoRef.current;
      if (!avatar || !manim) return;

      const t = avatar.currentTime;
      let idx = -1;
      for (let i = schedule.length - 1; i >= 0; i--) {
        if (t >= schedule[i].start && t < schedule[i].end) { idx = i; break; }
      }

      if (idx !== lastBeatRef.current) {
        lastBeatRef.current = idx;
        setCurrentBeatIndex(idx);

        if (idx >= 0 && schedule[idx].type === 'video') {
          const blobSrc = getBlob?.(schedule[idx].src);
          const finalSrc = blobSrc || schedule[idx].src;
          logV4Source({ sectionIndex, kind: 'manim', source: blobSrc ? 'BLOB' : 'PROXY', url: finalSrc, proxyUrl: schedule[idx].src });
          manim.src = finalSrc;
          manim.currentTime = t - schedule[idx].start;
          if (!avatar.paused) manim.play().catch(() => {});
        }
      }

      // Keep manim in sync
      if (idx >= 0 && schedule[idx].type === 'video' && !avatar.paused) {
        const expectedTime = t - schedule[idx].start;
        if (Math.abs(manim.currentTime - expectedTime) > 0.3) {
          manim.currentTime = expectedTime;
        }
      }

      // Pause/resume manim with avatar
      if (avatar.paused && !manim.paused) manim.pause();
      if (!avatar.paused && manim.paused && idx >= 0 && schedule[idx].type === 'video') {
        manim.play().catch(() => {});
      }
    };

    intervalRef.current = window.setInterval(sync, 120);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [schedule, avatarVideoRef, manimVideoRef]);

  return { schedule, currentBeatIndex };
}
