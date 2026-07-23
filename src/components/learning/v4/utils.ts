import { V4_CDN_BASE, V4_PROXY_BASE } from './constants';

/**
 * Resolve a relative media path through the proxy for a given job.
 * e.g. "avatars/section_1_avatar.mp4" → full proxy URL
 */
export function getMediaSrc(path: string, jobId: string): string {
  if (!path) return '';
  // Already absolute
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
    return path;
  }
  // Strip leading slash
  const clean = path.startsWith('/') ? path.slice(1) : path;
  if (/\.(mp4|webm|mp3|wav|ogg|png|jpe?g|webp|gif|svg)$/i.test(clean)) {
    return `${V4_CDN_BASE}/${jobId}/${clean}`;
  }
  return `${V4_PROXY_BASE}/player/jobs/${jobId}/${clean}`;
}

/**
 * Resolve the merged single-video for a given language.
 * Convention: `<lang>_final_video` + `<lang>_vimeo_mp4_url` at presentation root.
 * English uses the legacy `final_video_path` / `vimeo_mp4_url` / `vimeo_url` fields.
 * Returns { url, path }: `url` is absolute (e.g. Vimeo mp4); `path` is a relative
 * job asset to be resolved via getMediaSrc(). Caller prefers url over path.
 */
export function getMergedVideoForLanguage(
  p: { final_video_path?: string; vimeo_mp4_url?: string; [k: string]: any } | null | undefined,
  lang?: string | null,
): { url: string; path: string } {
  if (!p) return { url: '', path: '' };
  const l = (lang || 'english').toLowerCase();
  // Prefer Vimeo mp4 (direct playable file). If missing, fall back to the
  // job-folder mp4 served via proxy/CDN. `vimeo_url` is an HTML page and is
  // never used as a <video> src.
  const url = l === 'english' ? (p.vimeo_mp4_url || '') : (p[`${l}_vimeo_mp4_url`] || '');
  const path = l === 'english' ? (p.final_video_path || '') : (p[`${l}_final_video`] || '');
  return { url, path };
}

/** HTML-escape a string */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Get the section type string from a section */
export function getSectionType(section: { section_type?: string; type?: string }): string {
  return section.section_type || section.type || 'content';
}

/** Get avatar video URL from a section, preferring the requested language. */
export function getAvatarUrl(section: {
  avatar_video?: string;
  avatar_url?: string;
  avatar?: string;
  b2_url?: string;
  section_id?: string | number;
  avatar_languages?: Array<{
    language?: string;
    status?: string;
    video_path?: string;
    url?: string;
    path?: string;
    avatar_url?: string;
    b2_url?: string;
    video_url?: string;
  }>;
}, language?: string | null): string {
  const lang = (language || '').toLowerCase();
  if (lang && lang !== 'english' && Array.isArray(section.avatar_languages)) {
    const match = section.avatar_languages.find(
      (a) =>
        (a?.language || '').toLowerCase() === lang &&
        ['completed', 'ready', 'success'].includes((a?.status || '').toLowerCase())
    );
    const langUrl = match?.video_path || match?.video_url || match?.url || match?.path || match?.avatar_url || match?.b2_url;
    if (langUrl) return langUrl;
  }
  // If requested language isn't ready yet for this section, fall back to English
  // rather than requesting a non-existent path (which would hang the player).

  return section.avatar_video || section.avatar_url || section.avatar || section.b2_url || '';
}

/** True when the section ships a pipeline-merged single video and V4 should skip client compositing. */
const INTERACTIVE_TYPES = new Set(['intro', 'summary', 'memory', 'quiz']);
export function isMergedSection(section: { final_video_path?: string; section_type?: string; type?: string; title?: string }, language?: string | null): boolean {
  if (language && language.toLowerCase() !== 'english') return false;
  const st = getSectionType(section);
  if (INTERACTIVE_TYPES.has(st)) return false;
  return !!section?.final_video_path;
}

/** The master video URL V4 should feed into the player for a section. */
export function getMainVideoUrl(section: { final_video_path?: string; avatar_video?: string; avatar_url?: string; avatar?: string; b2_url?: string; section_id?: string | number; avatar_languages?: Array<{ language?: string; status?: string; video_path?: string; url?: string; path?: string; avatar_url?: string; b2_url?: string; video_url?: string }>; section_type?: string; type?: string; title?: string }, language?: string | null): string {
  const st = getSectionType(section);
  const avatar = getAvatarUrl(section, language);
  const final = section.final_video_path || '';
  const forceAvatar = INTERACTIVE_TYPES.has(st) || (!!language && language.toLowerCase() !== 'english');
  return forceAvatar ? (avatar || final) : (final || avatar);
}

/**
 * Per-section primary asset rule (single source of truth for preloader & player).
 *
 *   sec 0 & sec 1  → AVATAR only (no final composite expected yet)
 *   sec 2+         → FINAL only (composited avatar+beats); fallback to avatar
 *   intro/summary  → always AVATAR (forced by getMainVideoUrl)
 *
 * Returns the proxy URL(s) the preloader should fetch into blobs and that the
 * player will look up via getBlob(). Always 1 url for normal sections — this
 * keeps boot tiny and background data usage minimal.
 */
export function getPrimarySectionAssets(
  section: { final_video_path?: string; avatar_video?: string; avatar_url?: string; avatar?: string; b2_url?: string; section_id?: string | number; avatar_languages?: Array<{ language?: string; status?: string; video_path?: string; url?: string; path?: string; avatar_url?: string; b2_url?: string; video_url?: string }>; section_type?: string; type?: string; title?: string },
  sectionIndex: number,
  jobId: string,
  language?: string | null
): { url: string; kind: 'avatar' | 'final' }[] {
  const st = getSectionType(section);
  const avatar = getAvatarUrl(section, language);
  const final = section.final_video_path || '';
  const forceAvatarForLanguage = !!language && language.toLowerCase() !== 'english';

  // Force avatar for intro/summary regardless of index
  if (st === 'intro' || st === 'summary' || forceAvatarForLanguage) {
    return avatar ? [{ url: getMediaSrc(avatar, jobId), kind: 'avatar' }] : [];
  }

  // First two sections: avatar only (user spec — saves data, those sections have no final)
  if (sectionIndex <= 1) {
    const path = avatar || final;
    if (!path) return [];
    return [{ url: getMediaSrc(path, jobId), kind: avatar ? 'avatar' : 'final' }];
  }

  // Section 2+: final only (fallback to avatar if final missing)
  const path = final || avatar;
  if (!path) return [];
  return [{ url: getMediaSrc(path, jobId), kind: final ? 'final' : 'avatar' }];
}

/**
 * Return EVERY blob-cacheable asset for a section: avatar (or final) + all
 * visual beat videos + beat_video_paths. Images/infographics are skipped
 * (tiny, handled inline). De-duplicated by URL.
 */
export function getAllSectionAssets(
  section: any,
  sectionIndex: number,
  jobId: string,
  language?: string | null
): { url: string; kind: 'avatar' | 'final' | 'beat' }[] {
  const out: { url: string; kind: 'avatar' | 'final' | 'beat' }[] = [];
  const seen = new Set<string>();
  const push = (path: string | undefined, kind: 'avatar' | 'final' | 'beat') => {
    if (!path) return;
    const url = getMediaSrc(path, jobId);
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push({ url, kind });
  };

  // Primary (avatar or final) — same rule as getPrimarySectionAssets
  const primary = getPrimarySectionAssets(section, sectionIndex, jobId, language);
  for (const p of primary) {
    if (!seen.has(p.url)) { seen.add(p.url); out.push(p as any); }
  }

  // visual_beats videos
  if (Array.isArray(section?.visual_beats)) {
    for (const vb of section.visual_beats) {
      const vt = vb?.visual_type;
      if (vt === 'image' || vt === 'infographic') continue;
      push(vb?.video_path || vb?.wan_video_path, 'beat');
    }
  }
  // legacy beat_video_paths
  if (Array.isArray(section?.beat_video_paths)) {
    for (const p of section.beat_video_paths) push(p, 'beat');
  }
  // manim_video_paths
  if (Array.isArray(section?.manim_video_paths)) {
    for (const p of section.manim_video_paths) push(p, 'beat');
  }

  return out;
}


/* ============================================================
 * Strict V4 logging helpers (BLOB vs PROXY visibility)
 * ============================================================ */

type V4LogKind = 'avatar' | 'final' | 'beat' | 'manim' | 'image' | 'video';

/** Log a player media-src assignment with BLOB/PROXY tag. */
export function logV4Source(opts: {
  sectionIndex: number;
  title?: string;
  kind: V4LogKind | string;
  source: 'BLOB' | 'PROXY';
  url: string;
  proxyUrl?: string;
}) {
  const { sectionIndex, title, kind, source, url, proxyUrl } = opts;
  const titleStr = title ? ` "${title.slice(0, 40)}"` : '';
  const proxyStr = proxyUrl && proxyUrl !== url ? `  (proxy=${proxyUrl.slice(-60)})` : '';
  console.log(
    `[V4Source] sec=${sectionIndex}${titleStr} kind=${kind} source=${source} url=${url.slice(0, 80)}${proxyStr}`
  );
}

/** Log a section ENTER summary (avatar/final source resolution). */
export function logV4SectionEnter(opts: {
  sectionIndex: number;
  title?: string;
  primaryKind: 'avatar' | 'final' | 'none';
  source: 'BLOB' | 'PROXY' | 'NONE';
}) {
  const { sectionIndex, title, primaryKind, source } = opts;
  console.log(
    `[V4Source] === SECTION ${sectionIndex} ENTER === primary=${primaryKind} source=${source}${title ? ` "${title.slice(0, 40)}"` : ''}`
  );
}

/** Log a section EXIT summary. */
export function logV4SectionExit(opts: {
  sectionIndex: number;
  playedFromBlob: boolean;
  note?: string;
}) {
  const { sectionIndex, playedFromBlob, note } = opts;
  console.log(
    `[V4Source] === SECTION ${sectionIndex} EXIT  === playedFromBlob=${playedFromBlob}${note ? ` (${note})` : ''}`
  );
}

/** Log preloader events with unified [V4Preload] prefix. */
export function logV4Preload(phase: 'BOOT' | 'BG', message: string) {
  console.log(`[V4Preload] ${phase} ${message}`);
}


