
CREATE TABLE public.auto_pipeline_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID REFERENCES public.popular_subjects(id),
  subject_name TEXT NOT NULL,
  chapter_id UUID REFERENCES public.subject_chapters(id),
  chapter_name TEXT,
  chapter_number INTEGER,
  topic_id UUID REFERENCES public.subject_topics(id),
  topic_name TEXT,
  topic_number INTEGER,
  document_id TEXT,
  external_job_id TEXT,
  server_ip TEXT,
  category TEXT NOT NULL DEFAULT 'bad' CHECK (category IN ('good', 'bad')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('completed', 'failed', 'partial', 'no_document', 'pending')),
  submitted_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  sanity_summary JSONB,
  error_message TEXT,
  problem_description TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  retry_details JSONB,
  failed_phases TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.auto_pipeline_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all reports" ON public.auto_pipeline_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert reports" ON public.auto_pipeline_reports
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update reports" ON public.auto_pipeline_reports
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete reports" ON public.auto_pipeline_reports
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE INDEX idx_auto_pipeline_reports_category ON public.auto_pipeline_reports(category);
CREATE INDEX idx_auto_pipeline_reports_subject ON public.auto_pipeline_reports(subject_id);
CREATE INDEX idx_auto_pipeline_reports_created ON public.auto_pipeline_reports(created_at DESC);
