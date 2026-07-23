-- Insert sample scheduled classes with proper UUIDs
INSERT INTO scheduled_classes (
  id,
  course_id,
  subject,
  teacher_id,
  scheduled_at,
  duration_minutes,
  meeting_link,
  is_cancelled,
  is_live
) VALUES (
  'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
  'd106db94-58ce-41a7-8d73-d0baa3ad9f43',
  'Physics - Kinematics',
  '23a809e0-6193-49ac-850f-7c4f1099de79',
  NOW() - INTERVAL '2 days',
  60,
  'https://meet.example.com/test',
  false,
  false
);

INSERT INTO scheduled_classes (
  id,
  course_id,
  subject,
  teacher_id,
  scheduled_at,
  duration_minutes,
  is_cancelled,
  is_live
) VALUES (
  'b2c3d4e5-f6a7-4901-bcde-f12345678901',
  'd106db94-58ce-41a7-8d73-d0baa3ad9f43',
  'Chemistry - Organic Reactions',
  '3e137495-e53d-4b43-8c56-aa6e56638ca9',
  NOW() - INTERVAL '1 day',
  45,
  false,
  false
);

-- Insert sample class recordings
INSERT INTO class_recordings (
  id,
  scheduled_class_id,
  bbb_recording_id,
  original_filename,
  duration_seconds,
  file_size_bytes,
  processing_status,
  available_qualities,
  default_quality,
  b2_hls_360p_path,
  b2_hls_480p_path,
  b2_hls_720p_path,
  b2_hls_1080p_path,
  processed_at
) VALUES (
  '11111111-2222-4333-8444-555555555555',
  'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
  'bbb-sample-recording-001',
  'physics_kinematics_lecture.mp4',
  2700,
  524288000,
  'ready',
  '["360p", "480p", "720p", "1080p"]'::jsonb,
  '720p',
  'recordings/sample/360p/playlist.m3u8',
  'recordings/sample/480p/playlist.m3u8',
  'recordings/sample/720p/playlist.m3u8',
  'recordings/sample/1080p/playlist.m3u8',
  NOW()
);

INSERT INTO class_recordings (
  id,
  scheduled_class_id,
  bbb_recording_id,
  original_filename,
  duration_seconds,
  processing_status,
  available_qualities,
  default_quality
) VALUES (
  '22222222-3333-4444-8555-666666666666',
  'b2c3d4e5-f6a7-4901-bcde-f12345678901',
  'bbb-sample-recording-002',
  'chemistry_organic_lecture.mp4',
  2400,
  'processing',
  '[]'::jsonb,
  '720p'
);