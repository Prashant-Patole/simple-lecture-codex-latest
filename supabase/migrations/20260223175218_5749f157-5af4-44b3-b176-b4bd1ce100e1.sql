
-- Fix Sandra Maria's payment (pay_SJV2L5GmLgltC8)
UPDATE payments
SET status = 'success',
    gateway_payment_id = 'pay_SJV2L5GmLgltC8',
    completed_at = '2026-02-23T07:10:00Z'
WHERE order_id = 'ORD-1771830578584-d5iq947w5'
  AND status = 'pending';

-- Create enrollment for course 4c10bc8e-acbc-4b76-b7f5-54376c030cb0
INSERT INTO enrollments (student_id, course_id, is_active, expires_at)
VALUES (
  'e24a29db-1ff7-4b7d-99a2-1009f20b1284',
  '4c10bc8e-acbc-4b76-b7f5-54376c030cb0',
  true,
  NOW() + INTERVAL '365 days'
)
ON CONFLICT (student_id, course_id) DO NOTHING;

-- Fix Sandra Maria's profile data
UPDATE profiles
SET full_name = 'Sandra Maria',
    email = 'sandramariafrancis@yahoo.co.in',
    phone_number = '9739016321'
WHERE id = 'e24a29db-1ff7-4b7d-99a2-1009f20b1284';
