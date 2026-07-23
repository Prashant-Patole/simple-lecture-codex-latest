-- Create RPC function to get all category descendants in a single query
-- This eliminates the 3-query waterfall pattern

CREATE OR REPLACE FUNCTION get_category_descendants(parent_uuid UUID)
RETURNS TABLE(category_id UUID) AS $$
WITH RECURSIVE category_tree AS (
  -- Base case: the parent itself
  SELECT id FROM categories WHERE id = parent_uuid AND is_active = true
  UNION ALL
  -- Recursive case: all children
  SELECT c.id 
  FROM categories c
  INNER JOIN category_tree ct ON c.parent_id = ct.id
  WHERE c.is_active = true
)
SELECT id as category_id FROM category_tree;
$$ LANGUAGE sql STABLE;