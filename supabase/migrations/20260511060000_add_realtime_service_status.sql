-- Create service status table
CREATE TABLE IF NOT EXISTS public.service_status (
    network TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'operational' CHECK (status IN ('operational', 'maintenance', 'down')),
    admin_note TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Seed standard ISP providers
INSERT INTO public.service_status (network, display_name, status)
VALUES 
  ('MTN', 'MTN Ghana', 'operational'),
  ('TELECEL', 'Telecel (Vodafone)', 'operational'),
  ('AT_PREMIUM', 'AirtelTigo (AT)', 'operational')
ON CONFLICT (network) DO UPDATE SET display_name = EXCLUDED.display_name;

-- Access controls
ALTER TABLE public.service_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view service status" ON public.service_status;
CREATE POLICY "Anyone can view service status" ON public.service_status FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update service status" ON public.service_status;
CREATE POLICY "Admins can update service status" ON public.service_status FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Trigger auto-updated_at
DROP TRIGGER IF EXISTS set_service_status_timestamp ON public.service_status;
CREATE TRIGGER set_service_status_timestamp
    BEFORE UPDATE ON public.service_status
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_updated_at_column();

-- Trigger to emit active global notifications whenever a service degrades
CREATE OR REPLACE FUNCTION public.handle_service_status_broadcast()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Insert an official notification (which automatically shows up in the BIG popup modal for all users)
  -- only when going from operational to a degraded state
  IF NEW.status <> OLD.status AND NEW.status <> 'operational' THEN
     INSERT INTO public.notifications (title, message, target_type, created_by)
     VALUES (
       '⚠️ Service Warning: ' || NEW.display_name,
       'Alert: The ' || NEW.display_name || ' network is currently ' || UPPER(NEW.status) || '. Please pause orders for this network until operations stabilize.',
       'all',
       auth.uid()
     );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_service_degraded ON public.service_status;
CREATE TRIGGER trg_on_service_degraded
  AFTER UPDATE OF status ON public.service_status
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_service_status_broadcast();

-- Register to Realtime for instant dashboard reactivity
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'service_status') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_status;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Publication step bypassed';
END $$;
