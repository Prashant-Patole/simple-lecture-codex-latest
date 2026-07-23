-- =====================================================
-- FIX: Infinite Recursion in Forum Group RLS Policies
-- =====================================================

-- Step 1: Create security definer functions
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.forum_group_members
    WHERE user_id = _user_id AND group_id = _group_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.forum_group_members
    WHERE user_id = _user_id AND group_id = _group_id AND role = 'admin'
  )
$$;

-- Step 2: Drop problematic policies
DROP POLICY IF EXISTS "Group admins can manage members" ON public.forum_group_members;
DROP POLICY IF EXISTS "Members can view group members" ON public.forum_group_members;
DROP POLICY IF EXISTS "Anyone can view public groups" ON public.forum_groups;

-- Step 3: Recreate policies using security definer functions

-- Members can view other members in their groups
CREATE POLICY "Members can view group members"
ON public.forum_group_members
FOR SELECT
TO authenticated
USING (public.is_group_member(auth.uid(), group_id));

-- Group admins can manage (insert/update/delete) members
CREATE POLICY "Group admins can manage members"
ON public.forum_group_members
FOR ALL
TO authenticated
USING (public.is_group_admin(auth.uid(), group_id))
WITH CHECK (public.is_group_admin(auth.uid(), group_id));

-- Anyone can view public groups, creators see their private groups, members see private groups they joined
CREATE POLICY "Anyone can view public groups"
ON public.forum_groups
FOR SELECT
TO public
USING (
  is_private = false 
  OR created_by = auth.uid() 
  OR public.is_group_member(auth.uid(), id)
);