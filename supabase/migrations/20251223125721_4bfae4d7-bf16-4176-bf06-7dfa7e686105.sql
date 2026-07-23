
-- Add enrollments for all users to the existing test course
INSERT INTO enrollments (student_id, course_id, batch_id, is_active, enrolled_at)
SELECT 
  u.id,
  'd106db94-58ce-41a7-8d73-d0baa3ad9f43',
  (SELECT id FROM batches WHERE course_id = 'd106db94-58ce-41a7-8d73-d0baa3ad9f43' LIMIT 1),
  true,
  NOW() - INTERVAL '30 days'
FROM auth.users u
WHERE u.id NOT IN (SELECT student_id FROM enrollments WHERE course_id = 'd106db94-58ce-41a7-8d73-d0baa3ad9f43')
ON CONFLICT DO NOTHING;

-- Add attendance records for all users who have enrollments
INSERT INTO class_attendance (student_id, scheduled_class_id, status, marked_at, duration_seconds)
SELECT 
  e.student_id,
  sc.id,
  CASE 
    WHEN random() < 0.8 THEN 'present'
    ELSE 'absent'
  END,
  sc.scheduled_at,
  CASE 
    WHEN random() < 0.8 THEN (sc.duration_minutes * 60 * (0.7 + random() * 0.3))::int
    ELSE 0
  END
FROM enrollments e
CROSS JOIN scheduled_classes sc
WHERE sc.course_id = e.course_id
  AND e.student_id NOT IN (
    SELECT DISTINCT ca.student_id 
    FROM class_attendance ca 
    WHERE ca.scheduled_class_id = sc.id
  )
ON CONFLICT DO NOTHING;
