
-- Course-Category mappings
INSERT INTO course_categories (course_id, category_id) VALUES
  ('2c53c160-e2bf-401e-9c1d-fea84c228bcd', 'e66b13f5-5cb1-43c3-81ce-acfeb7af16d7'),
  ('faaaadaa-5d6a-4a36-9c1d-ddb50d78d779', 'ab047b50-c682-4bae-907e-cf8b0b719a9b'),
  ('88c496bf-9212-4b07-ba8c-9d9d6c3e68e6', '7550f43b-0cc0-4c94-92db-d9b92d4b5620'),
  ('e58e5baa-fd99-4f45-b6b8-d760bdeac6ce', '487ee33f-c8b6-4444-abd8-943afecb63bc'),
  ('9493b6ba-8ef8-4ff0-bad5-de02686f4dc5', 'afa01e25-58fe-4dd6-985f-4ae347fc5e04'),
  ('693dbee6-23a7-4eda-b1cc-69a338c4fe39', '3f9bff86-dfc4-4f89-be23-563d270f7efa'),
  ('48cbb9d3-f199-47eb-9bcd-a20564dc52a1', '61840968-cc7f-4d74-93e1-05f475dc9bc6'),
  ('612ff87d-1566-4b07-a7bf-be7e0ca983b4', '44f64ef3-6608-49e6-98d8-6561af04386e')
ON CONFLICT DO NOTHING;

-- Course-Subject mappings
INSERT INTO course_subjects (course_id, subject_id, display_order) VALUES
  -- Engineering: Physics, Chemistry, Maths, Engineering Drawing
  ('2c53c160-e2bf-401e-9c1d-fea84c228bcd', 'fd75b3d4-8696-4839-8f94-2ec982d92c83', 1),
  ('2c53c160-e2bf-401e-9c1d-fea84c228bcd', 'd3a8c9b9-8684-40f2-9974-8d0594b6d6e3', 2),
  ('2c53c160-e2bf-401e-9c1d-fea84c228bcd', 'fcb851a5-2d60-42f7-84b9-f69ec96b2146', 3),
  ('2c53c160-e2bf-401e-9c1d-fea84c228bcd', '1de57715-f111-4d75-8d95-80af6d562fcf', 4),
  -- Medical: Physics, Chemistry, Biology
  ('faaaadaa-5d6a-4a36-9c1d-ddb50d78d779', 'fd75b3d4-8696-4839-8f94-2ec982d92c83', 1),
  ('faaaadaa-5d6a-4a36-9c1d-ddb50d78d779', 'd3a8c9b9-8684-40f2-9974-8d0594b6d6e3', 2),
  ('faaaadaa-5d6a-4a36-9c1d-ddb50d78d779', 'd869026e-90d3-4152-8312-85e8e8f81f0e', 3),
  -- Architecture: Design & Drawing, Maths, Physics, Aesthetic Sensitivity
  ('88c496bf-9212-4b07-ba8c-9d9d6c3e68e6', 'aa0767d3-bc55-436d-b36b-3b5557b43724', 1),
  ('88c496bf-9212-4b07-ba8c-9d9d6c3e68e6', 'fcb851a5-2d60-42f7-84b9-f69ec96b2146', 2),
  ('88c496bf-9212-4b07-ba8c-9d9d6c3e68e6', 'fd75b3d4-8696-4839-8f94-2ec982d92c83', 3),
  ('88c496bf-9212-4b07-ba8c-9d9d6c3e68e6', '47b9db80-d99e-44bc-8d56-b9ea4c5b39e5', 4),
  -- Research: Research Methodology, Statistics, Academic Writing, Data Analysis
  ('e58e5baa-fd99-4f45-b6b8-d760bdeac6ce', '022c39b1-56e1-4cfd-80f7-62b03cee1c20', 1),
  ('e58e5baa-fd99-4f45-b6b8-d760bdeac6ce', '6d0ce127-bb0a-4ea1-bd8e-6af304b64e09', 2),
  ('e58e5baa-fd99-4f45-b6b8-d760bdeac6ce', '943d8c53-8645-418d-b2cd-1b1ae8cdb742', 3),
  ('e58e5baa-fd99-4f45-b6b8-d760bdeac6ce', '71459bc1-ec4a-4e30-9945-5d58a755e00a', 4),
  -- Data Science: Python, Stats & Prob, ML, Data Viz, SQL
  ('9493b6ba-8ef8-4ff0-bad5-de02686f4dc5', 'dda172c3-6db1-4935-8217-d836c17f09af', 1),
  ('9493b6ba-8ef8-4ff0-bad5-de02686f4dc5', '5051d3eb-2fd4-475e-acf7-8f323a2e18ac', 2),
  ('9493b6ba-8ef8-4ff0-bad5-de02686f4dc5', '5eb1e26e-a472-4008-a6d9-5621249581d7', 3),
  ('9493b6ba-8ef8-4ff0-bad5-de02686f4dc5', 'c1bebdcb-543a-4cc8-bc3f-02db1044cdf3', 4),
  ('9493b6ba-8ef8-4ff0-bad5-de02686f4dc5', 'c092d8d6-f373-4653-b343-73137102bfcd', 5),
  -- Accounts: Financial Accounting, Cost Accounting, Taxation, Auditing
  ('693dbee6-23a7-4eda-b1cc-69a338c4fe39', '2e053639-9219-4292-bdbc-11c6e8e326c7', 1),
  ('693dbee6-23a7-4eda-b1cc-69a338c4fe39', 'a0822d47-aad8-4f81-bc4a-b85fac619816', 2),
  ('693dbee6-23a7-4eda-b1cc-69a338c4fe39', 'afc83659-553c-4282-bf0a-825fb5bbbdf2', 3),
  ('693dbee6-23a7-4eda-b1cc-69a338c4fe39', 'b8b41d30-d386-4b68-8c5c-324a69f655ff', 4),
  -- Business Studies: Management, Marketing, Finance & Trade, Entrepreneurship
  ('48cbb9d3-f199-47eb-9bcd-a20564dc52a1', '70b73a51-606b-4b4c-bdfa-bceffb7edeee', 1),
  ('48cbb9d3-f199-47eb-9bcd-a20564dc52a1', '946cee9d-b915-4f2b-a39b-8382086bda35', 2),
  ('48cbb9d3-f199-47eb-9bcd-a20564dc52a1', '367c158e-01f7-4e9a-b62f-d1f2db4bf4b9', 3),
  ('48cbb9d3-f199-47eb-9bcd-a20564dc52a1', 'f339abeb-3cfb-40d3-8b31-191fe89be0f2', 4),
  -- Economics: Micro, Macro, Indian Economy, Stats for Economics
  ('612ff87d-1566-4b07-a7bf-be7e0ca983b4', '48082f70-6166-43f6-8a93-cb8026a4218a', 1),
  ('612ff87d-1566-4b07-a7bf-be7e0ca983b4', '4fb03b50-fe24-4ac1-a395-cc0f7ce7822d', 2),
  ('612ff87d-1566-4b07-a7bf-be7e0ca983b4', 'feead0a5-f951-4b57-9be8-74129c8e9d21', 3),
  ('612ff87d-1566-4b07-a7bf-be7e0ca983b4', '8b7a40c8-2590-4b18-bbae-53b50e7053af', 4)
ON CONFLICT DO NOTHING;
