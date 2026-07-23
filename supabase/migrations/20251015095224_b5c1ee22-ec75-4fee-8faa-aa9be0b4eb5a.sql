-- Fix RLS policies for questions table to allow admins to create/update/delete questions

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Public read questions" ON questions;

-- Create comprehensive policies for questions table
CREATE POLICY "Anyone can view questions"
  ON questions FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert questions"
  ON questions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update questions"
  ON questions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete questions"
  ON questions FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));