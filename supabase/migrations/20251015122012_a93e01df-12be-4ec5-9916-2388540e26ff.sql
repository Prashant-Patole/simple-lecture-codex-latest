-- Create departments table
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  head_of_department UUID REFERENCES public.teacher_profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on departments
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- RLS policies for departments
CREATE POLICY "Admins manage departments"
ON public.departments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active departments"
ON public.departments
FOR SELECT
USING (is_active = true);

-- Update teacher_profiles table
ALTER TABLE public.teacher_profiles 
ADD COLUMN department_id UUID REFERENCES public.departments(id),
ADD COLUMN employee_id TEXT UNIQUE,
ADD COLUMN date_of_joining DATE,
ADD COLUMN qualification TEXT;

-- Create instructor_subjects table for mapping instructors to categories and subjects
CREATE TABLE public.instructor_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id),
  subject_id UUID REFERENCES public.popular_subjects(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(instructor_id, category_id, subject_id)
);

-- Enable RLS on instructor_subjects
ALTER TABLE public.instructor_subjects ENABLE ROW LEVEL SECURITY;

-- RLS policies for instructor_subjects
CREATE POLICY "Admins manage instructor subjects"
ON public.instructor_subjects
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view instructor subjects"
ON public.instructor_subjects
FOR SELECT
USING (true);

-- Create instructor_timetables table for weekly recurring schedules
CREATE TABLE public.instructor_timetables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.popular_subjects(id),
  chapter_id UUID REFERENCES public.subject_chapters(id),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_minutes INTEGER,
  academic_year TEXT NOT NULL,
  valid_from DATE NOT NULL,
  valid_until DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on instructor_timetables
ALTER TABLE public.instructor_timetables ENABLE ROW LEVEL SECURITY;

-- RLS policies for instructor_timetables
CREATE POLICY "Admins manage timetables"
ON public.instructor_timetables
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors view own timetables"
ON public.instructor_timetables
FOR SELECT
USING (auth.uid() = instructor_id);

CREATE POLICY "Anyone can view active timetables"
ON public.instructor_timetables
FOR SELECT
USING (is_active = true);

-- Update scheduled_classes table
ALTER TABLE public.scheduled_classes
ADD COLUMN chapter_id UUID REFERENCES public.subject_chapters(id),
ADD COLUMN timetable_entry_id UUID REFERENCES public.instructor_timetables(id);

-- Create indexes for performance
CREATE INDEX idx_departments_active ON public.departments(is_active);
CREATE INDEX idx_instructor_subjects_instructor ON public.instructor_subjects(instructor_id);
CREATE INDEX idx_instructor_timetables_instructor ON public.instructor_timetables(instructor_id);
CREATE INDEX idx_instructor_timetables_day ON public.instructor_timetables(day_of_week, start_time);
CREATE INDEX idx_scheduled_classes_chapter ON public.scheduled_classes(chapter_id);

-- Create trigger for updated_at on departments
CREATE TRIGGER update_departments_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on instructor_timetables
CREATE TRIGGER update_instructor_timetables_updated_at
BEFORE UPDATE ON public.instructor_timetables
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();