-- Phase 1: Add pricing columns to courses table
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS ai_tutoring_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_tutoring_price INTEGER DEFAULT 2000,
ADD COLUMN IF NOT EXISTS live_classes_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS live_classes_price INTEGER DEFAULT 2000;

-- Phase 2.1: Create Departments (these don't require auth users)
INSERT INTO departments (id, name, description, is_active) VALUES
('11111111-1111-1111-1111-111111111111', 'Physics', 'Department of Physics and Applied Sciences', true),
('22222222-2222-2222-2222-222222222222', 'Chemistry', 'Department of Chemistry and Chemical Sciences', true),
('33333333-3333-3333-3333-333333333333', 'Mathematics', 'Department of Mathematics and Computational Sciences', true),
('44444444-4444-4444-4444-444444444444', 'Biology', 'Department of Biology and Life Sciences', true)
ON CONFLICT (id) DO NOTHING;