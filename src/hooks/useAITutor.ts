import { useState } from "react";
import { askDoubt, generateMCQs, streamAITutorChat, Message } from "@/lib/api/aiTutor";
import { useToast } from "@/hooks/use-toast";

export const useAITutor = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const askQuestion = async (question: string, topicId: string, studentId: string) => {
    setIsLoading(true);
    try {
      const answer = await askDoubt(question, topicId, studentId);
      return answer;
    } catch (error: any) {
      console.error("Error asking question:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to get answer. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const generateQuestions = async (
    topicId: string,
    difficulty: "easy" | "medium" | "hard" = "medium",
    count: number = 5
  ) => {
    setIsLoading(true);
    try {
      const result = await generateMCQs(topicId, difficulty, count);
      toast({
        title: "Success",
        description: result.message || "Questions generated successfully",
      });
      return result.questions;
    } catch (error: any) {
      console.error("Error generating MCQs:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate questions. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const chatWithAI = async (
    messages: Message[],
    onChunk: (chunk: string) => void,
    courseContext?: string
  ) => {
    setIsLoading(true);
    try {
      for await (const chunk of streamAITutorChat(messages, courseContext)) {
        onChunk(chunk);
      }
    } catch (error: any) {
      console.error("Error in AI chat:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to connect to AI tutor. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    askQuestion,
    generateQuestions,
    chatWithAI,
  };
};
