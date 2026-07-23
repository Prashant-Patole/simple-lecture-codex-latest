-- Fix forum category slugs to be URL-safe by replacing / with -
UPDATE forum_categories SET slug = REPLACE(slug, '/', '-') WHERE slug LIKE '%/%';