-- Create batches table
CREATE TABLE IF NOT EXISTS public.batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  max_students INTEGER,
  current_students INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create course_categories table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.course_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, category_id)
);

-- Create course_goals table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.course_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES public.explore_by_goal(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, goal_id)
);

-- Create subtopics table
CREATE TABLE IF NOT EXISTS public.subtopics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sequence_order INTEGER,
  content_markdown TEXT,
  estimated_duration_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add columns to questions table
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS subtopic_id UUID REFERENCES public.subtopics(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS question_format TEXT DEFAULT 'single_choice' CHECK (question_format IN ('single_choice', 'multiple_choice', 'true_false', 'subjective'));

-- Create course_instructors table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.course_instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'instructor',
  is_primary BOOLEAN DEFAULT false,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, teacher_id)
);

-- Create ai_settings table
CREATE TABLE IF NOT EXISTS public.ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create question_uploads table for bulk imports
CREATE TABLE IF NOT EXISTS public.question_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  total_questions INTEGER NOT NULL,
  processed_questions INTEGER DEFAULT 0,
  failed_questions INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_log JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Add program_type to programs table (only if column doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'programs' 
    AND column_name = 'program_type'
  ) THEN
    ALTER TABLE public.programs ADD COLUMN program_type program_type DEFAULT 'recorded_ai';
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_batches_course_active ON public.batches(course_id, is_active);
CREATE INDEX IF NOT EXISTS idx_course_categories_course ON public.course_categories(course_id);
CREATE INDEX IF NOT EXISTS idx_course_categories_category ON public.course_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_course_goals_course ON public.course_goals(course_id);
CREATE INDEX IF NOT EXISTS idx_course_goals_goal ON public.course_goals(goal_id);
CREATE INDEX IF NOT EXISTS idx_subtopics_topic ON public.subtopics(topic_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_questions_topic_verified ON public.questions(topic_id, is_verified);
CREATE INDEX IF NOT EXISTS idx_questions_subtopic_verified ON public.questions(subtopic_id, is_verified);
CREATE INDEX IF NOT EXISTS idx_course_instructors_course ON public.course_instructors(course_id);
CREATE INDEX IF NOT EXISTS idx_course_instructors_teacher ON public.course_instructors(teacher_id);
CREATE INDEX IF NOT EXISTS idx_question_uploads_status ON public.question_uploads(uploaded_by, status);

-- Create updated_at triggers
DROP TRIGGER IF EXISTS update_batches_updated_at ON public.batches;
CREATE TRIGGER update_batches_updated_at
  BEFORE UPDATE ON public.batches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subtopics_updated_at ON public.subtopics;
CREATE TRIGGER update_subtopics_updated_at
  BEFORE UPDATE ON public.subtopics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on all new tables
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtopics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_uploads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for batches
DROP POLICY IF EXISTS "Anyone can view active batches" ON public.batches;
CREATE POLICY "Anyone can view active batches"
  ON public.batches FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins and teachers manage batches" ON public.batches;
CREATE POLICY "Admins and teachers manage batches"
  ON public.batches FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'teacher'));

-- RLS Policies for course_categories
DROP POLICY IF EXISTS "Anyone can view course categories" ON public.course_categories;
CREATE POLICY "Anyone can view course categories"
  ON public.course_categories FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins manage course categories" ON public.course_categories;
CREATE POLICY "Admins manage course categories"
  ON public.course_categories FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for course_goals
DROP POLICY IF EXISTS "Anyone can view course goals" ON public.course_goals;
CREATE POLICY "Anyone can view course goals"
  ON public.course_goals FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins manage course goals" ON public.course_goals;
CREATE POLICY "Admins manage course goals"
  ON public.course_goals FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for subtopics
DROP POLICY IF EXISTS "Anyone can view subtopics" ON public.subtopics;
CREATE POLICY "Anyone can view subtopics"
  ON public.subtopics FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Teachers and admins manage subtopics" ON public.subtopics;
CREATE POLICY "Teachers and admins manage subtopics"
  ON public.subtopics FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'teacher'));

-- RLS Policies for course_instructors
DROP POLICY IF EXISTS "Anyone can view course instructors" ON public.course_instructors;
CREATE POLICY "Anyone can view course instructors"
  ON public.course_instructors FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins manage course instructors" ON public.course_instructors;
CREATE POLICY "Admins manage course instructors"
  ON public.course_instructors FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for ai_settings
DROP POLICY IF EXISTS "Admins view ai settings" ON public.ai_settings;
CREATE POLICY "Admins view ai settings"
  ON public.ai_settings FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage ai settings" ON public.ai_settings;
CREATE POLICY "Admins manage ai settings"
  ON public.ai_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for question_uploads
DROP POLICY IF EXISTS "Users view own uploads" ON public.question_uploads;
CREATE POLICY "Users view own uploads"
  ON public.question_uploads FOR SELECT
  USING (auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "Teachers create question uploads" ON public.question_uploads;
CREATE POLICY "Teachers create question uploads"
  ON public.question_uploads FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'teacher') OR has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins view all uploads" ON public.question_uploads;
CREATE POLICY "Admins view all uploads"
  ON public.question_uploads FOR SELECT
  USING (has_role(auth.uid(), 'admin'));