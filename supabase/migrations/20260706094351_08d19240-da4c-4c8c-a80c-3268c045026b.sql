-- Prevent duplicate active queue rows for the same job on the same server.
-- Rapid double-clicks on "Run Selected" (or two admins clicking at once)
-- were inserting two 'queued' rows -> worker submitted twice to .78.
CREATE UNIQUE INDEX IF NOT EXISTS kannada_queue_items_active_uidx
  ON public.kannada_queue_items (server_ip, external_job_id)
  WHERE status IN ('queued', 'processing');