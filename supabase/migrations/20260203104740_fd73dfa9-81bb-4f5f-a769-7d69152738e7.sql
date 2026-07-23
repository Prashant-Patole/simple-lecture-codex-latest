-- Create daily login attendance table
CREATE TABLE public.daily_login_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  first_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_type TEXT DEFAULT 'web',
  login_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, attendance_date)
);

-- Create index for efficient queries
CREATE INDEX idx_daily_login_student_date ON public.daily_login_attendance(student_id, attendance_date DESC);

-- Enable RLS
ALTER TABLE public.daily_login_attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Students can view own attendance"
  ON public.daily_login_attendance FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Students can insert own attendance"
  ON public.daily_login_attendance FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update own attendance"
  ON public.daily_login_attendance FOR UPDATE
  USING (auth.uid() = student_id);

-- Allow admins to view all attendance
CREATE POLICY "Admins can view all attendance"
  ON public.daily_login_attendance FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));