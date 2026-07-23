import { supabase } from "@/integrations/supabase/client";
import type {
  AITextAnswerData,
  AITextAnswerResult,
} from "@/types/aiTextAnswer";

interface Params {
  question: string;
  subjectId: string;
  subjectName?: string;
  language?: string;
}

export async function fetchAITextAnswer(
  params: Params,
): Promise<AITextAnswerResult> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "ai-text-answer-proxy",
      { body: { language: "en", ...params } },
    );

    // supabase-js treats non-2xx as an error but still returns the parsed
    // body via error.context. Prefer `data`, else fall back to error body.
    let payload: any = data ?? null;
    if (!payload) {
      const raw = (error as any)?.context?.body;
      payload = typeof raw === "string" ? safeParse(raw) : (raw ?? null);
    }

    if (payload && payload.no_content === true) {
      return {
        ok: false,
        reason: "no_content",
        message: typeof payload.message === "string" ? payload.message : undefined,
      };
    }

    if (error && !payload?.answer) {
      return {
        ok: false,
        reason: "error",
        message: error.message || "Request failed",
      };
    }

    if (!payload?.answer) {
      return { ok: false, reason: "error", message: "Empty answer from server" };
    }

    return { ok: true, data: payload as AITextAnswerData };
  } catch (err: any) {
    return {
      ok: false,
      reason: "error",
      message: err?.message || "Network error",
    };
  }
}

function safeParse(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
