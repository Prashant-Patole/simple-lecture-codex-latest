// Trial helper: filter V3 sections so only Manim/video visual beats remain,
// extending the last kept beat to cover the full narration duration so the
// visual layer never goes blank while Kannada (or any language) audio plays.
import type { V3Presentation, V3Section, V3VisualBeat } from '../types';

const VIDEO_VISUAL_TYPES = new Set([
  'video',
  'manim',
  'manim_video',
  'animation',
  'wan_video',
]);

const isVideoBeat = (b: V3VisualBeat): boolean => {
  const t = (b.visual_type || '').toLowerCase();
  if (VIDEO_VISUAL_TYPES.has(t)) return true;
  // Some jobs tag beats only via a video_path field
  return !!b.video_path && !b.image_source;
};

export function filterToVideoBeats(pres: V3Presentation): V3Presentation {
  const sections: V3Section[] = (pres.sections || []).map((s) => {
    const beats = (s.visual_beats || []).filter(isVideoBeat);
    if (beats.length === 0) return { ...s };

    const totalDur =
      s.narration?.total_duration_seconds ??
      beats[beats.length - 1].beat_end_seconds;

    // Stretch the last video beat to cover the remaining narration so the
    // visual layer holds instead of going blank.
    const last = { ...beats[beats.length - 1] };
    if (totalDur > last.beat_end_seconds) last.beat_end_seconds = totalDur;
    beats[beats.length - 1] = last;

    return { ...s, visual_beats: beats };
  });

  return { ...pres, sections };
}
