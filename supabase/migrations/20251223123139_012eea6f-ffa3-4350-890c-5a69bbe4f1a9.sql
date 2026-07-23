-- Create a batch for testing
INSERT INTO public.batches (id, course_id, name, start_date, end_date, is_active, max_students, current_students)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'd106db94-58ce-41a7-8d73-d0baa3ad9f43', 'JEE 2025 Batch A', '2024-06-01', '2025-05-31', true, 100, 25)
ON CONFLICT (id) DO NOTHING;

-- Update student enrollment with batch
UPDATE public.enrollments 
SET batch_id = '11111111-1111-1111-1111-111111111111'
WHERE student_id = '47a9b651-79d6-440b-a18c-9612ecf68b5a';

-- Insert instructor timetables for the batch
INSERT INTO public.instructor_timetables (id, instructor_id, batch_id, subject_id, chapter_id, day_of_week, start_time, end_time, academic_year, valid_from, is_active)
VALUES 
  ('22222222-0001-0001-0001-000000000001', '23a809e0-6193-49ac-850f-7c4f1099de79', '11111111-1111-1111-1111-111111111111', 'a4b75744-6fe8-4c9e-a87a-50cdf09842d9', '639ebe86-1667-49bf-9d06-53c3d5edd8fa', 1, '09:00', '10:30', '2024-25', '2024-06-01', true),
  ('22222222-0002-0002-0002-000000000002', '3e137495-e53d-4b43-8c56-aa6e56638ca9', '11111111-1111-1111-1111-111111111111', 'bc7e6984-8a22-4869-b1d8-732009468abb', '654d53aa-108d-4f91-b86b-569769638d41', 1, '11:00', '12:30', '2024-25', '2024-06-01', true),
  ('22222222-0003-0003-0003-000000000003', '23a809e0-6193-49ac-850f-7c4f1099de79', '11111111-1111-1111-1111-111111111111', '4da2da37-aa0d-4c51-93b4-b8974f7b320d', 'a49378ec-4133-4024-b22f-b662cb9e2341', 2, '09:00', '10:30', '2024-25', '2024-06-01', true),
  ('22222222-0004-0004-0004-000000000004', '3e137495-e53d-4b43-8c56-aa6e56638ca9', '11111111-1111-1111-1111-111111111111', 'a4b75744-6fe8-4c9e-a87a-50cdf09842d9', 'e3e23f42-301e-48ca-b0be-b9817d09d532', 3, '14:00', '15:30', '2024-25', '2024-06-01', true),
  ('22222222-0005-0005-0005-000000000005', '23a809e0-6193-49ac-850f-7c4f1099de79', '11111111-1111-1111-1111-111111111111', 'bc7e6984-8a22-4869-b1d8-732009468abb', 'd1427cd7-7be8-4786-b742-e863e47756eb', 4, '09:00', '10:30', '2024-25', '2024-06-01', true),
  ('22222222-0006-0006-0006-000000000006', '3e137495-e53d-4b43-8c56-aa6e56638ca9', '11111111-1111-1111-1111-111111111111', '4da2da37-aa0d-4c51-93b4-b8974f7b320d', '142a4f6d-eaac-4649-8259-37807caf1a9f', 5, '11:00', '12:30', '2024-25', '2024-06-01', true)
ON CONFLICT (id) DO NOTHING;

-- Insert AI video watch logs for testing (using service role, so we skip RLS)
INSERT INTO public.ai_video_watch_logs (student_id, video_title, subject_id, chapter_id, duration_seconds, watched_seconds, completion_percentage, created_at)
VALUES 
  ('47a9b651-79d6-440b-a18c-9612ecf68b5a', 'Introduction to Differential Calculus', 'a4b75744-6fe8-4c9e-a87a-50cdf09842d9', '639ebe86-1667-49bf-9d06-53c3d5edd8fa', 1200, 1100, 92, now() - interval '2 days'),
  ('47a9b651-79d6-440b-a18c-9612ecf68b5a', 'Chemical Bonding Concepts', '4da2da37-aa0d-4c51-93b4-b8974f7b320d', 'a49378ec-4133-4024-b22f-b662cb9e2341', 900, 750, 83, now() - interval '4 days'),
  ('47a9b651-79d6-440b-a18c-9612ecf68b5a', 'Current Electricity Basics', 'bc7e6984-8a22-4869-b1d8-732009468abb', '654d53aa-108d-4f91-b86b-569769638d41', 1500, 1500, 100, now() - interval '7 days'),
  ('47a9b651-79d6-440b-a18c-9612ecf68b5a', 'Integral Calculus Deep Dive', 'a4b75744-6fe8-4c9e-a87a-50cdf09842d9', 'e3e23f42-301e-48ca-b0be-b9817d09d532', 1800, 900, 50, now() - interval '10 days'),
  ('47a9b651-79d6-440b-a18c-9612ecf68b5a', 'Organic Chemistry Basics', '4da2da37-aa0d-4c51-93b4-b8974f7b320d', '142a4f6d-eaac-4649-8259-37807caf1a9f', 1350, 1200, 89, now() - interval '14 days');

-- Insert podcast listen logs
INSERT INTO public.podcast_listen_logs (student_id, podcast_title, subject_id, chapter_id, duration_seconds, listened_seconds, created_at)
VALUES 
  ('47a9b651-79d6-440b-a18c-9612ecf68b5a', 'JEE Math Tips and Tricks', 'a4b75744-6fe8-4c9e-a87a-50cdf09842d9', '639ebe86-1667-49bf-9d06-53c3d5edd8fa', 1800, 1800, now() - interval '1 day'),
  ('47a9b651-79d6-440b-a18c-9612ecf68b5a', 'Chemistry Made Easy', '4da2da37-aa0d-4c51-93b4-b8974f7b320d', 'a49378ec-4133-4024-b22f-b662cb9e2341', 1500, 1200, now() - interval '3 days'),
  ('47a9b651-79d6-440b-a18c-9612ecf68b5a', 'Physics Problem Solving', 'bc7e6984-8a22-4869-b1d8-732009468abb', '654d53aa-108d-4f91-b86b-569769638d41', 2100, 2100, now() - interval '5 days'),
  ('47a9b651-79d6-440b-a18c-9612ecf68b5a', 'Calculus Concepts Explained', 'a4b75744-6fe8-4c9e-a87a-50cdf09842d9', 'e3e23f42-301e-48ca-b0be-b9817d09d532', 1650, 1500, now() - interval '8 days');

-- Insert daily activity logs for last 30 days
INSERT INTO public.daily_activity_logs (student_id, activity_date, activity_score, live_class_minutes, video_watch_minutes, podcast_listen_minutes, mcq_attempts, doubts_asked)
SELECT 
  '47a9b651-79d6-440b-a18c-9612ecf68b5a',
  (CURRENT_DATE - (n || ' days')::interval)::date,
  40 + floor(random() * 50)::int,
  floor(random() * 120)::int,
  floor(random() * 60)::int,
  floor(random() * 45)::int,
  floor(random() * 20)::int,
  floor(random() * 5)::int
FROM generate_series(0, 29) AS n
ON CONFLICT (student_id, activity_date) DO NOTHING;