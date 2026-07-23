import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// Types
export interface SubjectCategory {
  id: string;
  subject_id: string;
  category_id: string;
  created_at: string;
  categories?: {
    id: string;
    name: string;
    slug: string;
    parent_id: string | null;
    level: number;
  };
}

export interface SubjectChapter {
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
  ai_generated_video_url?: string;
  ai_generated_podcast_url?: string;
  created_at: string;
  updated_at: string;
}

export interface SubjectTopic {
  id: string;
  chapter_id: string;
  topic_number: number | string;
  title: string;
  estimated_duration_minutes?: number;
  video_id?: string;
  video_platform?: string;
  notes_markdown?: string;
  content_markdown?: string;
  pdf_url?: string;
  content_json?: any;
  ai_generated_video_url?: string;
  ai_generated_podcast_url?: string;
  sequence_order: number;
  created_at: string;
  updated_at: string;
}

// Category hooks
export const useSubjectCategories = (subjectId?: string) => {
  return useQuery({
    queryKey: ["subject-categories", subjectId],
    queryFn: async () => {
      if (!subjectId) return [];
      
      const { data: subject, error } = await supabase
        .from("popular_subjects")
        .select("category_id, categories(id, name)")
        .eq("id", subjectId)
        .single();

      if (error) throw error;
      
      if (subject?.category_id) {
        return [{
          subject_id: subjectId,
          category_id: subject.category_id,
          categories: (subject as any).categories
        }];
      }
      
      return [];
    },
    enabled: !!subjectId,
  });
};

export const useAllCategoriesHierarchy = () => {
  return useQuery({
    queryKey: ["categories-hierarchy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("level")
        .order("display_order");

      if (error) throw error;
      
      // Build hierarchy display strings
      const categoryMap = new Map(data.map(cat => [cat.id, cat]));
      
      return data.map(category => {
        const path: string[] = [];
        let current = category;
        
        while (current) {
          path.unshift(current.name);
          current = current.parent_id ? categoryMap.get(current.parent_id) : null;
        }
        
        return {
          ...category,
          displayName: path.join(" - "),
          path,
        };
      });
    },
  });
};

export const useUpdateSubjectCategories = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subjectId,
      categoryIds,
    }: {
      subjectId: string;
      categoryIds: string[];
    }) => {
      if (categoryIds.length === 0) {
        throw new Error("Please select a category");
      }
      
      const { error } = await supabase
        .from("popular_subjects")
        .update({ category_id: categoryIds[0] })
        .eq("id", subjectId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["subject-categories", variables.subjectId] });
      queryClient.invalidateQueries({ queryKey: ["admin-popular-subjects"] });
      toast({ title: "Success", description: "Category updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: "Failed to update category: " + error.message, variant: "destructive" });
    },
  });
};

// Chapter hooks
export const useSubjectChapters = (subjectId?: string) => {
  return useQuery({
    queryKey: ["subject-chapters", subjectId],
    staleTime: 1000 * 60 * 5,  // 5 minutes - chapters rarely change
    gcTime: 1000 * 60 * 30,    // 30 minutes cache
    queryFn: async () => {
      if (!subjectId) return [];
      
      const { data, error } = await supabase
        .from("subject_chapters")
        .select("*")
        .eq("subject_id", subjectId)
        .order("sequence_order");

      if (error) throw error;
      return data as SubjectChapter[];
    },
    enabled: !!subjectId,
  });
};

// Whitelist of allowed columns for subject_chapters table
const CHAPTER_ALLOWED_FIELDS = [
  'subject_id', 'chapter_number', 'title', 'description', 'sequence_order',
  'video_id', 'video_platform', 'notes_markdown', 'pdf_url', 'content_json',
  'ai_generated_video_url', 'ai_generated_podcast_url'
] as const;

const sanitizeChapterData = (data: Record<string, any>): Record<string, any> => {
  const sanitized: Record<string, any> = {};
  for (const key of CHAPTER_ALLOWED_FIELDS) {
    if (key in data) {
      sanitized[key] = data[key];
    }
  }
  return sanitized;
};

export const useCreateChapter = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (chapter: Omit<SubjectChapter, "id" | "created_at" | "updated_at">) => {
      // Sanitize to only include allowed fields
      const sanitizedChapter = sanitizeChapterData(chapter as Record<string, any>);
      
      const { data, error } = await supabase
        .from("subject_chapters")
        .insert(sanitizedChapter as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["subject-chapters", data.subject_id] });
      toast({ title: "Success", description: "Chapter created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: "Failed to create chapter: " + error.message, variant: "destructive" });
    },
  });
};

export const useUpdateChapter = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<SubjectChapter>;
    }) => {
      // Sanitize to only include allowed fields
      const sanitizedUpdates = sanitizeChapterData(updates as Record<string, any>);
      
      const { data, error } = await supabase
        .from("subject_chapters")
        .update(sanitizedUpdates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["subject-chapters", data.subject_id] });
      toast({ title: "Success", description: "Chapter updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: "Failed to update chapter: " + error.message, variant: "destructive" });
    },
  });
};

export const useDeleteChapter = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, subjectId }: { id: string; subjectId: string }) => {
      const { error } = await supabase
        .from("subject_chapters")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { subjectId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["subject-chapters", data.subjectId] });
      toast({ title: "Success", description: "Chapter deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: "Failed to delete chapter: " + error.message, variant: "destructive" });
    },
  });
};

// Topic hooks
export const useChapterTopics = (chapterId?: string) => {
  return useQuery({
    queryKey: ["subject-topics", chapterId],
    staleTime: 1000 * 60 * 5,  // 5 minutes - topics rarely change
    gcTime: 1000 * 60 * 30,    // 30 minutes cache
    queryFn: async () => {
      if (!chapterId) return [];
      
      const { data, error } = await supabase
        .from("subject_topics")
        .select("*")
        .eq("chapter_id", chapterId)
        .order("sequence_order");

      if (error) throw error;
      return data as SubjectTopic[];
    },
    enabled: !!chapterId,
  });
};

// Helper to normalize topic numbers for comparison (handles numeric/string from DB)
const normalizeTopicNumber = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

// Whitelist of allowed columns for subject_topics table
const TOPIC_ALLOWED_FIELDS = [
  'chapter_id', 'topic_number', 'title', 'estimated_duration_minutes', 'video_url',
  'content_markdown', 'sequence_order', 'video_id', 'video_platform', 'notes_markdown',
  'pdf_url', 'content_json', 'ai_generated_video_url', 'ai_generated_podcast_url'
] as const;

const sanitizeTopicData = (data: Record<string, any>): Record<string, any> => {
  const sanitized: Record<string, any> = {};
  for (const key of TOPIC_ALLOWED_FIELDS) {
    if (key in data) {
      sanitized[key] = data[key];
    }
  }
  return sanitized;
};

export const useCreateTopic = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (topic: Omit<SubjectTopic, "id" | "created_at" | "updated_at">) => {
      // Sanitize to only include allowed fields
      const sanitizedTopic = sanitizeTopicData(topic as Record<string, any>);
      
      const { data, error } = await supabase
        .from("subject_topics")
        .insert(sanitizedTopic as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["subject-topics", data.chapter_id] });
      toast({ title: "Success", description: "Topic created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: "Failed to create topic: " + error.message, variant: "destructive" });
    },
  });
};

export const useUpdateTopic = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<SubjectTopic>;
    }) => {
      // Sanitize to only include allowed fields
      const sanitizedUpdates = sanitizeTopicData(updates as Record<string, any>);
      
      const { data, error } = await supabase
        .from("subject_topics")
        .update(sanitizedUpdates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["subject-topics", data.chapter_id] });
      toast({ title: "Success", description: "Topic updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: "Failed to update topic: " + error.message, variant: "destructive" });
    },
  });
};

export const useDeleteTopic = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, chapterId }: { id: string; chapterId: string }) => {
      const { error } = await supabase
        .from("subject_topics")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { chapterId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["subject-topics", data.chapterId] });
      toast({ title: "Success", description: "Topic deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: "Failed to delete topic: " + error.message, variant: "destructive" });
    },
  });
};

export const useUpdateTopicContent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      topicId,
      content_markdown,
      notes_markdown,
    }: {
      topicId: string;
      content_markdown: string;
      notes_markdown: string;
    }) => {
      const { data, error } = await supabase
        .from("subject_topics")
        .update({
          content_markdown,
          notes_markdown,
          updated_at: new Date().toISOString(),
        })
        .eq("id", topicId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["subject-topics", data.chapter_id] });
      toast({ title: "Success", description: "Topic content updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: "Failed to update topic content: " + error.message, variant: "destructive" });
    },
  });
};

// Order update hooks
export const useUpdateChapterOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      chapters,
    }: {
      chapters: Array<{ id: string; sequence_order: number }>;
    }) => {
      const updates = chapters.map((chapter) =>
        supabase
          .from("subject_chapters")
          .update({ sequence_order: chapter.sequence_order })
          .eq("id", chapter.id)
      );

      const results = await Promise.all(updates);
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) throw errors[0].error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subject-chapters"] });
      toast({ title: "Success", description: "Chapter order updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: "Failed to update order: " + error.message, variant: "destructive" });
    },
  });
};

export const useUpdateTopicOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      topics,
    }: {
      topics: Array<{ id: string; sequence_order: number }>;
    }) => {
      const updates = topics.map((topic) =>
        supabase
          .from("subject_topics")
          .update({ sequence_order: topic.sequence_order })
          .eq("id", topic.id)
      );

      const results = await Promise.all(updates);
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) throw errors[0].error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subject-topics"] });
      toast({ title: "Success", description: "Topic order updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: "Failed to update order: " + error.message, variant: "destructive" });
    },
  });
};

export const useUpdateSubtopicOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subtopics,
    }: {
      subtopics: Array<{ id: string; sequence_order: number }>;
    }) => {
      const updates = subtopics.map((subtopic) =>
        supabase
          .from("subtopics")
          .update({ sequence_order: subtopic.sequence_order })
          .eq("id", subtopic.id)
      );

      const results = await Promise.all(updates);
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) throw errors[0].error;
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

// Bulk import hook
export const useBulkImportChapters = () => {
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
        errors: [] as string[] 
      };

      // Fetch existing chapters with their IDs
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

      for (const chapter of chapters) {
        try {
          let chapterId: string;
          
          // Check if chapter already exists
          const existingChapter = existingChapterMap.get(chapter.chapter_number);
          
          if (existingChapter) {
            // Use existing chapter ID, proceed to import topics
            chapterId = existingChapter.id;
            results.skippedChapters++;
          } else {
            // Create new chapter
            const { data: chapterData, error: chapterError } = await supabase
              .from("subject_chapters")
              .insert({
                subject_id: subjectId,
                chapter_number: chapter.chapter_number,
                title: chapter.title,
                description: chapter.description,
                sequence_order: chapter.chapter_number,
              })
              .select()
              .single();

            if (chapterError) throw chapterError;
            chapterId = chapterData.id;
            results.chapters++;
          }

          if (chapter.topics && chapter.topics.length > 0) {
            // Fetch existing topics for this chapter
            const { data: existingTopics } = await supabase
              .from("subject_topics")
              .select("topic_number")
              .eq("chapter_id", chapterId);

            // Use normalized string comparison for robustness with numeric types
            const existingTopicNumbers = new Set<string>(
              existingTopics?.map((t) => normalizeTopicNumber(t.topic_number)) || []
            );

            for (const topic of chapter.topics) {
              try {
                // Skip if topic already exists
                if (existingTopicNumbers.has(normalizeTopicNumber(topic.topic_number))) {
                  results.skippedTopics++;
                  continue;
                }

                const { data: topicData, error: topicError } = await supabase
                  .from("subject_topics")
                  .insert([{
                    chapter_id: chapterId,
                    topic_number: String(topic.topic_number),
                    title: topic.title,
                    estimated_duration_minutes: topic.estimated_duration_minutes,
                    content_markdown: topic.content_markdown,
                    sequence_order: typeof topic.topic_number === 'number' ? topic.topic_number : parseFloat(String(topic.topic_number)) || 0,
                  }])
                  .select()
                  .single();

                if (topicError) {
                  results.errors.push(
                    `Chapter ${chapter.chapter_number}, Topic ${topic.topic_number}: ${topicError.message}`
                  );
                  continue;
                }
                
                results.topics++;

                // Handle subtopics
                if (topic.subtopics && topic.subtopics.length > 0) {
                  try {
                    const subtopicsToInsert = topic.subtopics.map((subtopic, index) => ({
                      topic_id: topicData.id,
                      title: subtopic.title,
                      description: subtopic.description,
                      estimated_duration_minutes: subtopic.estimated_duration_minutes,
                      sequence_order: subtopic.sequence_order || index + 1,
                    }));

                    const { error: subtopicsError } = await supabase
                      .from("subtopics")
                      .insert(subtopicsToInsert);

                    if (subtopicsError) {
                      results.errors.push(
                        `Chapter ${chapter.chapter_number}, Topic ${topic.topic_number} subtopics: ${subtopicsError.message}`
                      );
                    } else {
                      results.subtopics += subtopicsToInsert.length;
                    }
                  } catch (subtopicError) {
                    results.errors.push(
                      `Chapter ${chapter.chapter_number}, Topic ${topic.topic_number} subtopics: ${subtopicError instanceof Error ? subtopicError.message : "Unknown error"}`
                    );
                  }
                }
              } catch (topicError) {
                results.errors.push(
                  `Chapter ${chapter.chapter_number}, Topic ${topic.topic_number}: ${topicError instanceof Error ? topicError.message : "Unknown error"}`
                );
              }
            }
          }
        } catch (error) {
          results.errors.push(
            `Chapter ${chapter.chapter_number}: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      }

      return results;
    },
    onSuccess: (results, variables) => {
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
