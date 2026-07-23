-- Add verification tracking columns to uploaded_question_documents
ALTER TABLE uploaded_question_documents 
ADD COLUMN IF NOT EXISTS verified_by_ai BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS verified_by_human BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS verified_by_user_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS human_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ai_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verification_notes TEXT,
ADD COLUMN IF NOT EXISTS questions_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS verified_questions_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS verification_quality_score NUMERIC(3,2);

-- Add indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_uploaded_docs_verification_status 
ON uploaded_question_documents(verified_by_ai, verified_by_human);

CREATE INDEX IF NOT EXISTS idx_uploaded_docs_verifier 
ON uploaded_question_documents(verified_by_user_id);

-- Create verification notifications table
CREATE TABLE IF NOT EXISTS verification_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES uploaded_question_documents(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id),
  notification_type TEXT NOT NULL CHECK (notification_type IN ('verification_needed', 'verification_completed', 'issues_found')),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_recipient 
ON verification_notifications(recipient_id, is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_document 
ON verification_notifications(document_id);

-- Add duplicate prevention columns to questions table
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS content_hash TEXT,
ADD COLUMN IF NOT EXISTS source_document_id UUID REFERENCES uploaded_question_documents(id);

-- Create index for duplicate detection
CREATE INDEX IF NOT EXISTS idx_questions_content_hash 
ON questions(content_hash) WHERE content_hash IS NOT NULL;

-- Add unique constraint on parsed_questions_pending.question_bank_id
ALTER TABLE parsed_questions_pending
ADD CONSTRAINT unique_question_bank_id UNIQUE (question_bank_id);

-- Enable RLS on verification_notifications
ALTER TABLE verification_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for verification_notifications
CREATE POLICY "Users view own notifications"
ON verification_notifications FOR SELECT
USING (auth.uid() = recipient_id);

CREATE POLICY "Admins manage all notifications"
ON verification_notifications FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert notifications"
ON verification_notifications FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));