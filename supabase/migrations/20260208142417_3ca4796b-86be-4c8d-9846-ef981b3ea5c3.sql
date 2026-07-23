-- Create atomic cascade delete function for popular_subjects
-- Handles all 25 child tables in a single transaction
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
  DELETE FROM ai_video_watch_logs WHERE subject_id = p_subject_id;
  DELETE FROM podcast_listen_logs WHERE subject_id = p_subject_id;
  DELETE FROM test_results WHERE subject_id = p_subject_id;
  DELETE FROM assignments WHERE subject_id = p_subject_id;
  DELETE FROM scheduled_classes WHERE subject_id = p_subject_id;
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