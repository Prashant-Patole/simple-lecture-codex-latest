-- Create counselor_avatars table for pre-stored avatar images
CREATE TABLE public.counselor_avatars (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('male', 'female')),
  language text NOT NULL CHECK (language IN ('en-IN', 'hi-IN')),
  image_url text NOT NULL,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.counselor_avatars ENABLE ROW LEVEL SECURITY;

-- Public read access for active avatars
CREATE POLICY "Anyone can view active avatars" ON public.counselor_avatars
  FOR SELECT USING (is_active = true);

-- Admins can manage avatars
CREATE POLICY "Admins manage avatars" ON public.counselor_avatars
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert 5 female counselors for Hindi (Priya)
INSERT INTO public.counselor_avatars (name, gender, language, image_url, display_order) VALUES
('Priya', 'female', 'hi-IN', 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=400&h=500&fit=crop&crop=face', 1),
('Priya', 'female', 'hi-IN', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=500&fit=crop&crop=face', 2),
('Priya', 'female', 'hi-IN', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=500&fit=crop&crop=face', 3),
('Priya', 'female', 'hi-IN', 'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=400&h=500&fit=crop&crop=face', 4),
('Priya', 'female', 'hi-IN', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=500&fit=crop&crop=face', 5);

-- Insert 5 male counselors for English (Rahul)
INSERT INTO public.counselor_avatars (name, gender, language, image_url, display_order) VALUES
('Rahul', 'male', 'en-IN', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop&crop=face', 1),
('Rahul', 'male', 'en-IN', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=500&fit=crop&crop=face', 2),
('Rahul', 'male', 'en-IN', 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=500&fit=crop&crop=face', 3),
('Rahul', 'male', 'en-IN', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=500&fit=crop&crop=face', 4),
('Rahul', 'male', 'en-IN', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=500&fit=crop&crop=face', 5);