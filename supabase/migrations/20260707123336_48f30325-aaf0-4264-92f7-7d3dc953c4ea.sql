DROP INDEX IF EXISTS public.kannada_queue_items_active_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS kannada_queue_items_active_server_job_uidx
  ON public.kannada_queue_items (server_ip, video_job_id)
  WHERE status IN ('queued', 'processing');