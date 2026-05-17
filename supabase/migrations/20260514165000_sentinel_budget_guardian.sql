-- Sentinel Budget Guardian
-- Ensures AI operations stay within a defined monthly budget

-- 1. Budget Configuration
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS sentinel_monthly_budget_usd NUMERIC DEFAULT 10.00,
ADD COLUMN IF NOT EXISTS sentinel_current_month_cost_usd NUMERIC DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS sentinel_budget_alert_threshold NUMERIC DEFAULT 0.80, -- 80%
ADD COLUMN IF NOT EXISTS sentinel_low_power_mode BOOLEAN DEFAULT false;

-- 2. Daily Usage Log
CREATE TABLE IF NOT EXISTS public.sentinel_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day DATE DEFAULT CURRENT_DATE,
    tokens_used INTEGER DEFAULT 0,
    cost_usd NUMERIC DEFAULT 0,
    function_calls INTEGER DEFAULT 1,
    UNIQUE(day)
);

-- Enable RLS
ALTER TABLE public.sentinel_usage_logs ENABLE ROW LEVEL SECURITY;

-- Admins only
CREATE POLICY "Admins can view usage logs" 
ON public.sentinel_usage_logs FOR SELECT 
USING (auth.jwt() ->> 'role' = 'service_role' OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Realtime for dashboard
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'sentinel_usage_logs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sentinel_usage_logs;
  END IF;
END $$;
