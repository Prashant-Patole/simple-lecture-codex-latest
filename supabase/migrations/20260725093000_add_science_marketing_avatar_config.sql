INSERT INTO public.ai_settings (setting_key, setting_value, description)
VALUES (
  'marketing_avatar_config',
  '{"subjects":{"science":{"avatar_id":"avatar_877c54be"}}}'::jsonb,
  'Default library avatar IDs for marketing video submissions by subject.'
)
ON CONFLICT (setting_key) DO UPDATE
SET
  setting_value = jsonb_set(
    COALESCE(public.ai_settings.setting_value, '{}'::jsonb),
    '{subjects,science,avatar_id}',
    '"avatar_877c54be"'::jsonb,
    true
  ),
  description = EXCLUDED.description,
  updated_at = now();
