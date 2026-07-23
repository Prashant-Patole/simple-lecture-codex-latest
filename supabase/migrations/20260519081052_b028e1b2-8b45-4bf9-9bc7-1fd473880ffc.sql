INSERT INTO public.enrollments (student_id, course_id, is_active, enrolled_at, expires_at)
VALUES ('072593eb-6fd2-4ae3-815d-a75a2c70e033','4c10bc8e-acbc-4b76-b7f5-54376c030cb0', true, now(), now() + interval '365 days')
ON CONFLICT DO NOTHING;