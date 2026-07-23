-- Add admin role to app_role enum if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('student', 'teacher', 'admin');
  ELSE
    BEGIN
      ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
    EXCEPTION
      WHEN duplicate_object THEN null;
    END;
  END IF;
END $$;

-- Create categories table with 3-level hierarchy
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  description TEXT,
  parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level IN (1, 2, 3)),
  display_order INTEGER DEFAULT 0,
  is_popular BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_level ON public.categories(level);

-- Create explore_by_goal table
CREATE TABLE IF NOT EXISTS public.explore_by_goal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create category_goals junction table
CREATE TABLE IF NOT EXISTS public.category_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.explore_by_goal(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category_id, goal_id)
);

-- Create popular_subjects table
CREATE TABLE IF NOT EXISTS public.popular_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.explore_by_goal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.popular_subjects ENABLE ROW LEVEL SECURITY;

-- RLS Policies for categories
CREATE POLICY "Anyone can view active categories" 
ON public.categories FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage categories" 
ON public.categories FOR ALL 
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for explore_by_goal
CREATE POLICY "Anyone can view active goals" 
ON public.explore_by_goal FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage goals" 
ON public.explore_by_goal FOR ALL 
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for category_goals
CREATE POLICY "Anyone can view category goals" 
ON public.category_goals FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage category goals" 
ON public.category_goals FOR ALL 
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for popular_subjects
CREATE POLICY "Anyone can view active subjects" 
ON public.popular_subjects FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage subjects" 
ON public.popular_subjects FOR ALL 
USING (has_role(auth.uid(), 'admin'));

-- Insert sample data from screenshot
-- Level 1 Categories
INSERT INTO public.categories (name, slug, icon, level, description, display_order) VALUES
('Board Exams', 'board-exams', '📚', 1, 'Complete preparation for board examinations', 1),
('Medical Entrance', 'medical-entrance', '🩺', 1, 'Comprehensive NEET and medical entrance preparation', 2),
('Engineering Entrance', 'engineering-entrance', '⚙️', 1, 'Complete JEE and engineering preparation', 3),
('Integrated Programs', 'integrated-programs', '🎯', 1, 'Dual preparation for board exams and entrance tests', 4);

-- Level 2 Categories (Board Exams)
INSERT INTO public.categories (name, slug, level, parent_id, description, display_order) VALUES
('10th/SSLC', '10th-sslc', 2, 
  (SELECT id FROM public.categories WHERE slug = 'board-exams'), 
  'Class 10 board exam preparation', 1),
('I PUC/11th Science', 'i-puc-11th-science', 2,
  (SELECT id FROM public.categories WHERE slug = 'board-exams'),
  'First year PUC Science stream', 2),
('I PUC/11th Commerce', 'i-puc-11th-commerce', 2,
  (SELECT id FROM public.categories WHERE slug = 'board-exams'),
  'First year PUC Commerce stream', 3),
('II PUC/12th Science', 'ii-puc-12th-science', 2,
  (SELECT id FROM public.categories WHERE slug = 'board-exams'),
  'Second year PUC Science stream', 4),
('II PUC/12th Commerce', 'ii-puc-12th-commerce', 2,
  (SELECT id FROM public.categories WHERE slug = 'board-exams'),
  'Second year PUC Commerce stream', 5);

-- Level 2 Categories (Medical Entrance)
INSERT INTO public.categories (name, slug, level, parent_id, display_order) VALUES
('NEET UG', 'neet-ug', 2, 
  (SELECT id FROM public.categories WHERE slug = 'medical-entrance'), 1),
('NEET PG', 'neet-pg', 2,
  (SELECT id FROM public.categories WHERE slug = 'medical-entrance'), 2),
('AIIMS', 'aiims', 2,
  (SELECT id FROM public.categories WHERE slug = 'medical-entrance'), 3);

-- Level 2 Categories (Engineering Entrance)
INSERT INTO public.categories (name, slug, level, parent_id, display_order) VALUES
('JEE Main', 'jee-main', 2,
  (SELECT id FROM public.categories WHERE slug = 'engineering-entrance'), 1),
('JEE Advanced', 'jee-advanced', 2,
  (SELECT id FROM public.categories WHERE slug = 'engineering-entrance'), 2),
('Karnataka CET', 'karnataka-cet', 2,
  (SELECT id FROM public.categories WHERE slug = 'engineering-entrance'), 3);

-- Level 2 Categories (Integrated Programs)
INSERT INTO public.categories (name, slug, level, parent_id, display_order) VALUES
('PUC + NEET', 'puc-neet', 2,
  (SELECT id FROM public.categories WHERE slug = 'integrated-programs'), 1),
('PUC + JEE', 'puc-jee', 2,
  (SELECT id FROM public.categories WHERE slug = 'integrated-programs'), 2),
('10th + Foundation', '10th-foundation', 2,
  (SELECT id FROM public.categories WHERE slug = 'integrated-programs'), 3);

-- Explore by Goal data
INSERT INTO public.explore_by_goal (name, slug, description, display_order) VALUES
('Crack NEET', 'crack-neet', 'Prepare for NEET medical entrance exam', 1),
('Crack JEE', 'crack-jee', 'Prepare for JEE engineering entrance exam', 2),
('Score 90+ in Boards', 'score-90-boards', 'Excel in board examinations', 3),
('Build Strong Foundation', 'build-strong-foundation', 'Strengthen fundamentals for future success', 4),
('Integrated Program (Board + Entrance)', 'integrated-program', 'Combine board and entrance exam preparation', 5),
('Get University Ready', 'get-university-ready', 'Prepare for university-level education', 6);

-- Popular Subjects data
INSERT INTO public.popular_subjects (name, slug, display_order) VALUES
('Physics (NEET/JEE)', 'physics-neet-jee', 1),
('Chemistry (Organic/Inorganic)', 'chemistry-organic-inorganic', 2),
('Mathematics (Boards/JEE)', 'mathematics-boards-jee', 3),
('Biology (NEET)', 'biology-neet', 4),
('English (Boards)', 'english-boards', 5),
('Kannada (State Boards)', 'kannada-state-boards', 6),
('Hindi (Boards)', 'hindi-boards', 7),
('Social Science', 'social-science', 8);

-- Create trigger for updated_at
CREATE TRIGGER update_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_explore_by_goal_updated_at
BEFORE UPDATE ON public.explore_by_goal
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_popular_subjects_updated_at
BEFORE UPDATE ON public.popular_subjects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();