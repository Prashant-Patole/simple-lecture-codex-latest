-- Enable RLS on sales_leads table if not already enabled
ALTER TABLE sales_leads ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert leads (sales leads should be publicly accessible for capturing)
CREATE POLICY "Allow public to create sales leads"
ON sales_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow users to read their own leads (optional, for future use)
CREATE POLICY "Allow users to read sales leads"
ON sales_leads
FOR SELECT
TO anon, authenticated
USING (true);