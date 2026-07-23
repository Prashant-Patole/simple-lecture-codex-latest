-- Drop the problematic RLS policies that cause infinite recursion
DROP POLICY IF EXISTS "Group admins can manage members" ON forum_group_members;
DROP POLICY IF EXISTS "Members can view group members" ON forum_group_members;

-- Recreate policies with correct references (using forum_group_members instead of gm.group_id = gm.group_id)
CREATE POLICY "Group admins can manage members" ON forum_group_members
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM forum_group_members gm
    WHERE gm.group_id = forum_group_members.group_id 
    AND gm.user_id = auth.uid() 
    AND gm.role = 'admin'
  )
);

CREATE POLICY "Members can view group members" ON forum_group_members
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM forum_group_members gm
    WHERE gm.group_id = forum_group_members.group_id 
    AND gm.user_id = auth.uid()
  )
);