-- Add available_languages column to courses table for language top-ups
ALTER TABLE public.courses 
ADD COLUMN available_languages jsonb DEFAULT NULL;