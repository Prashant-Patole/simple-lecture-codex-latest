
CREATE OR REPLACE FUNCTION public.get_admin_analytics(p_since timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH v AS (
    SELECT
      page_path,
      referrer,
      visitor_ip,
      user_id,
      created_at,
      COALESCE(user_id::text, visitor_ip, 'anon-' || id::text) AS visitor_key,
      CASE
        WHEN referrer IS NULL THEN 'Direct'
        WHEN lower(referrer) = 'testing'
          OR lower(referrer) LIKE '%lovable.app%'
          OR lower(referrer) LIKE '%lovable.dev%'
          OR lower(referrer) LIKE '%lovableproject.com%'
          OR lower(referrer) LIKE '%localhost%' THEN 'Testing'
        WHEN lower(referrer) LIKE '%instagram.com%' THEN 'Instagram'
        WHEN lower(referrer) LIKE '%facebook.com%'
          OR lower(referrer) LIKE '%fb.me%'
          OR lower(referrer) LIKE '%fb.com%' THEN 'Facebook'
        WHEN lower(referrer) LIKE '%youtube.com%'
          OR lower(referrer) LIKE '%youtu.be%' THEN 'YouTube'
        WHEN lower(referrer) LIKE '%google.%' THEN 'Google'
        ELSE 'Other'
      END AS source
    FROM page_visits
    WHERE (p_since IS NULL OR created_at >= p_since)
  )
  SELECT jsonb_build_object(
    'totalVisits', (SELECT COUNT(*) FROM v),
    'uniqueVisitors', (SELECT COUNT(DISTINCT visitor_key) FROM v),
    'signedInVisitors', (SELECT COUNT(DISTINCT user_id) FROM v WHERE user_id IS NOT NULL),
    'totalUsers', (SELECT COUNT(*) FROM profiles),
    'sources', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'source', source,
        'visits', visits,
        'unique', uniq,
        'signed', signed
      ) ORDER BY visits DESC)
      FROM (
        SELECT source,
               COUNT(*) AS visits,
               COUNT(DISTINCT visitor_key) AS uniq,
               COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS signed
        FROM v GROUP BY source
      ) s
    ), '[]'::jsonb),
    'pages', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'path', page_path,
        'visits', visits,
        'unique', uniq,
        'signed', signed,
        'last', last_visit
      ) ORDER BY visits DESC)
      FROM (
        SELECT page_path,
               COUNT(*) AS visits,
               COUNT(DISTINCT visitor_key) AS uniq,
               COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS signed,
               MAX(created_at) AS last_visit
        FROM v GROUP BY page_path
        ORDER BY COUNT(*) DESC
        LIMIT 25
      ) p
    ), '[]'::jsonb),
    'recentSignups', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'full_name', full_name, 'email', email, 'created_at', created_at
      ) ORDER BY created_at DESC)
      FROM (SELECT id, full_name, email, created_at FROM profiles ORDER BY created_at DESC NULLS LAST LIMIT 10) r
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_analytics(timestamptz) TO authenticated;
