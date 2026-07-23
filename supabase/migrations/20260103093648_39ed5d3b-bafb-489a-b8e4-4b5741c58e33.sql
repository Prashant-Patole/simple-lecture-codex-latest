-- Make student-answers bucket public so uploaded answer images can be viewed
UPDATE storage.buckets 
SET public = true 
WHERE id = 'student-answers';