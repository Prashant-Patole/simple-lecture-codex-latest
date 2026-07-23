-- Add new columns to explore_by_goal for flexible link handling
ALTER TABLE explore_by_goal 
ADD COLUMN IF NOT EXISTS link_type TEXT DEFAULT 'courses' CHECK (link_type IN ('courses', 'internal', 'external')),
ADD COLUMN IF NOT EXISTS link_url TEXT,
ADD COLUMN IF NOT EXISTS open_in_new_tab BOOLEAN DEFAULT false;

COMMENT ON COLUMN explore_by_goal.link_type IS 'Type of navigation: courses (show mapped courses), internal (internal URL), external (external URL)';
COMMENT ON COLUMN explore_by_goal.link_url IS 'URL for internal or external links';
COMMENT ON COLUMN explore_by_goal.open_in_new_tab IS 'Whether to open external links in new tab';