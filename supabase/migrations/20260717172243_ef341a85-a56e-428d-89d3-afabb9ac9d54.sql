
CREATE TABLE public.gap_patcher_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_job_id text NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'manual',
  coverage_percent int,
  status text NOT NULL DEFAULT 'queued',
  patch_run_id text,
  last_log_tail text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gap_patcher_queue TO authenticated;
GRANT ALL ON public.gap_patcher_queue TO service_role;

ALTER TABLE public.gap_patcher_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage gap_patcher_queue"
ON public.gap_patcher_queue FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX gap_patcher_queue_status_idx ON public.gap_patcher_queue(status, created_at);

CREATE TRIGGER trg_gap_patcher_queue_updated
BEFORE UPDATE ON public.gap_patcher_queue
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.gap_patcher_settings (
  id int PRIMARY KEY DEFAULT 1,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gap_patcher_settings_singleton CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE ON public.gap_patcher_settings TO authenticated;
GRANT ALL ON public.gap_patcher_settings TO service_role;

ALTER TABLE public.gap_patcher_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage gap_patcher_settings"
ON public.gap_patcher_settings FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.gap_patcher_settings (id, enabled) VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER trg_gap_patcher_settings_updated
BEFORE UPDATE ON public.gap_patcher_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.gap_patcher_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gap_patcher_settings;
