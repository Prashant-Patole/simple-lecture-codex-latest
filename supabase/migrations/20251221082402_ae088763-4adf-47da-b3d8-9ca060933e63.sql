-- Fix the notices RLS policy that causes infinite recursion
DROP POLICY IF EXISTS "Users view global notices or enrolled course notices" ON notices;

-- Create a simpler policy that doesn't self-reference
CREATE POLICY "Users view active notices" ON notices
  FOR SELECT USING (
    is_active = true AND (
      is_global = true OR 
      auth.uid() IS NOT NULL
    )
  );
