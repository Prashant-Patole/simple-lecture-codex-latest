-- Fix refresh_student_analytics function search_path
CREATE OR REPLACE FUNCTION refresh_student_analytics()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY student_analytics;
$$;