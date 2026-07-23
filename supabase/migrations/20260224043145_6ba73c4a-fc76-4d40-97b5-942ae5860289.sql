
-- Update the trigger to save email and phone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone_number)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'phone', ''), '\D', '', 'g'), '')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');

  RETURN NEW;
END;
$$;

-- Backfill existing profiles with missing email/phone
UPDATE profiles p
SET
  email = COALESCE(p.email, u.email),
  phone_number = COALESCE(p.phone_number,
    NULLIF(regexp_replace(COALESCE(u.raw_user_meta_data->>'phone', ''), '\D', '', 'g'), ''))
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR p.phone_number IS NULL);
