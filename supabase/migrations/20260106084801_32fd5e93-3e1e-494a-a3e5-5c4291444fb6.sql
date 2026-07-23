-- Add current_page column to track extraction progress for resume support
ALTER TABLE public.dpp_documents 
ADD COLUMN IF NOT EXISTS current_page INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_pages INTEGER DEFAULT 0;