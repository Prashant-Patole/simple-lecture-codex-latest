-- Update uploaded_question_documents table for dual PDF support
ALTER TABLE uploaded_question_documents
ADD COLUMN IF NOT EXISTS questions_pdf_url TEXT,
ADD COLUMN IF NOT EXISTS solutions_pdf_url TEXT,
ADD COLUMN IF NOT EXISTS questions_mmd_content TEXT,
ADD COLUMN IF NOT EXISTS solutions_mmd_content TEXT,
ADD COLUMN IF NOT EXISTS questions_images_folder TEXT,
ADD COLUMN IF NOT EXISTS solutions_images_folder TEXT,
ADD COLUMN IF NOT EXISTS mathpix_questions_pdf_id TEXT,
ADD COLUMN IF NOT EXISTS mathpix_solutions_pdf_id TEXT,
ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'valid', 'invalid')),
ADD COLUMN IF NOT EXISTS validation_notes TEXT;

-- Create document_images table to store extracted image metadata
CREATE TABLE IF NOT EXISTS document_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES uploaded_question_documents(id) ON DELETE CASCADE,
  image_type TEXT NOT NULL CHECK (image_type IN ('question', 'solution')),
  original_filename TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  question_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_document_images_document_id ON document_images(document_id);
CREATE INDEX IF NOT EXISTS idx_document_images_question_number ON document_images(question_number);

-- Enable RLS on document_images
ALTER TABLE document_images ENABLE ROW LEVEL SECURITY;

-- RLS policies for document_images
CREATE POLICY "Admins manage all document images"
ON document_images
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins view all document images"
ON document_images
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add comment for documentation
COMMENT ON TABLE document_images IS 'Stores metadata for images extracted from Mathpix MMD.ZIP files';
COMMENT ON COLUMN uploaded_question_documents.questions_pdf_url IS 'URL to the questions PDF file in Supabase Storage';
COMMENT ON COLUMN uploaded_question_documents.solutions_pdf_url IS 'URL to the solutions PDF file in Supabase Storage';
COMMENT ON COLUMN uploaded_question_documents.questions_mmd_content IS 'Mathpix Markdown content from questions PDF';
COMMENT ON COLUMN uploaded_question_documents.solutions_mmd_content IS 'Mathpix Markdown content from solutions PDF';
COMMENT ON COLUMN uploaded_question_documents.validation_status IS 'Status of MMD validation against chapter/topic hierarchy';