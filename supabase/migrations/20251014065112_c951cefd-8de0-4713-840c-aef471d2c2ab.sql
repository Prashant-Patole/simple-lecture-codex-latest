-- Phase 9: Complete Database Schema for SimpleLecture LMS

-- Cart Items Table
CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, program_id)
);

ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own cart" ON cart_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users manage own cart" ON cart_items
  FOR ALL USING (auth.uid() = user_id);

-- Discount Codes Table
CREATE TABLE IF NOT EXISTS discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  discount_percent INTEGER CHECK (discount_percent >= 0 AND discount_percent <= 100),
  discount_amount INTEGER CHECK (discount_amount >= 0),
  max_uses INTEGER,
  times_used INTEGER DEFAULT 0,
  valid_from TIMESTAMP DEFAULT NOW(),
  valid_until TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active discounts" ON discount_codes
  FOR SELECT USING (is_active = TRUE AND valid_until > NOW());

-- Insert sample discount codes
INSERT INTO discount_codes (code, description, discount_percent, max_uses, valid_until)
VALUES 
  ('WELCOME10', 'Welcome discount - 10% off', 10, 1000, NOW() + INTERVAL '1 year'),
  ('NEET2026', 'NEET 2026 Special - 15% off', 15, 500, NOW() + INTERVAL '6 months'),
  ('JEE2026', 'JEE 2026 Special - 15% off', 15, 500, NOW() + INTERVAL '6 months')
ON CONFLICT (code) DO NOTHING;

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  order_id TEXT UNIQUE NOT NULL,
  payment_gateway TEXT DEFAULT 'razorpay',
  gateway_payment_id TEXT,
  gateway_order_id TEXT,
  amount_inr INTEGER NOT NULL,
  discount_amount INTEGER DEFAULT 0,
  final_amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed', 'refunded')),
  payment_method TEXT,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own payments" ON payments
  FOR SELECT USING (auth.uid() = user_id);

-- Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  program_id UUID REFERENCES programs(id),
  price_inr INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own order items" ON order_items
  FOR SELECT USING (
    payment_id IN (
      SELECT id FROM payments WHERE user_id = auth.uid()
    )
  );

-- Assignments Table
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id),
  title TEXT NOT NULL,
  description TEXT,
  questions JSONB NOT NULL,
  total_marks INTEGER DEFAULT 100,
  passing_marks INTEGER DEFAULT 40,
  duration_minutes INTEGER DEFAULT 60,
  due_date TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enrolled students view assignments" ON assignments
  FOR SELECT USING (
    course_id IN (
      SELECT course_id FROM enrollments 
      WHERE student_id = auth.uid() AND is_active = TRUE
    )
  );

-- Assignment Submissions Table
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES assignments(id),
  student_id UUID REFERENCES auth.users(id),
  answers JSONB NOT NULL,
  score INTEGER,
  percentage NUMERIC(5,2),
  feedback TEXT,
  submitted_at TIMESTAMP DEFAULT NOW(),
  graded_at TIMESTAMP,
  time_taken_seconds INTEGER,
  UNIQUE(assignment_id, student_id)
);

ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students submit own assignments" ON assignment_submissions
  FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students view own submissions" ON assignment_submissions
  FOR SELECT USING (auth.uid() = student_id);

-- Daily Practice Tests Table
CREATE TABLE IF NOT EXISTS dpt_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES auth.users(id),
  test_date DATE DEFAULT CURRENT_DATE,
  questions JSONB NOT NULL,
  answers JSONB NOT NULL,
  score INTEGER,
  total_questions INTEGER,
  time_taken_seconds INTEGER,
  submitted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(student_id, test_date)
);

ALTER TABLE dpt_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own DPT submissions" ON dpt_submissions
  FOR ALL USING (auth.uid() = student_id);

-- Quiz Attempts Table
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES auth.users(id),
  course_id UUID REFERENCES courses(id),
  quiz_title TEXT NOT NULL,
  questions JSONB NOT NULL,
  answers JSONB NOT NULL,
  score INTEGER,
  total_questions INTEGER,
  percentage NUMERIC(5,2),
  time_taken_seconds INTEGER,
  completed_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own quiz attempts" ON quiz_attempts
  FOR ALL USING (auth.uid() = student_id);

-- Update programs table
ALTER TABLE programs ADD COLUMN IF NOT EXISTS features JSONB;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS what_you_learn TEXT[];
ALTER TABLE programs ADD COLUMN IF NOT EXISTS instructor_name TEXT DEFAULT 'SimpleLecture Team';
ALTER TABLE programs ADD COLUMN IF NOT EXISTS instructor_bio TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_order_items_payment_id ON order_items(payment_id);
CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student_id ON assignment_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_dpt_submissions_student_id ON dpt_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student_id ON quiz_attempts(student_id);