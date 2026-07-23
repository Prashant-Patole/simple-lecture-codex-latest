
ALTER TABLE public.video_generation_jobs
  ADD COLUMN IF NOT EXISTS is_marketing boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_vgj_is_marketing
  ON public.video_generation_jobs (is_marketing)
  WHERE is_marketing = true;

-- Backfill existing marketing rows
UPDATE public.video_generation_jobs
SET is_marketing = true
WHERE target_port = 5006 AND is_marketing = false;

-- Safety trigger: enforce is_marketing when target_port = 5006
CREATE OR REPLACE FUNCTION public.set_video_job_is_marketing()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.target_port = 5006 THEN
    NEW.is_marketing := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_video_job_is_marketing ON public.video_generation_jobs;
CREATE TRIGGER trg_set_video_job_is_marketing
BEFORE INSERT OR UPDATE OF target_port, is_marketing
ON public.video_generation_jobs
FOR EACH ROW
EXECUTE FUNCTION public.set_video_job_is_marketing();
