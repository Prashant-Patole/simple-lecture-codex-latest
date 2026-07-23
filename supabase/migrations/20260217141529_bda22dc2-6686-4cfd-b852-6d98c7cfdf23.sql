
-- Create checker_reviews table
CREATE TABLE public.checker_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('lecture', 'question')),
  entity_id text NOT NULL,
  topic_id uuid,
  chapter_id uuid,
  comment text DEFAULT '',
  is_approved boolean DEFAULT false,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

-- Enable RLS
ALTER TABLE public.checker_reviews ENABLE ROW LEVEL SECURITY;

-- RLS: Only checkers/admins can read
CREATE POLICY "Checkers can read reviews"
ON public.checker_reviews FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'checker') OR public.has_role(auth.uid(), 'admin'));

-- RLS: Only checkers/admins can insert
CREATE POLICY "Checkers can insert reviews"
ON public.checker_reviews FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'checker') OR public.has_role(auth.uid(), 'admin'));

-- RLS: Only checkers/admins can update
CREATE POLICY "Checkers can update reviews"
ON public.checker_reviews FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'checker') OR public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_checker_reviews_updated_at
BEFORE UPDATE ON public.checker_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
