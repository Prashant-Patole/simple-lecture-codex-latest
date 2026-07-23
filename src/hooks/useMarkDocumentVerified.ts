import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useMarkDocumentVerified = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      verificationType,
      notes,
      qualityScore
    }: {
      documentId: string;
      verificationType: 'ai' | 'human';
      notes?: string;
      qualityScore?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const updateData: any = {
        verification_notes: notes,
        updated_at: new Date().toISOString()
      };

      if (qualityScore !== undefined) {
        updateData.verification_quality_score = qualityScore;
      }

      if (verificationType === 'ai') {
        updateData.verified_by_ai = true;
        updateData.ai_verified_at = new Date().toISOString();
      } else {
        updateData.verified_by_human = true;
        updateData.human_verified_at = new Date().toISOString();
        updateData.verified_by_user_id = user.id;
      }

      const { error } = await supabase
        .from('uploaded_question_documents')
        .update(updateData)
        .eq('id', documentId);

      if (error) throw error;

      // Send notification
      await supabase.functions.invoke('send-verification-notification', {
        body: {
          documentId,
          notificationType: 'verification_completed'
        }
      });
    },
    onSuccess: () => {
      toast.success("Document marked as verified");
      queryClient.invalidateQueries({ queryKey: ["uploaded-documents"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to mark document as verified", {
        description: error.message
      });
    }
  });
};
