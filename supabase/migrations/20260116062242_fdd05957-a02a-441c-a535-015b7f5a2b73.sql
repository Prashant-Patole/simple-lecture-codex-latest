-- Function to sync member_count with actual members
CREATE OR REPLACE FUNCTION public.sync_forum_group_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE forum_groups
    SET member_count = (
      SELECT COUNT(*) FROM forum_group_members WHERE group_id = NEW.group_id
    )
    WHERE id = NEW.group_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE forum_groups
    SET member_count = (
      SELECT COUNT(*) FROM forum_group_members WHERE group_id = OLD.group_id
    )
    WHERE id = OLD.group_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger on forum_group_members table
DROP TRIGGER IF EXISTS trg_sync_forum_group_member_count ON forum_group_members;

CREATE TRIGGER trg_sync_forum_group_member_count
AFTER INSERT OR DELETE ON forum_group_members
FOR EACH ROW
EXECUTE FUNCTION sync_forum_group_member_count();

-- Fix existing incorrect counts
UPDATE forum_groups g
SET member_count = (
  SELECT COUNT(*) FROM forum_group_members m WHERE m.group_id = g.id
);