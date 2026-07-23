INSERT INTO public.enrollments (student_id, course_id, is_active, enrolled_at, expires_at)
SELECT uid, '4c10bc8e-acbc-4b76-b7f5-54376c030cb0'::uuid, true, now(), now() + interval '1 year'
FROM (VALUES
  ('d69e7cfe-e66a-434b-80bd-83e1a0f99264'::uuid),
  ('a42397f6-3409-4f0b-ade7-14cc8c03c058'::uuid),
  ('214fa876-53a2-4206-9ad8-0b1edd0ce922'::uuid),
  ('4bd5f97e-984b-4713-b855-b999de1a3f0b'::uuid),
  ('813b6f65-f838-4249-b8e5-7b62e98b1982'::uuid),
  ('4e459102-0c81-4cb4-8e07-e528e398e2d3'::uuid),
  ('f76b9b33-76ed-43a9-b69f-1f124b5f8e1b'::uuid),
  ('3433b936-2ed2-44ba-b4c8-d2b2cd57a705'::uuid),
  ('00c84167-6fe7-4a9f-98ec-e51c0f2c8b1d'::uuid)
) AS v(uid);