-- Add BigBlueButton columns to scheduled_classes table
ALTER TABLE scheduled_classes ADD COLUMN IF NOT EXISTS bbb_meeting_id TEXT;
ALTER TABLE scheduled_classes ADD COLUMN IF NOT EXISTS bbb_internal_meeting_id TEXT;
ALTER TABLE scheduled_classes ADD COLUMN IF NOT EXISTS bbb_attendee_pw TEXT;
ALTER TABLE scheduled_classes ADD COLUMN IF NOT EXISTS bbb_moderator_pw TEXT;