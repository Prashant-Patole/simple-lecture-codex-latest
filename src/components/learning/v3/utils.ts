import { V3_PROXY_BASE } from './constants';

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
  return `${V3_PROXY_BASE}/player/jobs/${jobId}/${clean}`;
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
export function getAvatarUrl(
  section: {
    avatar_video?: string;
    avatar_url?: string;
    avatar?: string;
    b2_url?: string;
    avatar_languages?: Array<{
      language?: string;
      status?: string;
      video_path?: string;
      video_url?: string;
      url?: string;
      path?: string;
      avatar_url?: string;
      b2_url?: string;
    }>;
    section_id?: string | number;
  },
  language?: string
): string {
  const lang = (language || '').toLowerCase();
  if (lang && lang !== 'english' && Array.isArray(section.avatar_languages)) {
    const match = section.avatar_languages.find(
      (a) =>
        (a?.language || '').toLowerCase() === lang &&
        ['completed', 'ready', 'success'].includes((a?.status || '').toLowerCase())
    );
    const langUrl =
      match?.video_path || match?.video_url || match?.url || match?.path || match?.avatar_url || match?.b2_url;
    if (langUrl) return langUrl;
  }
  // If requested language isn't ready yet for this section, fall back to English
  // rather than requesting a non-existent path (which would hang the player).

  return section.avatar_video || section.avatar_url || section.avatar || section.b2_url || '';
}
