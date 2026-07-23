import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// Types for optimized queries
export interface SubjectTopicWithDetails {
  id: string;
  topic_number: number | string;
  title: string;
  estimated_duration_minutes?: number;
  video_id?: string;
  video_platform?: string;
  pdf_url?: string;
  notes_markdown?: string;
  content_markdown?: string;
  sequence_order: number;
  chapter_id: string;
}

export interface SubjectChapterWithTopics {
  id: string;
  subject_id: string;
  chapter_number: number;
  title: string;
  description?: string;
  sequence_order: number;
  video_id?: string;
  video_platform?: string;
  notes_markdown?: string;
  pdf_url?: string;
  content_json?: any;
  subject_topics: SubjectTopicWithDetails[];
}

// Cache configuration - 5 min stale, 30 min gc
const QUERY_CONFIG = {
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 30,
};

/**
 * Optimized hook: Fetches ALL chapters with their topics in ONE query
 * Eliminates N+1 problem (was: 1 query per chapter for topics)
 */
export const useSubjectChaptersWithTopics = (subjectId?: string) => {
  return useQuery({
    queryKey: ["subject-chapters-with-topics", subjectId],
    ...QUERY_CONFIG,
    queryFn: async () => {
      if (!subjectId) return [];

      const { data, error } = await supabase
        .from("subject_chapters")
        .select(`
          id, subject_id, chapter_number, title, description, sequence_order,
          video_id, video_platform, notes_markdown, pdf_url, content_json,
          subject_topics (
            id, topic_number, title, estimated_duration_minutes,
            video_id, video_platform, pdf_url, notes_markdown, content_markdown, sequence_order, chapter_id
          )
        `)
        .eq("subject_id", subjectId)
        .order("sequence_order");

      if (error) throw error;
      
      // Sort topics by sequence_order within each chapter
      return (data || []).map(chapter => ({
        ...chapter,
        subject_topics: (chapter.subject_topics || []).sort(
          (a: any, b: any) => (a.sequence_order || 0) - (b.sequence_order || 0)
        )
      })) as SubjectChapterWithTopics[];
    },
    enabled: !!subjectId,
  });
};

/**
 * Fetches chapters + topics for every subject in a course (parallelized).
 * Returns an array of { subject_id, subject_name, chapters: SubjectChapterWithTopics[] }.
 */
export const useCourseChaptersWithTopics = (
  subjects: Array<{ id: string; name: string }>
) => {
  const ids = subjects.map(s => s.id).filter(Boolean).sort().join(',');
  return useQuery({
    queryKey: ['course-chapters-with-topics', ids],
    ...QUERY_CONFIG,
    enabled: subjects.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        subjects.map(async (s) => {
          const { data, error } = await supabase
            .from('subject_chapters')
            .select(`
              id, subject_id, chapter_number, title, sequence_order,
              subject_topics ( id, topic_number, title, estimated_duration_minutes, sequence_order, chapter_id )
            `)
            .eq('subject_id', s.id)
            .order('sequence_order');
          if (error) throw error;
          const chapters = (data || []).map((c: any) => ({
            ...c,
            subject_topics: (c.subject_topics || []).sort(
              (a: any, b: any) => (a.sequence_order || 0) - (b.sequence_order || 0)
            ),
          })) as SubjectChapterWithTopics[];
          return { subject_id: s.id, subject_name: s.name, chapters };
        })
      );
      return results;
    },
  });
};


/**
 * O(1) batch update for chapter orders using RPC
 * Replaces N parallel API calls with single RPC call
 */
export const useBatchUpdateChapterOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      chapters,
      subjectId,
    }: {
      chapters: Array<{ id: string; sequence_order: number }>;
      subjectId: string;
    }) => {
      const { error } = await supabase.rpc('update_chapter_orders', {
        chapter_ids: chapters.map(c => c.id),
        new_orders: chapters.map(c => c.sequence_order)
      });

      if (error) throw error;
      return { subjectId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["subject-chapters-with-topics", data.subjectId] });
      queryClient.invalidateQueries({ queryKey: ["subject-chapters", data.subjectId] });
      toast({ title: "Success", description: "Chapter order updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: "Failed to update order: " + error.message, variant: "destructive" });
    },
  });
};

/**
 * O(1) batch update for topic orders using RPC
 * Replaces N parallel API calls with single RPC call
 */
export const useBatchUpdateTopicOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      topics,
      chapterId,
      subjectId,
    }: {
      topics: Array<{ id: string; sequence_order: number }>;
      chapterId: string;
      subjectId: string;
    }) => {
      const { error } = await supabase.rpc('update_topic_orders', {
        topic_ids: topics.map(t => t.id),
        new_orders: topics.map(t => t.sequence_order)
      });

      if (error) throw error;
      return { chapterId, subjectId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["subject-chapters-with-topics", data.subjectId] });
      queryClient.invalidateQueries({ queryKey: ["subject-topics", data.chapterId] });
      toast({ title: "Success", description: "Topic order updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: "Failed to update order: " + error.message, variant: "destructive" });
    },
  });
};

/**
 * O(1) batch update for subtopic orders using RPC
 */
export const useBatchUpdateSubtopicOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subtopics,
    }: {
      subtopics: Array<{ id: string; sequence_order: number }>;
    }) => {
      const { error } = await supabase.rpc('update_subtopic_orders', {
        subtopic_ids: subtopics.map(s => s.id),
        new_orders: subtopics.map(s => s.sequence_order)
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtopics"] });
      toast({ title: "Success", description: "Subtopic order updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: "Failed to update order: " + error.message, variant: "destructive" });
    },
  });
};

// Helper to normalize topic numbers for comparison (handles numeric/string from DB)
const normalizeTopicNumber = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

/**
 * Optimized bulk import using batch inserts
 * O(2-3) database calls instead of O(chapters + topics) sequential calls
 */
export const useOptimizedBulkImport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subjectId,
      chapters,
    }: {
      subjectId: string;
      chapters: Array<{
        chapter_number: number;
        title: string;
        description?: string;
        topics?: Array<{
          topic_number: number | string;
          title: string;
          estimated_duration_minutes?: number;
          content_markdown?: string;
          subtopics?: Array<{
            title: string;
            description?: string;
            estimated_duration_minutes?: number;
            sequence_order: number;
          }>;
        }>;
      }>;
    }) => {
      const results = {
        chapters: 0,
        topics: 0,
        subtopics: 0,
        skippedChapters: 0,
        skippedTopics: 0,
        errors: [] as string[],
      };

      // Phase 1: Fetch existing chapters with O(1) Map lookup
      const { data: existingChapters, error: fetchError } = await supabase
        .from("subject_chapters")
        .select("id, chapter_number, title")
        .eq("subject_id", subjectId);

      if (fetchError) {
        throw new Error(`Failed to fetch existing chapters: ${fetchError.message}`);
      }

      const existingChapterMap = new Map(
        existingChapters?.map((c) => [c.chapter_number, c]) || []
      );

      // Phase 2: Separate new chapters from existing
      const newChapters = chapters.filter(c => !existingChapterMap.has(c.chapter_number));
      const chaptersToProcess = chapters.filter(c => existingChapterMap.has(c.chapter_number));

      // Phase 3: Batch insert new chapters
      let insertedChaptersMap = new Map<number, string>();
      
      if (newChapters.length > 0) {
        const { data: insertedChapters, error: insertError } = await supabase
          .from("subject_chapters")
          .insert(
            newChapters.map(c => ({
              subject_id: subjectId,
              chapter_number: c.chapter_number,
              title: c.title,
              description: c.description,
              sequence_order: c.chapter_number,
            }))
          )
          .select();

        if (insertError) {
          results.errors.push(`Failed to insert chapters: ${insertError.message}`);
        } else {
          results.chapters = insertedChapters?.length || 0;
          insertedChapters?.forEach(c => insertedChaptersMap.set(c.chapter_number, c.id));
        }
      }

      results.skippedChapters = chaptersToProcess.length;

      // Phase 4: Build complete chapter ID map
      const chapterIdMap = new Map<number, string>();
      existingChapterMap.forEach((c, num) => chapterIdMap.set(num, c.id));
      insertedChaptersMap.forEach((id, num) => chapterIdMap.set(num, id));

      // Phase 5: Collect all topics that need to be inserted
      const allTopicsToInsert: Array<{
        chapter_id: string;
        topic_number: string;
        title: string;
        estimated_duration_minutes?: number;
        content_markdown?: string;
        sequence_order: number;
        subtopics?: Array<any>;
      }> = [];

      // Track seen keys for within-batch deduplication
      const seenTopicKeys = new Set<string>();

      for (const chapter of chapters) {
        const chapterId = chapterIdMap.get(chapter.chapter_number);
        if (!chapterId || !chapter.topics) continue;

        // Fetch existing topics for this chapter
        const { data: existingTopics } = await supabase
          .from("subject_topics")
          .select("topic_number")
          .eq("chapter_id", chapterId);

        const existingTopicNumbers = new Set<string>(
          existingTopics?.map((t) => normalizeTopicNumber(t.topic_number)) || []
        );

        for (const topic of chapter.topics) {
          if (existingTopicNumbers.has(normalizeTopicNumber(topic.topic_number))) {
            results.skippedTopics++;
            continue;
          }

          // Within-batch deduplication
          const compositeKey = `${chapterId}|${normalizeTopicNumber(topic.topic_number)}`;
          if (seenTopicKeys.has(compositeKey)) {
            results.skippedTopics++;
            continue;
          }
          seenTopicKeys.add(compositeKey);

          allTopicsToInsert.push({
            chapter_id: chapterId,
            topic_number: String(topic.topic_number),
            title: topic.title,
            estimated_duration_minutes: topic.estimated_duration_minutes,
            content_markdown: topic.content_markdown,
            sequence_order: typeof topic.topic_number === 'number' ? topic.topic_number : parseFloat(String(topic.topic_number)) || 0,
            subtopics: topic.subtopics,
          });
        }
      }

      // Phase 6: Batch insert all new topics
      if (allTopicsToInsert.length > 0) {
        const topicsWithoutSubtopics = allTopicsToInsert.map(({ subtopics, ...t }) => t);
        
        const { data: insertedTopics, error: topicsError } = await supabase
          .from("subject_topics")
          .upsert(topicsWithoutSubtopics, { onConflict: 'chapter_id,topic_number', ignoreDuplicates: true })
          .select();

        if (topicsError) {
          results.errors.push(`Failed to insert topics: ${topicsError.message}`);
        } else {
          results.topics = insertedTopics?.length || 0;

          // Phase 7: Batch insert subtopics
          const allSubtopicsToInsert: Array<any> = [];
          insertedTopics?.forEach((insertedTopic, index) => {
            const originalTopic = allTopicsToInsert[index];
            if (originalTopic?.subtopics?.length) {
              originalTopic.subtopics.forEach((subtopic, subIndex) => {
                allSubtopicsToInsert.push({
                  topic_id: insertedTopic.id,
                  title: subtopic.title,
                  description: subtopic.description,
                  estimated_duration_minutes: subtopic.estimated_duration_minutes,
                  sequence_order: subtopic.sequence_order || subIndex + 1,
                });
              });
            }
          });

          if (allSubtopicsToInsert.length > 0) {
            const { error: subtopicsError } = await supabase
              .from("subtopics")
              .upsert(allSubtopicsToInsert, { onConflict: 'topic_id,sequence_order', ignoreDuplicates: true });

            if (subtopicsError) {
              results.errors.push(`Failed to insert subtopics: ${subtopicsError.message}`);
            } else {
              results.subtopics = allSubtopicsToInsert.length;
            }
          }
        }
      }

      return results;
    },
    onSuccess: (results, variables) => {
      queryClient.invalidateQueries({ queryKey: ["subject-chapters-with-topics", variables.subjectId] });
      queryClient.invalidateQueries({ queryKey: ["subject-chapters", variables.subjectId] });
      queryClient.invalidateQueries({ queryKey: ["subject-topics"] });
      queryClient.invalidateQueries({ queryKey: ["subtopics"] });

      const parts: string[] = [];

      if (results.chapters > 0 || results.topics > 0 || results.subtopics > 0) {
        parts.push(`Imported: ${results.chapters} chapters, ${results.topics} topics, ${results.subtopics} subtopics`);
      }

      if (results.skippedChapters > 0) {
        parts.push(`Used ${results.skippedChapters} existing chapter(s)`);
      }

      if (results.skippedTopics > 0) {
        parts.push(`Skipped ${results.skippedTopics} existing topic(s)`);
      }

      if (results.errors.length > 0) {
        parts.push(`${results.errors.length} error(s) - check console`);
      }

      const message = parts.join(" | ") || "No changes made";

      toast({
        title: "Import Complete",
        description: message,
      });

      if (results.errors.length > 0) {
        console.log("Import errors:", results.errors);
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: "Bulk import failed: " + error.message, variant: "destructive" });
    },
  });
};
