
-- Insert SSLC1 - Class 11 Complete Course
INSERT INTO courses (name, slug, short_description, detailed_description, category, price_inr, original_price_inr, duration_months, is_active, is_coming_soon, what_you_learn, course_includes)
VALUES (
  'SSLC1 - Class 11 Complete Course',
  'sslc1-class-11-complete-course',
  'Complete Class 11 / I PUC preparation covering all core subjects with AI-powered learning',
  'Comprehensive Class 11 / I PUC course covering Physics, Chemistry, Biology, Mathematics, and Social Science. Aligned with the board exam syllabus, this course includes detailed video lectures, chapter-wise practice tests, and 24/7 AI-powered doubt resolution. Build a rock-solid foundation for competitive exams while acing your board exams.',
  'Board Exams',
  1000, 10000, 12, true, true,
  '["Master fundamentals of Physics including mechanics, thermodynamics, and waves", "Build a strong foundation in Chemistry covering atomic structure, chemical bonding, and organic chemistry basics", "Understand core Biology concepts including cell biology, plant physiology, and human anatomy", "Develop mathematical skills in algebra, trigonometry, and introduction to calculus", "Learn Social Science topics including history, geography, political science, and economics", "Practice with chapter-wise and full-length mock tests aligned to board exam pattern", "Get instant AI-powered doubt resolution for all subjects", "Access downloadable notes and revision materials for offline study"]'::jsonb,
  '["200+ hours of HD video lectures", "5000+ practice questions with solutions", "Chapter-wise and full-length mock tests", "24/7 AI doubt resolution", "Downloadable notes and study materials", "Board exam pattern analysis and tips", "Progress tracking dashboard"]'::jsonb
);

-- Insert SSLC2 - Class 12 Complete Course
INSERT INTO courses (name, slug, short_description, detailed_description, category, price_inr, original_price_inr, duration_months, is_active, is_coming_soon, what_you_learn, course_includes)
VALUES (
  'SSLC2 - Class 12 Complete Course',
  'sslc2-class-12-complete-course',
  'Complete Class 12 / II PUC board exam preparation with comprehensive coverage and AI support',
  'Master Class 12 / II PUC with our comprehensive course covering advanced Physics, Chemistry, Biology, and Mathematics. Includes previous year paper analysis, board exam strategies, and AI-powered tutoring. Perfect for students aiming for top scores in board exams while building a strong foundation for competitive entrance exams.',
  'Board Exams',
  1000, 10000, 12, true, true,
  '["Solve advanced calculus problems including differential equations and integral calculus", "Understand electromagnetic induction, optics, and modern physics concepts", "Master organic chemistry reactions, biomolecules, and polymer chemistry", "Learn advanced Biology including genetics, evolution, ecology, and biotechnology", "Analyze and solve previous year board exam papers with expert strategies", "Develop exam temperament with timed mock tests and performance analysis", "Get instant AI-powered explanations for complex problems", "Access comprehensive revision notes for last-minute preparation"]'::jsonb,
  '["250+ hours of HD video lectures", "6000+ practice questions with detailed solutions", "Previous year paper analysis (last 10 years)", "Chapter-wise and full-length mock tests", "24/7 AI doubt resolution", "Downloadable revision notes", "Exam strategy and time management guides", "Progress tracking dashboard"]'::jsonb
);

-- Insert course-category mappings for SSLC1
INSERT INTO course_categories (course_id, category_id)
SELECT c.id, 'd1807178-486e-483b-bdb9-a2b095eb96e8'::uuid
FROM courses c WHERE c.slug = 'sslc1-class-11-complete-course';

INSERT INTO course_categories (course_id, category_id)
SELECT c.id, 'd533374b-9620-48dd-856b-5c467afc67d6'::uuid
FROM courses c WHERE c.slug = 'sslc1-class-11-complete-course';

-- Insert course-category mappings for SSLC2
INSERT INTO course_categories (course_id, category_id)
SELECT c.id, 'd1807178-486e-483b-bdb9-a2b095eb96e8'::uuid
FROM courses c WHERE c.slug = 'sslc2-class-12-complete-course';

INSERT INTO course_categories (course_id, category_id)
SELECT c.id, 'e1b78392-8e7b-4608-ae46-35ebfde412ca'::uuid
FROM courses c WHERE c.slug = 'sslc2-class-12-complete-course';

-- Insert course-subject mappings for SSLC1 (Science, Maths, Social Science)
INSERT INTO course_subjects (course_id, subject_id, display_order)
SELECT c.id, 'ceaf73fb-528a-4d4a-947c-4a7be304db2b'::uuid, 1
FROM courses c WHERE c.slug = 'sslc1-class-11-complete-course';

INSERT INTO course_subjects (course_id, subject_id, display_order)
SELECT c.id, 'e41572db-085d-4dfc-ba75-478c8222e2c5'::uuid, 2
FROM courses c WHERE c.slug = 'sslc1-class-11-complete-course';

INSERT INTO course_subjects (course_id, subject_id, display_order)
SELECT c.id, 'b4b83f9b-bc1f-433c-9400-234e50ac1b70'::uuid, 3
FROM courses c WHERE c.slug = 'sslc1-class-11-complete-course';

-- Insert course-subject mappings for SSLC2 (Science, Maths, Social Science)
INSERT INTO course_subjects (course_id, subject_id, display_order)
SELECT c.id, 'ceaf73fb-528a-4d4a-947c-4a7be304db2b'::uuid, 1
FROM courses c WHERE c.slug = 'sslc2-class-12-complete-course';

INSERT INTO course_subjects (course_id, subject_id, display_order)
SELECT c.id, 'e41572db-085d-4dfc-ba75-478c8222e2c5'::uuid, 2
FROM courses c WHERE c.slug = 'sslc2-class-12-complete-course';

INSERT INTO course_subjects (course_id, subject_id, display_order)
SELECT c.id, 'b4b83f9b-bc1f-433c-9400-234e50ac1b70'::uuid, 3
FROM courses c WHERE c.slug = 'sslc2-class-12-complete-course';
