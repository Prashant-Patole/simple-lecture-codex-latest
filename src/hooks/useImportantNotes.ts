import { useQuery } from "@tanstack/react-query";
import { SUPABASE_DIRECT_URL } from "@/lib/supabaseUrl";

const NOTES_API_BASE =
  import.meta.env.VITE_NOTES_API_BASE || "http://116.202.230.124:8000";
const PROXY_URL = `${SUPABASE_DIRECT_URL}/functions/v1/ai-teaching-proxy`;

export interface ImportantNoteSection {
  heading?: string;
  key_points?: string[];
  explanation?: string;
  image_descriptions?: string[];
}

export interface ImportantNoteImage {
  url?: string;
  local_url?: string;
  local_path?: string;
}

export interface ImportantNoteQuestion {
  id?: string;
  question_text?: string;
  question_format?: string;
  question_type?: string;
  options?: Record<string, { text?: string } | string>;
  correct_answer?: string;
  difficulty?: string;
  marks?: number;
}

export interface ImportantNoteAnswer {
  question_id?: string;
  question_text?: string;
  answer?: string;
  format?: string;
  difficulty?: string;
  key_points?: string[];
  memory_tip?: string;
  estimated_study_time?: string;
  answer_images?: ImportantNoteImage[];
  formulas_used?: unknown[];
}

export interface ImportantTopicNotes {
  topic_note_id: string;
  topic_id: string;
  topic_number?: string;
  topic_title?: string;
  document_id?: string;
  document_title?: string;
  notes_status?: string;
  generated_at?: string;
  error_message?: string | null;
  note_sections?: ImportantNoteSection[];
  latex_formulas?: unknown[];
  note_images?: ImportantNoteImage[];
  questions?: ImportantNoteQuestion[];
  question_answers?: ImportantNoteAnswer[];
  answer_images?: ImportantNoteImage[];
}

export interface ImportantChapterNotes {
  chapter_id: string;
  subject_id: string;
  total_topics: number;
  topics: ImportantTopicNotes[];
}

export const useImportantNotes = (chapterId?: string | null) =>
  useQuery({
    queryKey: ["important-notes", chapterId],
    enabled: Boolean(chapterId),
    staleTime: 5 * 60 * 1000,
    queryFn: async ({ signal }): Promise<ImportantChapterNotes> => {
      const path = `/notes/chapter/${encodeURIComponent(chapterId!)}`;
      const url = `${PROXY_URL}?path=${encodeURIComponent(path)}&base=${encodeURIComponent(NOTES_API_BASE)}`;
      const response = await fetch(url, { signal });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          body?.detail || body?.error || body?.message || "Important notes request failed";
        throw new Error(message);
      }

      return {
        ...body,
        topics: Array.isArray(body?.topics) ? body.topics : [],
      };
    },
  });

