-- ===============================================
-- O(log n) Performance Indexes for Subject Edit Page
-- ===============================================

-- Index for video_generation_jobs by subject_id (log n lookups)
CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_subject_id
  ON public.video_generation_jobs (subject_id)
  WHERE subject_id IS NOT NULL;

-- Composite index for filtering + ordering (covers common query pattern)
CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_subject_status_created
  ON public.video_generation_jobs (subject_id, status, created_at DESC)
  WHERE subject_id IS NOT NULL;