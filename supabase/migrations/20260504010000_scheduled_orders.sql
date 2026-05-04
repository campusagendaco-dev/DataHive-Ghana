-- Align existing scheduled_orders table with the new schema used in the app
DO $$ 
BEGIN
  -- Rename columns if they exist under old names
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scheduled_orders' AND column_name='agent_id') THEN
    ALTER TABLE public.scheduled_orders RENAME COLUMN agent_id TO user_id;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scheduled_orders' AND column_name='next_run') THEN
    ALTER TABLE public.scheduled_orders RENAME COLUMN next_run TO next_run_at;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scheduled_orders' AND column_name='is_active') THEN
    ALTER TABLE public.scheduled_orders RENAME COLUMN is_active TO active;
  END IF;

  -- Add missing columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scheduled_orders' AND column_name='failure_count') THEN
    ALTER TABLE public.scheduled_orders ADD COLUMN failure_count INT NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Update RLS Policies
ALTER TABLE public.scheduled_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own schedules" ON public.scheduled_orders;
DROP POLICY IF EXISTS "Users can manage their own schedules" ON public.scheduled_orders;

CREATE POLICY "Users manage own schedules"
  ON public.scheduled_orders
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can read all (for cron runner)
DROP POLICY IF EXISTS "Service role reads all schedules" ON public.scheduled_orders;
CREATE POLICY "Service role reads all schedules"
  ON public.scheduled_orders
  FOR SELECT
  USING (auth.role() = 'service_role');
