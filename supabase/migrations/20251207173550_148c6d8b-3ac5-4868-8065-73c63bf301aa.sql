-- Add content_json columns to store parsed PDF content

-- Add to popular_subjects table
ALTER TABLE public.popular_subjects 
ADD COLUMN IF NOT EXISTS content_json JSONB,
ADD COLUMN IF NOT EXISTS json_source_pdf_url TEXT;

-- Add to subject_chapters table
ALTER TABLE public.subject_chapters 
ADD COLUMN IF NOT EXISTS content_json JSONB;

-- Add to subject_topics table
ALTER TABLE public.subject_topics 
ADD COLUMN IF NOT EXISTS content_json JSONB;

-- Add to subtopics table
ALTER TABLE public.subtopics 
ADD COLUMN IF NOT EXISTS content_json JSONB;

-- Add comment for documentation
COMMENT ON COLUMN public.popular_subjects.content_json IS 'Parsed PDF content in JSON format from Datalab.to';
COMMENT ON COLUMN public.popular_subjects.json_source_pdf_url IS 'Source PDF URL that was parsed to generate content_json';
COMMENT ON COLUMN public.subject_chapters.content_json IS 'Parsed PDF content in JSON format from Datalab.to';
COMMENT ON COLUMN public.subject_topics.content_json IS 'Parsed PDF content in JSON format from Datalab.to';
COMMENT ON COLUMN public.subtopics.content_json IS 'Parsed PDF content in JSON format from Datalab.to';