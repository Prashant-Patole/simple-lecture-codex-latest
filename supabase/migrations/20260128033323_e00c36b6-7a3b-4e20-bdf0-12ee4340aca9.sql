-- Create language_topup_purchases table to track user language top-up purchases
CREATE TABLE public.language_topup_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL UNIQUE,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  selected_languages JSONB NOT NULL DEFAULT '[]'::jsonb,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, course_id)
);

-- Enable RLS
ALTER TABLE public.language_topup_purchases ENABLE ROW LEVEL SECURITY;

-- Users can view their own purchases
CREATE POLICY "Users can view their own language topup purchases"
  ON public.language_topup_purchases
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own purchases (pending state)
CREATE POLICY "Users can create their own language topup purchases"
  ON public.language_topup_purchases
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_language_topup_purchases_user_course 
  ON public.language_topup_purchases(user_id, course_id);

CREATE INDEX idx_language_topup_purchases_order_id 
  ON public.language_topup_purchases(order_id);