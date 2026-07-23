import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DPPDocument {
  id: string;
  subject_id: string;
  chapter_id: string | null;
  topic_id: string | null;
  display_name: string | null;
  questions_file_url: string | null;
  solutions_file_url: string | null;
  status: string;
  questions_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export const useDPPDocuments = (subjectId: string | undefined) => {
  return useQuery({
    queryKey: ['dpp-documents', subjectId],
    queryFn: async () => {
      if (!subjectId) return [];
      
      const { data, error } = await supabase
        .from('dpp_documents')
        .select('*, topic:subject_topics(id, title)')
        .eq('subject_id', subjectId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as (DPPDocument & { topic?: { id: string; title: string } })[];
    },
    enabled: !!subjectId
  });
};

export const useDPPQuestions = (documentId: string | undefined) => {
  return useQuery({
    queryKey: ['dpp-questions', documentId],
    queryFn: async () => {
      if (!documentId) return [];
      
      // Query questions table with source_document_id (not dpp_questions)
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('source_document_id', documentId)
        .order('id', { ascending: true });
      
      if (error) throw error;
      
      // Transform to expected format
      return data.map((q, index) => ({
        id: q.id,
        document_id: documentId,
        question_number: index + 1,
        question_text: q.question_text,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        difficulty: q.difficulty,
      }));
    },
    enabled: !!documentId
  });
};

export const useCreateDPPDocument = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      subject_id: string;
      chapter_id: string;
      topic_id: string;
      display_name: string;
      questions_file_url: string;
      solutions_file_url?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: document, error } = await supabase
        .from('dpp_documents')
        .insert({
          ...data,
          created_by: user?.id,
          status: 'pending'
        })
        .select()
        .single();
      
      if (error) throw error;
      return document;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dpp-documents', data.subject_id] });
      toast({
        title: "Document uploaded",
        description: "DPP document has been uploaded. You can now extract questions."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
};

export const useExtractDPPQuestions = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (documentId: string) => {
      const { data, error } = await supabase.functions.invoke('extract-dpp-questions', {
        body: { documentId }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data, documentId) => {
      queryClient.invalidateQueries({ queryKey: ['dpp-documents'] });
      queryClient.invalidateQueries({ queryKey: ['dpp-questions', documentId] });
      toast({
        title: "Extraction complete",
        description: `Successfully extracted ${data.questionsCount} questions.`
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Extraction failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
};

export const useDeleteDPPDocument = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ documentId, subjectId }: { documentId: string; subjectId: string }) => {
      // Questions will be cascade deleted
      const { error } = await supabase
        .from('dpp_documents')
        .delete()
        .eq('id', documentId);
      
      if (error) throw error;
      return { documentId, subjectId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dpp-documents', data.subjectId] });
      toast({
        title: "Document deleted",
        description: "DPP document and its questions have been removed."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
};
