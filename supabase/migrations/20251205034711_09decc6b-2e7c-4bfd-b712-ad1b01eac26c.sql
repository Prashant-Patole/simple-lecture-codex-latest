-- Create table to store featured courses for home page sections
CREATE TABLE public.featured_courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL CHECK (section_type IN ('bestsellers', 'top_courses')),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(course_id, section_type)
);

-- Enable RLS
ALTER TABLE public.featured_courses ENABLE ROW LEVEL SECURITY;

-- Admins can manage featured courses
CREATE POLICY "Admins manage featured courses"
ON public.featured_courses
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can view active featured courses
CREATE POLICY "Anyone can view active featured courses"
ON public.featured_courses
FOR SELECT
USING (is_active = true);

-- Create index for faster queries
CREATE INDEX idx_featured_courses_section ON public.featured_courses(section_type, display_order);
CREATE INDEX idx_featured_courses_course ON public.featured_courses(course_id);