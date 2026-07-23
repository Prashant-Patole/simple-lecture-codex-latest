-- Enable read access for public course data
-- These tables contain public information that should be readable by everyone

-- Courses table - allow public read access
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to active courses"
ON public.courses
FOR SELECT
TO public
USING (is_active = true);

-- Categories table - allow public read access
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to active categories"
ON public.categories
FOR SELECT
TO public
USING (is_active = true);

-- Popular subjects table - allow public read access
ALTER TABLE public.popular_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to active subjects"
ON public.popular_subjects
FOR SELECT
TO public
USING (is_active = true);

-- Course categories junction table - allow public read access
ALTER TABLE public.course_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to course categories"
ON public.course_categories
FOR SELECT
TO public
USING (true);

-- Course subjects junction table - allow public read access
ALTER TABLE public.course_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to course subjects"
ON public.course_subjects
FOR SELECT
TO public
USING (true);

-- Course FAQs table - allow public read access
ALTER TABLE public.course_faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to course FAQs"
ON public.course_faqs
FOR SELECT
TO public
USING (true);

-- Explore by goal table - allow public read access
ALTER TABLE public.explore_by_goal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to active goals"
ON public.explore_by_goal
FOR SELECT
TO public
USING (is_active = true);

-- Category goals junction table - allow public read access
ALTER TABLE public.category_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to category goals"
ON public.category_goals
FOR SELECT
TO public
USING (true);

-- Course goals junction table - allow public read access
ALTER TABLE public.course_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to course goals"
ON public.course_goals
FOR SELECT
TO public
USING (true);

-- Subject chapters table - allow public read access
ALTER TABLE public.subject_chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to subject chapters"
ON public.subject_chapters
FOR SELECT
TO public
USING (true);

-- Subject topics table - allow public read access
ALTER TABLE public.subject_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to subject topics"
ON public.subject_topics
FOR SELECT
TO public
USING (true);