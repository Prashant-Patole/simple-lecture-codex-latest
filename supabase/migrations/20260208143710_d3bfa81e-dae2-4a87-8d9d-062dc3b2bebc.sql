-- Add indexes for log(n) performance on ai_video_watch_logs
CREATE INDEX IF NOT EXISTS idx_ai_video_watch_logs_subject_id
  ON public.ai_video_watch_logs (subject_id)
  WHERE subject_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_video_watch_logs_chapter_id
  ON public.ai_video_watch_logs (chapter_id)
  WHERE chapter_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_video_watch_logs_topic_id
  ON public.ai_video_watch_logs (topic_id)
  WHERE topic_id IS NOT NULL;

-- Update delete_subject_cascade to handle topic/chapter-based deletions
CREATE OR REPLACE FUNCTION public.delete_subject_cascade(p_subject_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete from tables with NO ACTION constraint first (blocks delete)
  DELETE FROM instructor_subjects WHERE subject_id = p_subject_id;
  DELETE FROM instructor_timetables WHERE subject_id = p_subject_id;
  DELETE FROM uploaded_question_documents WHERE subject_id = p_subject_id;
  DELETE FROM parsed_questions_pending WHERE subject_id = p_subject_id;
  
  -- AI video watch logs: delete by topic_id (handles NULL subject_id rows)
  DELETE FROM public.ai_video_watch_logs awl
  USING public.subject_topics st
  JOIN public.subject_chapters sc ON sc.id = st.chapter_id
  WHERE awl.topic_id = st.id
    AND sc.subject_id = p_subject_id;

  -- AI video watch logs: delete by chapter_id (handles NULL subject_id rows)
  DELETE FROM public.ai_video_watch_logs awl
  USING public.subject_chapters sc
  WHERE awl.chapter_id = sc.id
    AND sc.subject_id = p_subject_id;

  -- AI video watch logs: delete any remaining by subject_id
  DELETE FROM ai_video_watch_logs WHERE subject_id = p_subject_id;
  
  DELETE FROM podcast_listen_logs WHERE subject_id = p_subject_id;
  DELETE FROM test_results WHERE subject_id = p_subject_id;
  
  -- Assignments: delete by topic/chapter joins first, then by subject_id
  DELETE FROM public.assignments a
  USING public.subject_topics st
  JOIN public.subject_chapters sc ON sc.id = st.chapter_id
  WHERE a.topic_id = st.id
    AND sc.subject_id = p_subject_id;

  DELETE FROM public.assignments a
  USING public.subject_chapters sc
  WHERE a.chapter_id = sc.id
    AND sc.subject_id = p_subject_id;

  DELETE FROM assignments WHERE subject_id = p_subject_id;
  
  -- Scheduled classes: delete by topic/chapter joins first, then by subject_id
  DELETE FROM public.scheduled_classes s
  USING public.subject_topics st
  JOIN public.subject_chapters sc ON sc.id = st.chapter_id
  WHERE s.topic_id = st.id
    AND sc.subject_id = p_subject_id;

  DELETE FROM public.scheduled_classes s
  USING public.subject_chapters sc
  WHERE s.chapter_id = sc.id
    AND sc.subject_id = p_subject_id;

  DELETE FROM scheduled_classes WHERE subject_id = p_subject_id;
  
  -- Class recordings: delete by topic/chapter joins first, then by subject_id
  DELETE FROM public.class_recordings cr
  USING public.subject_topics st
  JOIN public.subject_chapters sc ON sc.id = st.chapter_id
  WHERE cr.topic_id = st.id
    AND sc.subject_id = p_subject_id;

  DELETE FROM public.class_recordings cr
  USING public.subject_chapters sc
  WHERE cr.chapter_id = sc.id
    AND sc.subject_id = p_subject_id;

  DELETE FROM class_recordings WHERE subject_id = p_subject_id;
  
  -- Update tables with SET NULL constraint
  UPDATE course_timetables SET subject_id = NULL WHERE subject_id = p_subject_id;
  UPDATE timetable_overrides SET subject_id = NULL WHERE subject_id = p_subject_id;
  UPDATE forum_categories SET subject_id = NULL WHERE subject_id = p_subject_id;
  UPDATE forum_groups SET subject_id = NULL WHERE subject_id = p_subject_id;
  UPDATE paper_test_results SET subject_id = NULL WHERE subject_id = p_subject_id;
  
  -- Delete the subject (CASCADE handles remaining tables automatically)
  DELETE FROM popular_subjects WHERE id = p_subject_id;
END;
$$;