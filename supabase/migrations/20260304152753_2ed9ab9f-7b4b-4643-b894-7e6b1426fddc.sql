
-- Step 1: Update Praveen's payment to success
UPDATE payments 
SET status = 'success', completed_at = now() 
WHERE id = '0e809722-2501-4a6e-b2cc-85e543685da6' AND status = 'pending';

-- Step 2: Create enrollment for Praveen
INSERT INTO enrollments (student_id, course_id, is_active, enrolled_at, expires_at)
VALUES (
  '1143c94c-c258-4577-b85e-660a9cb5ade5',
  '4c10bc8e-acbc-4b76-b7f5-54376c030cb0',
  true,
  now(),
  now() + interval '365 days'
)
ON CONFLICT (student_id, course_id) DO UPDATE SET is_active = true, expires_at = now() + interval '365 days';
