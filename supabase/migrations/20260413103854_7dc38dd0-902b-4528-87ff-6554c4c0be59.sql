-- Insert master badges with subject_id (use ON CONFLICT to skip duplicates on the subject-level index)
INSERT INTO public.student_badges (student_id, badge_type, subject_id, course_id, title, description)
VALUES 
  ('47a9b651-79d6-440b-a18c-9612ecf68b5a', 'master', 'ceaf73fb-528a-4d4a-947c-4a7be304db2b', '4c10bc8e-acbc-4b76-b7f5-54376c030cb0', 'Subject Mastered: Science', 'Earned by completing all chapters in Science')
ON CONFLICT DO NOTHING;

INSERT INTO public.student_badges (student_id, badge_type, subject_id, course_id, title, description)
VALUES 
  ('47a9b651-79d6-440b-a18c-9612ecf68b5a', 'master', 'e41572db-085d-4dfc-ba75-478c8222e2c5', '4c10bc8e-acbc-4b76-b7f5-54376c030cb0', 'Subject Mastered: Maths', 'Earned by completing all chapters in Maths')
ON CONFLICT DO NOTHING;

INSERT INTO public.student_badges (student_id, badge_type, subject_id, course_id, title, description)
VALUES 
  ('47a9b651-79d6-440b-a18c-9612ecf68b5a', 'master', 'b4b83f9b-bc1f-433c-9400-234e50ac1b70', '4c10bc8e-acbc-4b76-b7f5-54376c030cb0', 'Subject Mastered: Social Science', 'Earned by completing all chapters in Social Science')
ON CONFLICT DO NOTHING;

-- Insert course_complete badge
INSERT INTO public.student_badges (student_id, badge_type, course_id, title, description)
VALUES 
  ('47a9b651-79d6-440b-a18c-9612ecf68b5a', 'course_complete', '4c10bc8e-acbc-4b76-b7f5-54376c030cb0', 'Course Completed: 10th Class (Full Subject)', 'Earned by mastering all subjects in this course')
ON CONFLICT DO NOTHING;