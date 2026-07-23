
CREATE TABLE public.question_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  bucket_name TEXT NOT NULL DEFAULT 'pdf-images',
  subject_id UUID REFERENCES popular_subjects(id) ON DELETE SET NULL,
  chapter_id UUID REFERENCES subject_chapters(id) ON DELETE SET NULL,
  topic_id UUID REFERENCES subject_topics(id) ON DELETE SET NULL,
  document_id UUID,
  ocr_result_id TEXT,
  datalab_request_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_question_images_filename ON question_images (LOWER(original_filename));
CREATE INDEX idx_question_images_subject ON question_images (subject_id);
CREATE INDEX idx_question_images_chapter ON question_images (chapter_id);

ALTER TABLE question_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read question images" ON question_images FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert question images" ON question_images FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Service role can manage question images" ON question_images FOR ALL USING (true) WITH CHECK (true);
