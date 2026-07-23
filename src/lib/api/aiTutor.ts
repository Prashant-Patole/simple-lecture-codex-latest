import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL } from '@/lib/supabaseUrl';

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function askDoubt(
  question: string,
  topicId: string,
  studentId: string
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("ai-doubt-clear", {
    body: {
      question,
      topic_id: topicId,
      student_id: studentId,
    },
  });

  if (error) throw error;
  return data.answer;
}

export async function generateMCQs(
  topicId: string,
  difficulty: "easy" | "medium" | "hard" = "medium",
  count: number = 5
) {
  const { data, error } = await supabase.functions.invoke("ai-generate-mcqs", {
    body: {
      topic_id: topicId,
      difficulty,
      count,
    },
  });

  if (error) throw error;
  return data;
}

export async function* streamAITutorChat(
  messages: Message[],
  courseContext?: string
): AsyncGenerator<string, void, unknown> {
  const CHAT_URL = `${SUPABASE_URL}/functions/v1/ai-tutor-chat`;

  const response = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages, course_context: courseContext }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Response body is null");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith(":")) continue;
      
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch (e) {
          console.error("Failed to parse SSE data:", e);
        }
      }
    }
  }

  // Flush remaining buffer
  if (buffer.trim()) {
    const lines = buffer.split("\n");
    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith(":") || !line.startsWith("data: ")) continue;
      
      const data = line.slice(6);
      if (data === "[DONE]") continue;

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch (e) {
        console.error("Failed to parse final SSE data:", e);
      }
    }
  }
}
