-- Allow all authenticated users to view all profiles (needed for group chat member display)
CREATE POLICY "Public profiles are viewable by authenticated users"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);