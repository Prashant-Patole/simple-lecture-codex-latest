import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ExtractImageAnswerParams {
  imageUrl: string;
  questionContext?: string;
}

interface ExtractImageAnswerResult {
  extracted_text: string;
  confidence: 'high' | 'medium' | 'low';
}

export const useExtractImageAnswer = () => {
  return useMutation({
    mutationFn: async ({ imageUrl, questionContext }: ExtractImageAnswerParams): Promise<ExtractImageAnswerResult> => {
      const { data, error } = await supabase.functions.invoke('extract-answer-from-image', {
        body: {
          image_url: imageUrl,
          question_context: questionContext,
        },
      });

      if (error) {
        console.error('Error extracting answer from image:', error);
        throw new Error(error.message || 'Failed to extract answer from image');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return {
        extracted_text: data.extracted_text || '',
        confidence: data.confidence || 'low',
      };
    },
    onError: (error: Error) => {
      console.error('Extract image answer error:', error);
      // Don't show toast here - let the caller handle it
    },
  });
};

// Batch extraction for multiple images
export const useExtractMultipleImageAnswers = () => {
  const extractMutation = useExtractImageAnswer();

  return useMutation({
    mutationFn: async (
      items: Array<{ questionId: string; imageUrl: string; questionContext?: string }>
    ): Promise<Map<string, ExtractImageAnswerResult>> => {
      const results = new Map<string, ExtractImageAnswerResult>();

      // Process in parallel with a limit
      const batchSize = 3;
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(async (item) => {
            const result = await extractMutation.mutateAsync({
              imageUrl: item.imageUrl,
              questionContext: item.questionContext,
            });
            return { questionId: item.questionId, result };
          })
        );

        for (const res of batchResults) {
          if (res.status === 'fulfilled') {
            results.set(res.value.questionId, res.value.result);
          }
        }
      }

      return results;
    },
    onError: (error: Error) => {
      toast({
        title: "Extraction Error",
        description: "Some image answers could not be processed",
        variant: "destructive",
      });
    },
  });
};
