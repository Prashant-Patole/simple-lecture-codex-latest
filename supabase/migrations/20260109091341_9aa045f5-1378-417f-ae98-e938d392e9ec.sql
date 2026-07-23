-- Drop existing policy
DROP POLICY IF EXISTS "Enrolled students view recordings" ON class_recordings;

-- Create new comprehensive policy supporting both recording types
CREATE POLICY "Enrolled students view recordings" ON class_recordings
FOR SELECT USING (
  -- For class-based recordings (via scheduled_class)
  (scheduled_class_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM scheduled_classes sc
    JOIN enrollments e ON sc.course_id = e.course_id
    WHERE sc.id = class_recordings.scheduled_class_id
      AND e.student_id = auth.uid()
      AND e.is_active = true
  ))
  OR
  -- For topic-based recordings (via course_id directly)
  (course_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM enrollments e
    WHERE e.course_id = class_recordings.course_id
      AND e.student_id = auth.uid()
      AND e.is_active = true
  ))
);