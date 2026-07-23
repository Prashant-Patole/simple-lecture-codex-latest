UPDATE ai_settings 
SET setting_value = jsonb_set(
  setting_value::jsonb, 
  '{cdn_fallback}', 
  '"none"'
)
WHERE setting_key = 'video_streaming';