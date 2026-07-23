-- Fix Security Linter Warnings

-- Fix 1: Set search_path on update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Fix 2: Enable RLS on partitioned tables
ALTER TABLE student_progress_2025 ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_progress_2026 ENABLE ROW LEVEL SECURITY;

-- Fix 3: Restrict API access to materialized view
REVOKE ALL ON student_analytics FROM anon, authenticated;
GRANT SELECT ON student_analytics TO authenticated;