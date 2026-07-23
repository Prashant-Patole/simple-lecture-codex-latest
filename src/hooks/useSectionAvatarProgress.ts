import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Avatar language info from presentation.json
export interface AvatarLanguageInfo {
  language: string;
  video_path: string;
  status: 'completed' | 'processing' | 'pending';
  duration?: number;
  speaker?: string;
  task_id?: string;
}

// Section with avatar languages
export interface SectionWithAvatars {
  section_id: number;
  title: string;
  avatar_languages: AvatarLanguageInfo[];
}

// Hook result type
export interface SectionAvatarProgressResult {
  sections: SectionWithAvatars[];
  avatarStatusMap: Map<string, AvatarLanguageInfo>;
  allLanguagesInData: string[];
  hasProcessingAvatars: boolean;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to poll presentation.json and extract avatar_languages for each section
 * Uses O(n) single-pass to build lookup Map for O(1) cell lookups
 */
export function useSectionAvatarProgress(
  externalJobId: string | null,
  serverIp?: string,
  isGenerating: boolean = false
): SectionAvatarProgressResult {
  const query = useQuery({
    queryKey: ['section-avatar-progress', externalJobId],
    queryFn: async (): Promise<SectionWithAvatars[]> => {
      if (!externalJobId) return [];

      const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
        body: {
          action: 'review',
          job_id: externalJobId,
          server_ip: serverIp,
        },
      });

      if (error) throw error;

      // O(n) single pass to extract sections with avatar_languages
      const sections: SectionWithAvatars[] = [];
      const rawSections = data.sections || [];

      for (let i = 0; i < rawSections.length; i++) {
        const section = rawSections[i];
        // Only include sections that have narration (can have avatars)
        const hasNarration = section.narration?.full_text || 
          section.narration?.segments?.length > 0 ||
          section.explanation_plan?.visual_beats?.some((b: any) => b.segments?.length > 0);

        if (hasNarration) {
          sections.push({
            section_id: section.section_id ?? i,
            title: section.title || `Section ${i}`,
            avatar_languages: (section.avatar_languages || []).map((avatar: any) => ({
              language: avatar.language,
              video_path: avatar.video_path,
              status: avatar.status || 'pending',
              duration: avatar.duration,
              speaker: avatar.speaker,
              task_id: avatar.task_id,
            })),
          });
        }
      }

      return sections;
    },
    enabled: !!externalJobId,
    refetchInterval: 5000, // Always poll when enabled, we'll control via hasProcessingAvatars
    staleTime: 3000,
  });

  const sections = query.data || [];

  // O(n) single pass to build lookup Map AND extract languages AND check processing
  const { avatarStatusMap, allLanguagesInData, hasProcessingAvatars } = useMemo(() => {
    const map = new Map<string, AvatarLanguageInfo>();
    const languageSet = new Set<string>();
    let hasProcessing = false;

    for (const section of sections) {
      for (const avatar of section.avatar_languages) {
        // Key format: "sectionId_language" for O(1) lookup
        map.set(`${section.section_id}_${avatar.language}`, avatar);
        languageSet.add(avatar.language);
        if (avatar.status === 'processing') hasProcessing = true;
      }
    }

    return {
      avatarStatusMap: map,
      allLanguagesInData: Array.from(languageSet),
      hasProcessingAvatars: hasProcessing,
    };
  }, [sections]);

  return {
    sections,
    avatarStatusMap,
    allLanguagesInData,
    hasProcessingAvatars,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

/**
 * Pure utility: returns language codes where ALL sections have completed avatars
 */
export function getCompletedLanguages(
  sections: SectionWithAvatars[],
  avatarStatusMap: Map<string, AvatarLanguageInfo>,
  allLanguages: string[]
): string[] {
  if (sections.length === 0) return [];
  const result: string[] = [];
  for (const lang of allLanguages) {
    let allDone = true;
    for (const section of sections) {
      const avatar = avatarStatusMap.get(`${section.section_id}_${lang}`);
      if (!avatar || avatar.status !== 'completed') {
        allDone = false;
        break;
      }
    }
    if (allDone) result.push(lang);
  }
  return result;
}

/**
 * Compute progress stats for all languages in a single O(n) pass
 */
export function useProgressStats(
  sections: SectionWithAvatars[],
  selectedLanguages: string[],
  avatarStatusMap: Map<string, AvatarLanguageInfo>
): Map<string, { completed: number; total: number }> {
  return useMemo(() => {
    const stats = new Map<string, { completed: number; total: number }>();

    // Initialize stats for all selected languages
    for (const lang of selectedLanguages) {
      stats.set(lang, { completed: 0, total: 0 });
    }

    // O(sections × languages) single pass - still O(n) where n = total cells
    for (const section of sections) {
      for (const lang of selectedLanguages) {
        const current = stats.get(lang)!;
        current.total++;

        const avatar = avatarStatusMap.get(`${section.section_id}_${lang}`);
        if (avatar?.status === 'completed') {
          current.completed++;
        }
      }
    }

    return stats;
  }, [sections, selectedLanguages, avatarStatusMap]);
}
