import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 20;

export interface PaginatedQuestion {
  id: string;
  question_text: string;
  question_type: string;
  question_format: string;
  options?: Record<string, any>;
  correct_answer: string;
  explanation?: string;
  marks: number;
  difficulty: string;
  topic_id?: string;
  subtopic_id?: string;
  is_verified: boolean;
  is_ai_generated: boolean;
  is_important?: boolean;
  question_image_url?: string;
  option_images?: Record<string, string>;
  contains_formula: boolean;
  formula_type?: string;
  previous_year_paper_id?: string;
  created_at: string;
  chapter_id?: string;
  subject_topics?: {
    id: string;
    title: string;
    chapter_id: string;
    subject_chapters: {
      id: string;
      title: string;
      subject_id: string;
    };
  } | null;
}

export interface PaginatedQuestionsFilters {
  subjectId?: string;
  isAiGenerated?: boolean;
  difficulty?: string;
  topicId?: string;
  chapterId?: string;
  isVerified?: boolean;
  searchQuery?: string;
  chapterOnly?: boolean;
}

// Helper to fetch chapter IDs for a subject
async function getChapterIdsForSubject(subjectId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("subject_chapters")
    .select("id")
    .eq("subject_id", subjectId);
  
  if (error) throw error;
  return data?.map(c => c.id) || [];
}

// Helper to fetch topic IDs for chapters
async function getTopicIdsForChapters(chapterIds: string[]): Promise<string[]> {
  if (chapterIds.length === 0) return [];
  
  const { data, error } = await supabase
    .from("subject_topics")
    .select("id")
    .in("chapter_id", chapterIds);
  
  if (error) throw error;
  return data?.map(t => t.id) || [];
}

// Helper to fetch topic IDs for a single chapter
async function getTopicIdsForChapter(chapterId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("subject_topics")
    .select("id")
    .eq("chapter_id", chapterId);
  
  if (error) throw error;
  return data?.map(t => t.id) || [];
}

export const usePaginatedQuestions = (filters: PaginatedQuestionsFilters) => {
  return useInfiniteQuery({
    queryKey: ["paginated-questions", filters],
    queryFn: async ({ pageParam = 0 }) => {
      // Pre-fetch IDs for subject/chapter filtering
      let topicIdsForFilter: string[] | null = null;
      let chapterIdsForFilter: string[] | null = null;

      // If filtering by subject, get all chapter IDs and topic IDs for that subject
      if (filters.subjectId) {
        chapterIdsForFilter = await getChapterIdsForSubject(filters.subjectId);
        if (chapterIdsForFilter.length > 0) {
          topicIdsForFilter = await getTopicIdsForChapters(chapterIdsForFilter);
        } else {
          // No chapters found for this subject - return empty
          return {
            questions: [] as PaginatedQuestion[],
            nextCursor: undefined,
            totalCount: 0,
          };
        }
      }

      // If filtering by chapter (and not chapterOnly), get topic IDs for that chapter
      if (filters.chapterId && !filters.chapterOnly) {
        const topicsForChapter = await getTopicIdsForChapter(filters.chapterId);
        topicIdsForFilter = topicsForChapter;
        chapterIdsForFilter = [filters.chapterId];
      }

      // Build the main query with LEFT JOIN for subject_topics
      let query = supabase
        .from("questions")
        .select(`
          *,
          subject_topics(
            id,
            title,
            chapter_id,
            subject_chapters(
              id,
              title,
              subject_id
            )
          )
        `, { count: "exact" });

      // Apply subject filter using pre-fetched IDs
      if (filters.subjectId && topicIdsForFilter !== null && chapterIdsForFilter !== null) {
        if (topicIdsForFilter.length > 0 && chapterIdsForFilter.length > 0) {
          // Questions with topic_id in our topics OR chapter-level questions (topic_id is null, chapter_id in our chapters)
          query = query.or(
            `topic_id.in.(${topicIdsForFilter.join(',')}),and(topic_id.is.null,chapter_id.in.(${chapterIdsForFilter.join(',')}))`
          );
        } else if (topicIdsForFilter.length > 0) {
          query = query.in('topic_id', topicIdsForFilter);
        } else if (chapterIdsForFilter.length > 0) {
          // Only chapter-level questions
          query = query.is('topic_id', null).in('chapter_id', chapterIdsForFilter);
        }
      }

      // Filter by AI-generated status
      if (filters.isAiGenerated !== undefined) {
        query = query.eq('is_ai_generated', filters.isAiGenerated);
      }

      // Filter by topic (direct filter, simple)
      if (filters.topicId) {
        query = query.eq("topic_id", filters.topicId);
      }

      // Filter by chapter using pre-fetched IDs
      if (filters.chapterId) {
        if (filters.chapterOnly) {
          // Only show chapter-level questions (topic_id is NULL)
          query = query.eq("chapter_id", filters.chapterId).is("topic_id", null);
        } else if (topicIdsForFilter !== null) {
          // Already handled above with subject filter logic, but if only chapterId is set:
          if (!filters.subjectId) {
            if (topicIdsForFilter.length > 0) {
              query = query.or(
                `topic_id.in.(${topicIdsForFilter.join(',')}),and(topic_id.is.null,chapter_id.eq.${filters.chapterId})`
              );
            } else {
              // No topics in this chapter, only chapter-level questions
              query = query.is('topic_id', null).eq('chapter_id', filters.chapterId);
            }
          }
        }
      }

      // Filter by difficulty
      if (filters.difficulty) {
        query = query.eq("difficulty", filters.difficulty);
      }

      // Filter by verified status
      if (filters.isVerified !== undefined) {
        query = query.eq("is_verified", filters.isVerified);
      }

      // Server-side search
      if (filters.searchQuery) {
        query = query.ilike("question_text", `%${filters.searchQuery}%`);
      }

      // Order and paginate
      query = query
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        questions: data as PaginatedQuestion[],
        nextCursor: (pageParam + PAGE_SIZE < (count || 0)) ? pageParam + PAGE_SIZE : undefined,
        totalCount: count || 0,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    placeholderData: (previousData) => previousData,
  });
};
