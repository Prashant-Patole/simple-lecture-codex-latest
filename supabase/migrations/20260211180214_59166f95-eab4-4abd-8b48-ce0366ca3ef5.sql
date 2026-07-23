CREATE POLICY "Allow public read of hero_video setting"
ON public.ai_settings
FOR SELECT
TO anon
USING (setting_key = 'hero_video');