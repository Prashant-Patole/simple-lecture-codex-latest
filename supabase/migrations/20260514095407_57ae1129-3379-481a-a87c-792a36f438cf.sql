update public.ai_settings
set setting_value = jsonb_set(setting_value, '{google_api_key}', '"AIzaSyDXIlUCeqDs64zCNxOjjvYFs1n6NGDbnAU"'::jsonb)
where setting_key = 'ai_api_config';