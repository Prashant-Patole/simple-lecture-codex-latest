-- Phase 1: Create Job Tracking Tables

-- Create document_processing_jobs table
CREATE TABLE document_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES uploaded_question_documents(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('mathpix_processing', 'llm_extraction', 'llm_verification')),
  
  -- Job Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'timeout')),
  
  -- Progress Tracking
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  current_step TEXT,
  total_steps INTEGER,
  
  -- External IDs
  mathpix_pdf_id TEXT,
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_completion_at TIMESTAMPTZ,
  
  -- Results
  result_data JSONB,
  questions_extracted INTEGER DEFAULT 0,
  
  -- Error Handling
  error_message TEXT,
  error_details JSONB,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_jobs_document ON document_processing_jobs(document_id);
CREATE INDEX idx_jobs_status ON document_processing_jobs(status);
CREATE INDEX idx_jobs_type ON document_processing_jobs(job_type);
CREATE INDEX idx_jobs_created ON document_processing_jobs(created_at DESC);

-- Enable RLS
ALTER TABLE document_processing_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins view all jobs"
ON document_processing_jobs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage jobs"
ON document_processing_jobs
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create job_logs table
CREATE TABLE job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES document_processing_jobs(id) ON DELETE CASCADE,
  
  log_level TEXT NOT NULL CHECK (log_level IN ('info', 'warning', 'error', 'debug')),
  message TEXT NOT NULL,
  details JSONB,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_job_logs_job ON job_logs(job_id, created_at DESC);
CREATE INDEX idx_job_logs_level ON job_logs(log_level);

-- Enable RLS
ALTER TABLE job_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins view all logs"
ON job_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add current_job_id to uploaded_question_documents
ALTER TABLE uploaded_question_documents
ADD COLUMN current_job_id UUID REFERENCES document_processing_jobs(id);

CREATE INDEX idx_docs_current_job ON uploaded_question_documents(current_job_id);

-- Fix stuck jobs: Mark old processing documents as failed
UPDATE uploaded_question_documents
SET status = 'failed'
WHERE status = 'processing'
AND processing_started_at < NOW() - INTERVAL '10 minutes';

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_job_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_jobs_updated_at
BEFORE UPDATE ON document_processing_jobs
FOR EACH ROW
EXECUTE FUNCTION update_job_updated_at();