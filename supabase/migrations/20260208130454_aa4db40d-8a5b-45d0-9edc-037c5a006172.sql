INSERT INTO ai_settings (setting_key, setting_value, description)
VALUES (
  'hero_video',
  '{"enabled": true, "youtube_url": "https://www.youtube.com/watch?v=y-H3EFjFyhY"}',
  'Homepage hero section promotional video configuration'
)
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value;