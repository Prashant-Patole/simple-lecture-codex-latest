-- Add cdn_path column to track CDN storage location for language avatars
ALTER TABLE language_avatar_jobs 
ADD COLUMN cdn_path TEXT;

-- Add comment for documentation
COMMENT ON COLUMN language_avatar_jobs.cdn_path IS 'CDN storage path relative to job folder, e.g., language/hindi/section_0_avatar.mp4';