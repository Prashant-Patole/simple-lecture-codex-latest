-- quiz_attempts: cascade delete
ALTER TABLE quiz_attempts DROP CONSTRAINT quiz_attempts_course_id_fkey;
ALTER TABLE quiz_attempts ADD CONSTRAINT quiz_attempts_course_id_fkey
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;

-- assignments: cascade delete
ALTER TABLE assignments DROP CONSTRAINT assignments_course_id_fkey;
ALTER TABLE assignments ADD CONSTRAINT assignments_course_id_fkey
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;

-- class_recordings: set null on delete
ALTER TABLE class_recordings DROP CONSTRAINT class_recordings_course_id_fkey;
ALTER TABLE class_recordings ADD CONSTRAINT class_recordings_course_id_fkey
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL;