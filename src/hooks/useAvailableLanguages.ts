import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SUPPORTED_LANGUAGES } from './useLanguageAvatarJobs';
import { getCdnMediaUrl } from '@/components/learning/player/utils/mediaResolver';

const LANGUAGE_DEBUG_PREFIX = '[useAvailableLanguages]';
const CDN_BASE_URL = 'https://server1.simplelecture.com/video';

const isDebugEnabled = () => {
  if (typeof window === 'undefined') return false;
  return import.meta.env.DEV || window.localStorage.getItem('debugLanguageBadges') === '1';
};

const normalizeLanguage = (value: unknown) => String(value || '').trim().toLowerCase();

const isCompletedStatus = (value: unknown) => {
  const status = String(value || '').trim().toLowerCase();
  return status === 'completed' || status === 'ready' || status === 'success';
};

const getUsableAvatarUrl = (avatar: any, externalJobId?: string, sectionId?: number): string | null => {
  // Prefer durable URLs, but fall back to video_path resolved against the CDN.
  // presentation.json for most jobs only stores video_path (relative), so requiring
  // a durable URL was too strict and hid legitimately available languages.
  if (avatar?.video_url) return avatar.video_url;
  if (avatar?.b2_url) return avatar.b2_url;
  if (avatar?.vimeo_url) return avatar.vimeo_url;
  if (avatar?.video_path && externalJobId != null && sectionId != null) {
    const path = String(avatar.video_path).replace(/^\/+/, '');
    return `https://server1.simplelecture.com/video/${externalJobId}/${path}`;
  }
  return null;
};


// Map of language code → section_id → avatar info
export interface LanguageAvatarMap {
  [language: string]: {
    [sectionId: number]: {
      avatarUrl: string;
      status: string;
    };
  };
}

interface AvailableLanguagesResult {
  languages: string[];
  avatarMap: LanguageAvatarMap;
  isLoading: boolean;
  totalSections: number;
  languageCoverage: { [language: string]: number };
}

/**
 * Hook to fetch available language avatars for a given lecture job
 * Groups completed language_avatar_jobs by language → section_id
 */
export function useAvailableLanguages(externalJobId: string | null): AvailableLanguagesResult {
  const { data, isLoading } = useQuery({
    queryKey: ['available-languages', 'cdn-source-v2', externalJobId],
    queryFn: async () => {
      if (!externalJobId) return { languages: [], avatarMap: {}, totalSections: 0, languageCoverage: {} };

      // SOURCE OF TRUTH: the LIVE CDN presentation.json for this job.
      // The DB copy (video_generation_jobs.presentation_json) can be stale
      // (e.g. Kannada entries kept after files were removed server-side).
      let presJson: any = null;
      let source: 'cdn' | 'db-section-count-only' | 'none' = 'none';
      try {
        const res = await fetch(getCdnMediaUrl(externalJobId, 'presentation.json', CDN_BASE_URL), { cache: 'no-store' });
        if (res.ok) {
          presJson = await res.json();
          source = 'cdn';
        } else if (isDebugEnabled()) {
          console.warn('[useAvailableLanguages] CDN proxy fetch returned non-OK', externalJobId, res.status);
        }
      } catch (e) {
        if (isDebugEnabled()) console.warn('[useAvailableLanguages] CDN proxy fetch failed', externalJobId, e);
      }

      // Fallback to DB only for section count/default English. Never trust DB
      // avatar_languages for non-English badges because it can be stale.
      if (!presJson) {
        const { data: jobRow } = await supabase
          .from('video_generation_jobs')
          .select('presentation_json')
          .eq('external_job_id', externalJobId)
          .maybeSingle();
        presJson = jobRow?.presentation_json ?? null;
        if (presJson) source = 'db-section-count-only';
      }

      const avatarMap: LanguageAvatarMap = {};
      const languageCoverage: { [language: string]: number } = {};

      const sections: any[] = Array.isArray(presJson?.sections) ? presJson.sections : [];
      const totalSections = sections.length;
      const debugRows: Array<Record<string, unknown>> = [];

      for (const section of sections) {
        const sectionId = section.section_id ?? 0;
        const avatars: any[] = source === 'cdn' && Array.isArray(section.avatar_languages) ? section.avatar_languages : [];

        // English is always available via the default avatar path
        if (!avatarMap['english']) {
          avatarMap['english'] = {};
          languageCoverage['english'] = 0;
        }
        avatarMap['english'][sectionId] = {
          avatarUrl: `https://server1.simplelecture.com/video/${externalJobId}/avatars/section_${sectionId}_avatar.mp4`,
          status: 'completed',
        };
        languageCoverage['english']++;

        for (const avatar of avatars) {
          if (!avatar?.language) continue;
          const lang = normalizeLanguage(avatar.language);
          if (lang === 'english') continue;

          const isCompleted = isCompletedStatus(avatar.status);
          const usableUrl = getUsableAvatarUrl(avatar, externalJobId, sectionId);
          if (isDebugEnabled()) {
            debugRows.push({
              sectionId,
              language: lang,
              status: avatar.status,
              hasVideoPath: !!avatar.video_path,
              hasVideoUrl: !!avatar.video_url,
              hasB2Url: !!avatar.b2_url,
              hasVimeoUrl: !!avatar.vimeo_url,
              counted: isCompleted && !!usableUrl,
              rejectedReason: !isCompleted ? 'not_completed' : !usableUrl ? 'missing_url' : null,
            });
          }
          if (!isCompleted || !usableUrl) continue;

          if (!avatarMap[lang]) {
            avatarMap[lang] = {};
            languageCoverage[lang] = 0;
          }
          if (!avatarMap[lang][sectionId]) {
            avatarMap[lang][sectionId] = { avatarUrl: usableUrl, status: 'completed' };
            languageCoverage[lang]++;
          }
        }
      }

      // STRICT full-coverage rule: language shown ONLY if every section has it.
      const languages = SUPPORTED_LANGUAGES
        .filter(lang => {
          if (lang.code === 'english') return totalSections > 0;
          if (totalSections <= 0) return false;
          return (languageCoverage[lang.code] || 0) >= totalSections;
        })
        .map(lang => lang.code);

      if (isDebugEnabled()) {
        const rejectedLanguages = SUPPORTED_LANGUAGES
          .filter(lang => lang.code !== 'english')
          .filter(lang => (languageCoverage[lang.code] || 0) > 0 && (languageCoverage[lang.code] || 0) < totalSections)
          .map(lang => ({ code: lang.code, coverage: languageCoverage[lang.code] || 0, totalSections }));

        console.groupCollapsed?.(`${LANGUAGE_DEBUG_PREFIX} ${externalJobId}`);
        console.log('result', { externalJobId, source, totalSections, languages, languageCoverage, rejectedLanguages });
        console.table?.(debugRows);
        console.groupEnd?.();
        if (!console.groupCollapsed) {
          console.log(`${LANGUAGE_DEBUG_PREFIX} ${externalJobId}`, { totalSections, languages, languageCoverage, rejectedLanguages, debugRows });
        }
      }

      return { languages, avatarMap, totalSections, languageCoverage };
    },
    enabled: !!externalJobId,
    staleTime: 30000,
  });

  return {
    languages: data?.languages || [],
    avatarMap: data?.avatarMap || {},
    isLoading,
    totalSections: data?.totalSections || 0,
    languageCoverage: data?.languageCoverage || {},
  };
}


/**
 * Get display info for a language code
 */
export function getLanguageInfo(code: string): { name: string; flag: string } | null {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
  return lang ? { name: lang.name, flag: lang.flag } : null;
}
