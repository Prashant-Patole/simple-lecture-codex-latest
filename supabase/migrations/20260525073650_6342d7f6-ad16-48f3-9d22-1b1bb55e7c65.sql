
INSERT INTO public.courses
  (name, slug, category, short_description, detailed_description, duration_months, price_inr, original_price_inr, is_active, is_coming_soon, ai_tutoring_enabled, live_classes_enabled, what_you_learn, course_includes)
VALUES
('CBSC Class 10 Complete Course 2026','cbsc-class-10-complete-2026','CBSC',
 'NCERT-aligned complete preparation for CBSE Class 10 board exams across all core subjects.',
 'A comprehensive Class 10 program covering Mathematics, Science, Social Science, English and Hindi. Includes NCERT concept videos, chapter-wise notes, board-pattern practice tests, previous year papers, AI tutoring and live doubt classes to help students score top marks in the CBSE board exam.',
 12, 0, 0, true, false, true, true,
 '["Master all NCERT chapters across Math, Science, Social Science","Solve every previous year CBSE board question","Strong fundamentals for Class 11 and competitive exams","Time management and exam-writing techniques"]'::jsonb,
 '["NCERT-aligned video lectures","Chapter-wise notes and mind maps","Topic-wise and full-length mock tests","Previous year papers with solutions","AI tutor for instant doubts","Live doubt-clearing classes"]'::jsonb),
('CBSC Class 11 Complete Course 2026','cbsc-class-11-complete-2026','CBSC',
 'NCERT-aligned Class 11 foundation course with PCM/PCB focus and competitive exam readiness.',
 'A complete Class 11 program covering Physics, Chemistry, Mathematics, Biology and English aligned with the latest CBSE/NCERT syllabus. Designed to build deep conceptual clarity for school exams while laying a strong foundation for JEE and NEET preparation.',
 12, 0, 0, true, false, true, true,
 '["Complete NCERT Class 11 syllabus mastery","Strong PCM/PCB foundation for JEE/NEET","Conceptual clarity with derivations and problem solving","Regular practice via topic and chapter tests"]'::jsonb,
 '["HD video lectures by expert teachers","Detailed notes and formula sheets","NCERT and exemplar solutions","Chapter tests and full-length mocks","AI tutor for 24x7 doubts","Live interactive classes"]'::jsonb),
('CBSC Class 12 Complete Course 2026','cbsc-class-12-complete-2026','CBSC',
 'Complete CBSE Class 12 board prep with integrated JEE/NEET-level practice.',
 'A focused Class 12 program covering Physics, Chemistry, Mathematics, Biology and English as per the latest CBSE/NCERT syllabus. Combines rigorous board exam preparation with competitive-level problem solving so students excel in boards and crack JEE/NEET in one go.',
 12, 0, 0, true, false, true, true,
 '["Full NCERT Class 12 syllabus coverage","Board + competitive level question practice","Previous 10 years CBSE board solutions","Strategy sessions for exam day"]'::jsonb,
 '["Concept video lectures","Notes, formula booklets, revision sheets","NCERT, exemplar and PYQ solutions","Full-length board pattern mocks","AI tutor + live doubt sessions","Performance analytics and weekly reports"]'::jsonb);

INSERT INTO public.course_categories (course_id, category_id)
SELECT co.id, m.cat_id
FROM public.courses co
JOIN (
  VALUES
    ('cbsc-class-10-complete-2026'::text, '885d2c53-2daa-4d0b-8a99-f4a9a79e4d25'::uuid),
    ('cbsc-class-10-complete-2026',       'c642a3e7-d4d2-41b8-a458-3da47d75f457'),
    ('cbsc-class-11-complete-2026',       '8dd21ce7-d087-49a6-9881-867d87448ec2'),
    ('cbsc-class-11-complete-2026',       'c642a3e7-d4d2-41b8-a458-3da47d75f457'),
    ('cbsc-class-12-complete-2026',       'acb803c3-b1a7-4110-b6d4-42d33a5bc69c'),
    ('cbsc-class-12-complete-2026',       'c642a3e7-d4d2-41b8-a458-3da47d75f457')
) AS m(slug, cat_id) ON m.slug = co.slug
ON CONFLICT DO NOTHING;

INSERT INTO public.course_subjects (course_id, subject_id, display_order)
SELECT co.id, m.subject_id, m.display_order
FROM public.courses co
JOIN (
  VALUES
    ('cbsc-class-10-complete-2026'::text, 'e41572db-085d-4dfc-ba75-478c8222e2c5'::uuid, 1),
    ('cbsc-class-10-complete-2026',       'ceaf73fb-528a-4d4a-947c-4a7be304db2b',       2),
    ('cbsc-class-10-complete-2026',       'b4b83f9b-bc1f-433c-9400-234e50ac1b70',       3),
    ('cbsc-class-11-complete-2026',       'fd75b3d4-8696-4839-8f94-2ec982d92c83',       1),
    ('cbsc-class-11-complete-2026',       'd3a8c9b9-8684-40f2-9974-8d0594b6d6e3',       2),
    ('cbsc-class-11-complete-2026',       'fcb851a5-2d60-42f7-84b9-f69ec96b2146',       3),
    ('cbsc-class-11-complete-2026',       'd869026e-90d3-4152-8312-85e8e8f81f0e',       4),
    ('cbsc-class-12-complete-2026',       'fd75b3d4-8696-4839-8f94-2ec982d92c83',       1),
    ('cbsc-class-12-complete-2026',       'd3a8c9b9-8684-40f2-9974-8d0594b6d6e3',       2),
    ('cbsc-class-12-complete-2026',       'fcb851a5-2d60-42f7-84b9-f69ec96b2146',       3),
    ('cbsc-class-12-complete-2026',       'd869026e-90d3-4152-8312-85e8e8f81f0e',       4)
) AS m(slug, subject_id, display_order) ON m.slug = co.slug
ON CONFLICT DO NOTHING;
