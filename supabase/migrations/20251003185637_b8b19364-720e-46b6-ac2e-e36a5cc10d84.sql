-- Phase 1: Database Foundation for 50M Users Platform

-- ============================================
-- 1. USER ROLES SYSTEM (CRITICAL SECURITY)
-- ============================================

-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'student', 'parent');

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES auth.users(id),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============================================
-- 2. USER PROFILES
-- ============================================

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    phone_number TEXT,
    date_of_birth DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Auto-create profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  
  -- Assign default 'student' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 3. PROGRAMS & COURSES HIERARCHY
-- ============================================

CREATE TABLE public.programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    category TEXT CHECK (category IN ('board_exam', 'entrance_exam', 'skill_development')),
    sub_category TEXT,
    thumbnail_url TEXT,
    price_inr INTEGER DEFAULT 0,
    duration_months INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_programs_category ON public.programs(category, is_active);
CREATE INDEX idx_programs_slug ON public.programs(slug);

CREATE TABLE public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    subjects JSONB, -- ['Physics', 'Chemistry', 'Math']
    thumbnail_url TEXT,
    sequence_order INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(program_id, slug)
);

CREATE INDEX idx_courses_program ON public.courses(program_id, sequence_order);

-- ============================================
-- 4. CONTENT STRUCTURE (Chapters & Topics)
-- ============================================

CREATE TABLE public.chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    subject TEXT NOT NULL,
    chapter_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    pdf_url TEXT,
    unlock_threshold INTEGER DEFAULT 70, -- % score needed to unlock
    sequence_order INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(course_id, subject, chapter_number)
);

CREATE INDEX idx_chapters_course ON public.chapters(course_id, sequence_order);

CREATE TABLE public.topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE NOT NULL,
    topic_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    content_markdown TEXT,
    content_url TEXT,
    ai_slides_url TEXT,
    video_url TEXT,
    estimated_duration_minutes INTEGER,
    sequence_order INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(chapter_id, topic_number)
);

CREATE INDEX idx_topics_chapter ON public.topics(chapter_id, sequence_order);

-- ============================================
-- 5. QUESTIONS & ASSESSMENTS
-- ============================================

CREATE TABLE public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type TEXT CHECK (question_type IN ('mcq', 'subjective', 'true_false')) NOT NULL,
    options JSONB, -- For MCQs: [{"id": "A", "text": "..."}, ...]
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
    marks INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_questions_topic ON public.questions(topic_id, difficulty);

-- ============================================
-- 6. ENROLLMENTS
-- ============================================

CREATE TABLE public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(student_id, course_id)
);

CREATE INDEX idx_enrollments_student ON public.enrollments(student_id, is_active);
CREATE INDEX idx_enrollments_course ON public.enrollments(course_id);

-- ============================================
-- 7. STUDENT PROGRESS (PARTITIONED FOR SCALE)
-- ============================================

CREATE TABLE public.student_progress (
    id UUID DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    score INTEGER CHECK (score >= 0 AND score <= 100),
    is_completed BOOLEAN DEFAULT FALSE,
    is_unlocked BOOLEAN DEFAULT FALSE,
    time_spent_seconds INTEGER DEFAULT 0,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for current and future years
CREATE TABLE student_progress_2025 PARTITION OF public.student_progress
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE student_progress_2026 PARTITION OF public.student_progress
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- Indexes on partitioned table
CREATE INDEX idx_progress_student ON public.student_progress(student_id, created_at DESC);
CREATE INDEX idx_progress_chapter ON public.student_progress(chapter_id, student_id);
CREATE INDEX idx_progress_topic ON public.student_progress(topic_id, student_id);

-- ============================================
-- 8. TEST SUBMISSIONS
-- ============================================

CREATE TABLE public.test_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE,
    answers JSONB NOT NULL, -- [{"question_id": "...", "answer": "..."}]
    score INTEGER,
    total_marks INTEGER,
    time_taken_seconds INTEGER,
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_submissions_student ON public.test_submissions(student_id, submitted_at DESC);
CREATE INDEX idx_submissions_topic ON public.test_submissions(topic_id);

-- ============================================
-- 9. AI DOUBT CLEARING LOGS
-- ============================================

CREATE TABLE public.doubt_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT,
    context_used TEXT, -- RAG context
    model_used TEXT DEFAULT 'gpt-4o',
    response_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_doubts_student ON public.doubt_logs(student_id, created_at DESC);
CREATE INDEX idx_doubts_topic ON public.doubt_logs(topic_id);

-- ============================================
-- 10. MATERIALIZED VIEWS FOR ANALYTICS
-- ============================================

CREATE MATERIALIZED VIEW student_analytics AS
SELECT 
    p.student_id,
    e.course_id,
    COUNT(DISTINCT p.chapter_id) as chapters_completed,
    COUNT(DISTINCT p.topic_id) as topics_completed,
    AVG(p.score) as avg_score,
    SUM(p.time_spent_seconds) as total_time_spent,
    MAX(p.updated_at) as last_activity,
    COUNT(DISTINCT ts.id) as tests_taken
FROM student_progress p
JOIN enrollments e ON p.student_id = e.student_id
LEFT JOIN test_submissions ts ON p.student_id = ts.student_id
WHERE p.is_completed = TRUE
GROUP BY p.student_id, e.course_id;

CREATE UNIQUE INDEX idx_analytics_student_course ON student_analytics(student_id, course_id);

-- Refresh function (call hourly via cron)
CREATE OR REPLACE FUNCTION refresh_student_analytics()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY student_analytics;
$$;

-- ============================================
-- 11. ROW LEVEL SECURITY POLICIES
-- ============================================

-- Profiles: Users can view and update their own profile
CREATE POLICY "Users view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- User Roles: Users can view their own roles
CREATE POLICY "Users view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Admins can manage all roles
CREATE POLICY "Admins manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Programs & Courses: Public read access
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read programs"
ON public.programs FOR SELECT
USING (is_active = TRUE);

CREATE POLICY "Public read courses"
ON public.courses FOR SELECT
USING (is_active = TRUE);

CREATE POLICY "Public read chapters"
ON public.chapters FOR SELECT
USING (TRUE);

CREATE POLICY "Public read topics"
ON public.topics FOR SELECT
USING (TRUE);

CREATE POLICY "Public read questions"
ON public.questions FOR SELECT
USING (TRUE);

-- Enrollments: Students view their own, teachers/admins view all
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own enrollments"
ON public.enrollments FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Teachers view all enrollments"
ON public.enrollments FOR SELECT
USING (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin'));

-- Student Progress: Students view/update their own
ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own progress"
ON public.student_progress FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Students update own progress"
ON public.student_progress FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students modify own progress"
ON public.student_progress FOR UPDATE
USING (auth.uid() = student_id);

-- Teachers can view all progress
CREATE POLICY "Teachers view all progress"
ON public.student_progress FOR SELECT
USING (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin'));

-- Test Submissions: Students view their own
ALTER TABLE public.test_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own submissions"
ON public.test_submissions FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Students create submissions"
ON public.test_submissions FOR INSERT
WITH CHECK (auth.uid() = student_id);

-- Doubt Logs: Students view their own
ALTER TABLE public.doubt_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own doubts"
ON public.doubt_logs FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Students create doubts"
ON public.doubt_logs FOR INSERT
WITH CHECK (auth.uid() = student_id);

-- ============================================
-- 12. UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_programs_updated_at
BEFORE UPDATE ON public.programs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_progress_updated_at
BEFORE UPDATE ON public.student_progress
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();