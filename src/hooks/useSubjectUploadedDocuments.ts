import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface SubjectUploadedDocument {
  id: string;
  display_name: string | null;
  file_name: string | null;
  questions_file_name: string | null;
  solutions_file_name: string | null;
  status: string | null;
  questions_count: number | null;
  created_at: string | null;
  questions_file_url: string | null;
  solutions_file_url: string | null;
  category_id: string | null;
  chapter_id: string | null;
  topic_id: string | null;
  document_purpose: string | null;
  chapter?: { id: string; title: string } | null;
  topic?: { id: string; title: string } | null;
}

export function useSubjectUploadedDocuments(subjectId: string) {
  return useQuery({
    queryKey: ["subject-uploaded-documents", subjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uploaded_question_documents")
        .select(`
          id,
          display_name,
          file_name,
          questions_file_name,
          solutions_file_name,
          status,
          questions_count,
          created_at,
          questions_file_url,
          solutions_file_url,
          category_id,
          chapter_id,
          topic_id,
          document_purpose,
          chapter:subject_chapters!chapter_id(id, title),
          topic:subject_topics!topic_id(id, title)
        `)
        .eq("subject_id", subjectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as SubjectUploadedDocument[];
    },
    enabled: !!subjectId,
  });
}

export function useRenameDocument() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      documentId, 
      displayName 
    }: { 
      documentId: string; 
      displayName: string;
    }) => {
      const { error } = await supabase
        .from("uploaded_question_documents")
        .update({ display_name: displayName })
        .eq("id", documentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subject-uploaded-documents"] });
      toast({
        title: "Document Renamed",
        description: "Document name updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Rename Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteUploadedDocument() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ documentId, subjectId }: { documentId: string; subjectId: string }) => {
      // Step 1: Delete questions linked to this document
      const { error: questionsError } = await supabase
        .from("questions")
        .delete()
        .eq("source_document_id", documentId);

      if (questionsError) throw questionsError;

      // Step 2: Delete the document record
      const { error: docError } = await supabase
        .from("uploaded_question_documents")
        .delete()
        .eq("id", documentId);

      if (docError) throw docError;

      return { subjectId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["subject-uploaded-documents", data.subjectId] });
      queryClient.invalidateQueries({ queryKey: ["subject-questions"] });
      queryClient.invalidateQueries({ queryKey: ["questions"] });
      toast({
        title: "Document Deleted",
        description: "Document and extracted questions have been removed",
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
