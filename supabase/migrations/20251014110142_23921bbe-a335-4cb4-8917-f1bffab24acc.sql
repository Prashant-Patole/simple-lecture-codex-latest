-- Create notices table for notice board
CREATE TABLE public.notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  priority TEXT DEFAULT 'normal',
  is_global BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true
);

-- Create notice_reads junction table to track read status per user
CREATE TABLE public.notice_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id UUID REFERENCES public.notices(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(notice_id, user_id)
);

-- Create scheduled_classes table for class schedule
CREATE TABLE public.scheduled_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES auth.users(id),
  subject TEXT NOT NULL,
  room_number TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  meeting_link TEXT,
  notes TEXT,
  is_cancelled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create course_teachers junction table
CREATE TABLE public.course_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject TEXT,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_primary BOOLEAN DEFAULT false,
  UNIQUE(course_id, teacher_id, subject)
);

-- Create teacher_profiles table to store teacher information
CREATE TABLE public.teacher_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone_number TEXT,
  avatar_url TEXT,
  specialization TEXT[],
  bio TEXT,
  experience_years INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create class_attendance table to track attendance
CREATE TABLE public.class_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_class_id UUID REFERENCES public.scheduled_classes(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'absent' CHECK (status IN ('present', 'absent', 'late', 'excused')),
  marked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes TEXT,
  UNIQUE(scheduled_class_id, student_id)
);

-- Enable RLS on all new tables
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notice_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notices
CREATE POLICY "Users view global notices or enrolled course notices"
ON public.notices FOR SELECT
USING (
  is_global = true 
  OR id IN (
    SELECT n.id FROM notices n
    INNER JOIN course_teachers ct ON n.created_by = ct.teacher_id
    INNER JOIN enrollments e ON ct.course_id = e.course_id
    WHERE e.student_id = auth.uid() AND e.is_active = true
  )
);

CREATE POLICY "Teachers create notices"
ON public.notices FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'teacher'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- RLS Policies for notice_reads
CREATE POLICY "Users manage own notice reads"
ON public.notice_reads FOR ALL
USING (auth.uid() = user_id);

-- RLS Policies for scheduled_classes
CREATE POLICY "Enrolled students view their scheduled classes"
ON public.scheduled_classes FOR SELECT
USING (
  course_id IN (
    SELECT course_id FROM enrollments
    WHERE student_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Teachers view and manage their classes"
ON public.scheduled_classes FOR ALL
USING (auth.uid() = teacher_id);

-- RLS Policies for course_teachers
CREATE POLICY "Anyone can view course teachers"
ON public.course_teachers FOR SELECT
USING (true);

CREATE POLICY "Teachers and admins manage course teachers"
ON public.course_teachers FOR ALL
USING (
  has_role(auth.uid(), 'teacher'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- RLS Policies for teacher_profiles
CREATE POLICY "Anyone can view teacher profiles"
ON public.teacher_profiles FOR SELECT
USING (true);

CREATE POLICY "Teachers update own profile"
ON public.teacher_profiles FOR UPDATE
USING (auth.uid() = id);

-- RLS Policies for class_attendance
CREATE POLICY "Students view own attendance"
ON public.class_attendance FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Teachers manage attendance"
ON public.class_attendance FOR ALL
USING (
  has_role(auth.uid(), 'teacher'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Create indexes for performance
CREATE INDEX idx_notices_created_at ON public.notices(created_at DESC);
CREATE INDEX idx_notice_reads_user_id ON public.notice_reads(user_id);
CREATE INDEX idx_scheduled_classes_scheduled_at ON public.scheduled_classes(scheduled_at);
CREATE INDEX idx_scheduled_classes_course_id ON public.scheduled_classes(course_id);
CREATE INDEX idx_course_teachers_course_id ON public.course_teachers(course_id);
CREATE INDEX idx_course_teachers_teacher_id ON public.course_teachers(teacher_id);
CREATE INDEX idx_class_attendance_student_id ON public.class_attendance(student_id);
CREATE INDEX idx_class_attendance_class_id ON public.class_attendance(scheduled_class_id);

-- Create trigger for updating teacher_profiles updated_at
CREATE TRIGGER update_teacher_profiles_updated_at
  BEFORE UPDATE ON public.teacher_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();