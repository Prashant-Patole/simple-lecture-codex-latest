import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_DIRECT_URL } from '@/lib/supabaseUrl';

/**
 * Read-through cache for AI Teaching answers.
 * Delegates to the `pregen-answer` edge function which:
 *   1. Checks pregen_question_cache
 *   2. On miss, calls CPU /ai-teaching-assistant
 *   3. Upserts response into cache
 * This lets 1000+ concurrent viewers share a single CPU generation per question.
 */
export async function getOrFetchAnswer(params: {
  questionId: string;
  questionText: string;
  subjectId?: string;
  subjectName?: string;
}): Promise<any> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  const apikey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || '';

  const res = await fetch(`${SUPABASE_DIRECT_URL}/functions/v1/pregen-answer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(params),
  });
  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(payload?.error || `HTTP ${res.status}`);
  return payload?.data ?? payload;
}
