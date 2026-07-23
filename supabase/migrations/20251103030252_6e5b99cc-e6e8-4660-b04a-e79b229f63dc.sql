-- Step 1: Drop existing difficulty constraint to allow updates
ALTER TABLE questions 
DROP CONSTRAINT IF EXISTS questions_difficulty_check;

-- Step 2: Update existing difficulty values
UPDATE questions SET difficulty = 'Medium' WHERE difficulty = 'medium';
UPDATE questions SET difficulty = 'Low' WHERE difficulty = 'easy';
UPDATE questions SET difficulty = 'Advanced' WHERE difficulty = 'hard';
UPDATE questions SET difficulty = 'Medium' WHERE difficulty IS NULL OR difficulty = '';

-- Step 3: Add new constraint with 4 levels
ALTER TABLE questions
ADD CONSTRAINT questions_difficulty_check 
CHECK (difficulty IN ('Low', 'Medium', 'Intermediate', 'Advanced'));

ALTER TABLE questions 
ALTER COLUMN difficulty SET DEFAULT 'Medium';

-- Step 4: Create uploaded_question_documents table
CREATE TABLE IF NOT EXISTS uploaded_question_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id),
  subject_id UUID NOT NULL REFERENCES popular_subjects(id),
  chapter_id UUID NOT NULL REFERENCES subject_chapters(id),
  topic_id UUID REFERENCES subject_topics(id),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'pdf', 'word', 'json')),
  file_url TEXT,
  file_size_bytes BIGINT,
  mathpix_pdf_id TEXT,
  mathpix_json_output JSONB,
  mathpix_markdown TEXT,
  mathpix_latex TEXT,
  mathpix_html TEXT,
  extracted_images JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uploaded_docs_category ON uploaded_question_documents(category_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_docs_subject ON uploaded_question_documents(subject_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_docs_chapter ON uploaded_question_documents(chapter_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_docs_uploaded_by ON uploaded_question_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_uploaded_docs_status ON uploaded_question_documents(status);

-- Step 5: Create parsed_questions_pending table
CREATE TABLE IF NOT EXISTS parsed_questions_pending (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES uploaded_question_documents(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id),
  subject_id UUID NOT NULL REFERENCES popular_subjects(id),
  chapter_id UUID NOT NULL REFERENCES subject_chapters(id),
  topic_id UUID REFERENCES subject_topics(id),
  question_text TEXT NOT NULL,
  question_format TEXT DEFAULT 'single_choice' CHECK (
    question_format IN ('single_choice', 'multiple_choice', 'true_false', 'fill_blank', 'short_answer', 'numerical')
  ),
  question_type TEXT NOT NULL CHECK (question_type IN ('objective', 'subjective')),
  difficulty TEXT DEFAULT 'Medium' CHECK (difficulty IN ('Low', 'Medium', 'Intermediate', 'Advanced')),
  marks INTEGER DEFAULT 1,
  options JSONB,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  question_images TEXT[],
  option_images JSONB DEFAULT '{}',
  explanation_images TEXT[],
  contains_formula BOOLEAN DEFAULT FALSE,
  llm_verified BOOLEAN DEFAULT FALSE,
  llm_verification_status TEXT CHECK (llm_verification_status IN ('correct', 'medium', 'wrong', null)),
  llm_confidence_score NUMERIC(3,2),
  llm_verification_comments TEXT,
  llm_issues JSONB,
  llm_verified_at TIMESTAMPTZ,
  llm_suggested_difficulty TEXT CHECK (llm_suggested_difficulty IN ('Low', 'Medium', 'Intermediate', 'Advanced', null)),
  llm_difficulty_reasoning TEXT,
  is_approved BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  approved_ip_address INET,
  instructor_comments TEXT,
  transferred_to_question_bank BOOLEAN DEFAULT FALSE,
  question_bank_id UUID REFERENCES questions(id),
  transferred_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_questions_document ON parsed_questions_pending(document_id);
CREATE INDEX IF NOT EXISTS idx_pending_questions_subject ON parsed_questions_pending(subject_id);
CREATE INDEX IF NOT EXISTS idx_pending_questions_chapter ON parsed_questions_pending(chapter_id);
CREATE INDEX IF NOT EXISTS idx_pending_questions_llm_status ON parsed_questions_pending(llm_verification_status);
CREATE INDEX IF NOT EXISTS idx_pending_questions_approved ON parsed_questions_pending(is_approved);
CREATE INDEX IF NOT EXISTS idx_pending_questions_transferred ON parsed_questions_pending(transferred_to_question_bank);

-- Step 6: Add triggers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_uploaded_question_documents_updated_at') THEN
    CREATE TRIGGER update_uploaded_question_documents_updated_at
      BEFORE UPDATE ON uploaded_question_documents
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_parsed_questions_pending_updated_at') THEN
    CREATE TRIGGER update_parsed_questions_pending_updated_at
      BEFORE UPDATE ON parsed_questions_pending
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END$$;

-- Step 7: RLS Policies
ALTER TABLE uploaded_question_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE parsed_questions_pending ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage all uploaded documents" ON uploaded_question_documents;
CREATE POLICY "Admins manage all uploaded documents"
  ON uploaded_question_documents FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Instructors view documents for assigned subjects" ON uploaded_question_documents;
CREATE POLICY "Instructors view documents for assigned subjects"
  ON uploaded_question_documents FOR SELECT
  USING (
    has_role(auth.uid(), 'teacher'::app_role) AND
    subject_id IN (SELECT subject_id FROM instructor_subjects WHERE instructor_id = auth.uid())
  );

DROP POLICY IF EXISTS "Instructors insert documents for assigned subjects" ON uploaded_question_documents;
CREATE POLICY "Instructors insert documents for assigned subjects"
  ON uploaded_question_documents FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'teacher'::app_role) AND
    subject_id IN (SELECT subject_id FROM instructor_subjects WHERE instructor_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins manage all pending questions" ON parsed_questions_pending;
CREATE POLICY "Admins manage all pending questions"
  ON parsed_questions_pending FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Instructors view pending questions for assigned subjects" ON parsed_questions_pending;
CREATE POLICY "Instructors view pending questions for assigned subjects"
  ON parsed_questions_pending FOR SELECT
  USING (
    has_role(auth.uid(), 'teacher'::app_role) AND
    subject_id IN (SELECT subject_id FROM instructor_subjects WHERE instructor_id = auth.uid())
  );

DROP POLICY IF EXISTS "Instructors update pending questions for assigned subjects" ON parsed_questions_pending;
CREATE POLICY "Instructors update pending questions for assigned subjects"
  ON parsed_questions_pending FOR UPDATE
  USING (
    has_role(auth.uid(), 'teacher'::app_role) AND
    subject_id IN (SELECT subject_id FROM instructor_subjects WHERE instructor_id = auth.uid())
  );

-- Step 8: Storage bucket and policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploaded-question-documents', 'uploaded-question-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admins and teachers upload documents" ON storage.objects;
CREATE POLICY "Admins and teachers upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'uploaded-question-documents' AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))
  );

DROP POLICY IF EXISTS "Admins and teachers view documents" ON storage.objects;
CREATE POLICY "Admins and teachers view documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'uploaded-question-documents' AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))
  );