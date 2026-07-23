ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS free_preview_ai_limit integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_preview_doubts_limit integer NOT NULL DEFAULT 0;