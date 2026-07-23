-- Remove the default UUID generator from teacher_profiles.id since it should use auth user ID
ALTER TABLE public.teacher_profiles 
ALTER COLUMN id DROP DEFAULT;