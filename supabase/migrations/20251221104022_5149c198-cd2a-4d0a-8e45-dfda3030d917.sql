-- Add live tracking columns to scheduled_classes
ALTER TABLE public.scheduled_classes 
ADD COLUMN IF NOT EXISTS live_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS live_ended_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS recording_url TEXT,
ADD COLUMN IF NOT EXISTS recording_added_at TIMESTAMPTZ;

-- Add attendance tracking columns to class_attendance
ALTER TABLE public.class_attendance 
ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- Enable Realtime for scheduled_classes
ALTER TABLE public.scheduled_classes REPLICA IDENTITY FULL;

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_classes;

-- Create index for faster live class queries
CREATE INDEX IF NOT EXISTS idx_scheduled_classes_is_live ON public.scheduled_classes(is_live) WHERE is_live = true;

-- Create index for attendance queries
CREATE INDEX IF NOT EXISTS idx_class_attendance_student_class ON public.class_attendance(student_id, scheduled_class_id);

-- RLS policy for instructors to update their own classes
CREATE POLICY "Instructors toggle live status" ON public.scheduled_classes
FOR UPDATE USING (
  auth.uid() = teacher_id OR has_role(auth.uid(), 'admin'::app_role)
);

-- Students can insert their own attendance
CREATE POLICY "Students insert own attendance" ON public.class_attendance
FOR INSERT WITH CHECK (auth.uid() = student_id);

-- Students can update their own attendance (for left_at)
CREATE POLICY "Students update own attendance" ON public.class_attendance
FOR UPDATE USING (auth.uid() = student_id);