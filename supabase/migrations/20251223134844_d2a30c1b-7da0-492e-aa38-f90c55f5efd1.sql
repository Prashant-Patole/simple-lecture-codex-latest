-- Create forum_categories table
CREATE TABLE public.forum_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  subject_id UUID REFERENCES public.popular_subjects(id) ON DELETE SET NULL,
  is_general BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create forum_posts table
CREATE TABLE public.forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.forum_categories(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'published' CHECK (status IN ('pending', 'published', 'flagged', 'deleted')),
  is_answered BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create forum_replies table
CREATE TABLE public.forum_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_ai_generated BOOLEAN DEFAULT false,
  is_accepted_answer BOOLEAN DEFAULT false,
  upvotes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'published' CHECK (status IN ('pending', 'published', 'flagged', 'deleted')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create forum_groups table
CREATE TABLE public.forum_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  subject_id UUID REFERENCES public.popular_subjects(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_private BOOLEAN DEFAULT false,
  max_members INTEGER DEFAULT 100,
  member_count INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create forum_group_members table
CREATE TABLE public.forum_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.forum_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Create forum_flags table for moderation
CREATE TABLE public.forum_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  reply_id UUID REFERENCES public.forum_replies(id) ON DELETE CASCADE,
  flagged_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CHECK (post_id IS NOT NULL OR reply_id IS NOT NULL)
);

-- Create forum_upvotes table
CREATE TABLE public.forum_upvotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reply_id UUID NOT NULL REFERENCES public.forum_replies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(reply_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_upvotes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for forum_categories
CREATE POLICY "Anyone can view active categories" ON public.forum_categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins manage categories" ON public.forum_categories
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for forum_posts
CREATE POLICY "Anyone can view published posts" ON public.forum_posts
  FOR SELECT USING (status = 'published');

CREATE POLICY "Authenticated users can create posts" ON public.forum_posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update own posts" ON public.forum_posts
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Admins manage all posts" ON public.forum_posts
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for forum_replies
CREATE POLICY "Anyone can view published replies" ON public.forum_replies
  FOR SELECT USING (status = 'published');

CREATE POLICY "Authenticated users can create replies" ON public.forum_replies
  FOR INSERT WITH CHECK (auth.uid() = author_id OR author_id IS NULL);

CREATE POLICY "Authors can update own replies" ON public.forum_replies
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Admins manage all replies" ON public.forum_replies
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for forum_groups
CREATE POLICY "Anyone can view public groups" ON public.forum_groups
  FOR SELECT USING (is_private = false OR created_by = auth.uid() OR 
    EXISTS (SELECT 1 FROM forum_group_members WHERE group_id = id AND user_id = auth.uid()));

CREATE POLICY "Authenticated users can create groups" ON public.forum_groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group creators can update their groups" ON public.forum_groups
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Admins manage all groups" ON public.forum_groups
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for forum_group_members
CREATE POLICY "Members can view group members" ON public.forum_group_members
  FOR SELECT USING (EXISTS (SELECT 1 FROM forum_group_members gm WHERE gm.group_id = group_id AND gm.user_id = auth.uid()));

CREATE POLICY "Users can join groups" ON public.forum_group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave groups" ON public.forum_group_members
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Group admins can manage members" ON public.forum_group_members
  FOR ALL USING (EXISTS (SELECT 1 FROM forum_group_members gm WHERE gm.group_id = group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'));

CREATE POLICY "Admins manage all group members" ON public.forum_group_members
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for forum_flags
CREATE POLICY "Users can create flags" ON public.forum_flags
  FOR INSERT WITH CHECK (auth.uid() = flagged_by);

CREATE POLICY "Admins view and manage flags" ON public.forum_flags
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for forum_upvotes
CREATE POLICY "Anyone can view upvotes" ON public.forum_upvotes
  FOR SELECT USING (true);

CREATE POLICY "Users can upvote" ON public.forum_upvotes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own upvotes" ON public.forum_upvotes
  FOR DELETE USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_forum_categories_updated_at
  BEFORE UPDATE ON public.forum_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_forum_posts_updated_at
  BEFORE UPDATE ON public.forum_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_forum_replies_updated_at
  BEFORE UPDATE ON public.forum_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_forum_groups_updated_at
  BEFORE UPDATE ON public.forum_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to increment reply count
CREATE OR REPLACE FUNCTION public.increment_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE forum_posts 
  SET reply_count = reply_count + 1, 
      last_activity_at = NOW(),
      is_answered = true
  WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_reply_created
  AFTER INSERT ON public.forum_replies
  FOR EACH ROW EXECUTE FUNCTION public.increment_reply_count();

-- Function to update upvote count
CREATE OR REPLACE FUNCTION public.update_reply_upvotes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE forum_replies SET upvotes = upvotes + 1 WHERE id = NEW.reply_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE forum_replies SET upvotes = upvotes - 1 WHERE id = OLD.reply_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_upvote_change
  AFTER INSERT OR DELETE ON public.forum_upvotes
  FOR EACH ROW EXECUTE FUNCTION public.update_reply_upvotes();

-- Seed initial categories
INSERT INTO public.forum_categories (name, slug, description, is_general, display_order) VALUES
  ('General Discussions', 'general', 'General questions about the LMS and non-course-related topics', true, 0);

INSERT INTO public.forum_categories (name, slug, description, subject_id, display_order)
SELECT 
  ps.name,
  LOWER(REPLACE(ps.name, ' ', '-')),
  'Discussion forum for ' || ps.name,
  ps.id,
  ROW_NUMBER() OVER (ORDER BY ps.name)
FROM public.popular_subjects ps
WHERE ps.is_active = true;