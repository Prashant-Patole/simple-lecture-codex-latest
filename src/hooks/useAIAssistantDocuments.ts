import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AIAssistantDocument {
  id: string;
  subject_id: string;
  chapter_id: string | null;
  topic_id: string | null;
  display_name: string | null;
  source_type: string;
  source_url: string | null;
  file_name: string | null;
  status: string | null;
  content_preview: string | null;
  full_content: any | null;
  created_at: string | null;
  created_by: string | null;
}

export function useAIAssistantDocuments(
  subjectId: string,
  chapterId?: string | null,
  topicId?: string | null
) {
  return useQuery({
    queryKey: ["ai-assistant-documents", subjectId, chapterId, topicId],
    queryFn: async () => {
      let query = supabase
        .from("ai_assistant_documents")
        .select("*")
        .eq("subject_id", subjectId);

      if (chapterId) {
        query = query.eq("chapter_id", chapterId);
        
        if (topicId) {
          // Topic selected - show only topic-level documents
          query = query.eq("topic_id", topicId);
        } else {
          // Chapter selected but no topic - show only chapter-level documents
          query = query.is("topic_id", null);
        }
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      return data as AIAssistantDocument[];
    },
    enabled: !!subjectId,
  });
}

export function useAddAIAssistantDocument() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      subjectId,
      chapterId,
      topicId,
      displayName,
      sourceType,
      sourceUrl,
      fileName,
      contentPreview,
      fullContent,
    }: {
      subjectId: string;
      chapterId?: string;
      topicId?: string;
      displayName?: string;
      sourceType: "pdf" | "json" | "url" | "docx" | "pptx" | "xlsx" | "image" | "html" | "markdown" | "epub" | "document";
      sourceUrl?: string;
      fileName?: string;
      contentPreview?: string;
      fullContent?: any;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("ai_assistant_documents")
        .insert({
          subject_id: subjectId,
          chapter_id: chapterId || null,
          topic_id: topicId || null,
          display_name: displayName || fileName || "Untitled Document",
          source_type: sourceType,
          source_url: sourceUrl,
          file_name: fileName,
          content_preview: contentPreview?.substring(0, 500),
          full_content: fullContent || null,
          status: "completed",
          created_by: userData.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["ai-assistant-documents"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save document",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteAIAssistantDocument() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ documentId, subjectId }: { documentId: string; subjectId: string }) => {
      const { error } = await supabase
        .from("ai_assistant_documents")
        .delete()
        .eq("id", documentId);

      if (error) throw error;
      return { subjectId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ai-assistant-documents", data.subjectId] });
      toast({
        title: "Document Deleted",
        description: "Document removed from AI assistant",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
