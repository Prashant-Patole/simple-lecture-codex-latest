UPDATE ai_settings 
SET setting_value = jsonb_set(
  setting_value::jsonb, 
  '{default_model}', 
  '"gemini-2.5-flash"'
),
updated_at = now()
WHERE setting_key = 'ai_api_config';