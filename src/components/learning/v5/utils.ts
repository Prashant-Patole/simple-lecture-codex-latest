import { SUPABASE_URL } from '@/lib/supabaseUrl';
import type {
  V5Language,
  V5Presentation,
  V5Section,
  V5SubtitleData,
  V5TimelineSection,
} from './types';

const V5_PROXY_BASE = `${SUPABASE_URL}/functions/v1/v4-player-proxy`;
const V5_CDN_BASE = 'https://server1.simplelecture.com/video';

export const getPresentationUrl = (jobId: string) =>
  `${V5_PROXY_BASE}/player/jobs/${encodeURIComponent(jobId)}/presentation.json?t=${Date.now()}`;

export const getSubtitlesUrl = (jobId: string) =>
  `${V5_PROXY_BASE}/player/jobs/${encodeURIComponent(jobId)}/subtitles.json?t=${Date.now()}`;

const getCdnMediaUrl = (jobId: string, path: string) => {
  const cleanPath = path.replace(/^\/+/, '');
  return `${V5_CDN_BASE}/${encodeURIComponent(jobId)}/${cleanPath}`;
};

export function getMergedVideoCandidates(
  presentation: V5Presentation,
  jobId: string,
  language: V5Language,
): string[] {
  const direct =
    language === 'kannada'
      ? presentation.kannada_vimeo_mp4_url
      : presentation.vimeo_mp4_url || presentation.final_video_url;
  const path =
    language === 'kannada'
      ? presentation.kannada_final_video
      : presentation.final_video_path;

  return Array.from(
    new Set(
      [
        direct,
        path
          ? path.startsWith('http://') || path.startsWith('https://')
            ? path
            : getCdnMediaUrl(jobId, path)
          : '',
      ].filter((value): value is string => Boolean(value)),
    ),
  );
}

export function hasMergedVideo(
  presentation: V5Presentation,
  language: V5Language,
): boolean {
  return getMergedVideoCandidates(presentation, 'availability-check', language).length > 0;
}

export function normalizeKeyPoints(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object' && 'text' in item) {
        return String((item as { text?: unknown }).text || '').trim();
      }
      return '';
    })
    .filter(Boolean);
}

function getSubtitleDuration(
  section: V5Section,
  index: number,
  subtitleData: V5SubtitleData | null,
): number {
  const sectionKeys = [
    String(section.section_id),
    String(index + 1),
  ];

  for (const key of sectionKeys) {
    const words = subtitleData?.sections?.[key]?.words;
    if (!words?.length) continue;
    const lastEnd = words.reduce((max, word) => Math.max(max, Number(word.end) || 0), 0);
    if (lastEnd > 0) return lastEnd;
  }

  return 0;
}

function getNarrationDuration(section: V5Section): number {
  const declared = Number(section.narration?.total_duration_seconds) || 0;
  if (declared > 0) return declared;

  return (section.narration?.segments || []).reduce(
    (total, segment) =>
      total + (Number(segment.duration_seconds ?? segment.duration) || 0),
    0,
  );
}

export function buildSectionTimeline(
  sections: V5Section[],
  subtitleData: V5SubtitleData | null,
): V5TimelineSection[] {
  let offset = 0;

  return sections.map((section, sectionIndex) => {
    const duration =
      getSubtitleDuration(section, sectionIndex, subtitleData) ||
      getNarrationDuration(section) ||
      1;
    const entry: V5TimelineSection = {
      section,
      sectionIndex,
      start: offset,
      end: offset + duration,
      duration,
      keyPoints: normalizeKeyPoints(section.key_points),
    };
    offset += duration;
    return entry;
  });
}

export function getTimelinePosition(
  timeline: V5TimelineSection[],
  videoTime: number,
  videoDuration: number,
) {
  const logicalDuration = timeline.at(-1)?.end || 0;
  const logicalTime =
    videoDuration > 0 && logicalDuration > 0
      ? (videoTime / videoDuration) * logicalDuration
      : videoTime;
  const active =
    timeline.find((entry) => logicalTime >= entry.start && logicalTime < entry.end) ||
    timeline.at(-1) ||
    null;

  if (!active) {
    return { active: null, logicalTime: 0, sectionProgress: 0, visibleCount: 0 };
  }

  const sectionProgress = Math.max(
    0,
    Math.min(1, (logicalTime - active.start) / Math.max(active.duration, 0.001)),
  );
  const visibleCount = active.keyPoints.length
    ? Math.min(
        active.keyPoints.length,
        Math.floor(sectionProgress * active.keyPoints.length) + 1,
      )
    : 0;

  return { active, logicalTime, sectionProgress, visibleCount };
}

export function formatV5Time(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}
