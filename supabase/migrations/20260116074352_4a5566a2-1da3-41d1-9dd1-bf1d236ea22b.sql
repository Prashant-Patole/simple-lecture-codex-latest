-- Create forum_group_messages table for chat functionality
CREATE TABLE public.forum_group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES forum_groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
  file_url TEXT,
  reply_to_id UUID REFERENCES forum_group_messages(id) ON DELETE SET NULL,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_forum_group_messages_group_id ON forum_group_messages(group_id);
CREATE INDEX idx_forum_group_messages_sender_id ON forum_group_messages(sender_id);
CREATE INDEX idx_forum_group_messages_created_at ON forum_group_messages(created_at DESC);

-- Create forum_group_message_reads table for read receipts
CREATE TABLE public.forum_group_message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES forum_group_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.forum_group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_group_message_reads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for forum_group_messages

-- Members can view messages in their groups
CREATE POLICY "Group members can view messages"
ON public.forum_group_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM forum_group_members
    WHERE forum_group_members.group_id = forum_group_messages.group_id
    AND forum_group_members.user_id = auth.uid()
  )
);

-- Members can send messages
CREATE POLICY "Group members can send messages"
ON public.forum_group_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM forum_group_members
    WHERE forum_group_members.group_id = forum_group_messages.group_id
    AND forum_group_members.user_id = auth.uid()
  )
);

-- Sender can update their own messages
CREATE POLICY "Sender can update own messages"
ON public.forum_group_messages
FOR UPDATE
USING (auth.uid() = sender_id)
WITH CHECK (auth.uid() = sender_id);

-- Sender can delete their own messages, admins can delete any
CREATE POLICY "Sender or admin can delete messages"
ON public.forum_group_messages
FOR DELETE
USING (
  auth.uid() = sender_id
  OR EXISTS (
    SELECT 1 FROM forum_group_members
    WHERE forum_group_members.group_id = forum_group_messages.group_id
    AND forum_group_members.user_id = auth.uid()
    AND forum_group_members.role = 'admin'
  )
);

-- RLS Policies for forum_group_message_reads

-- Users can view read receipts for messages in their groups
CREATE POLICY "Members can view read receipts"
ON public.forum_group_message_reads
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM forum_group_messages m
    JOIN forum_group_members mem ON mem.group_id = m.group_id
    WHERE m.id = forum_group_message_reads.message_id
    AND mem.user_id = auth.uid()
  )
);

-- Users can mark messages as read
CREATE POLICY "Users can mark messages as read"
ON public.forum_group_message_reads
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Enable realtime for messages
ALTER TABLE forum_group_messages REPLICA IDENTITY FULL;

-- Add table to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'forum_group_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE forum_group_messages;
  END IF;
END $$;

-- Add email column to profiles if not exists (for member search)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email TEXT;
  END IF;
END $$;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_forum_group_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trg_update_forum_group_messages_updated_at ON forum_group_messages;
CREATE TRIGGER trg_update_forum_group_messages_updated_at
BEFORE UPDATE ON forum_group_messages
FOR EACH ROW
EXECUTE FUNCTION update_forum_group_messages_updated_at();