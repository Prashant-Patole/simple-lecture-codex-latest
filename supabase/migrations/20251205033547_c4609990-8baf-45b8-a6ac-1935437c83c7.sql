-- Delete all courses that are not bound to any category
DELETE FROM courses 
WHERE id NOT IN (
  SELECT DISTINCT course_id 
  FROM course_categories
);