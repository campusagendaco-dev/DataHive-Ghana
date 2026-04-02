CREATE TABLE IF NOT EXISTS public.system_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  auto_api_switch BOOLEAN NOT NULL DEFAULT FALSE,
  preferred_provider TEXT NOT NULL DEFAULT 'primary',
  backup_provider TEXT NOT NULL DEFAULT 'secondary',
  holiday_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  holiday_message TEXT NOT NULL DEFAULT 'Holiday mode is active. Orders will resume soon.',
  disable_ordering BOOLEAN NOT NULL DEFAULT FALSE,
  dark_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view system settings"
  ON public.system_settings
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage system settings"
  ON public.system_settings
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.system_settings (
  id,
  auto_api_switch,
  preferred_provider,
  backup_provider,
  holiday_mode_enabled,
  holiday_message,
  disable_ordering,
  dark_mode_enabled
)
VALUES (
  1,
  FALSE,
  'primary',
  'secondary',
  FALSE,
  'Holiday mode is active. Orders will resume soon.',
  FALSE,
  FALSE
)
ON CONFLICT (id) DO NOTHING;
