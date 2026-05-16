-- 1. Create the Agent API Keys table
CREATE TABLE IF NOT EXISTS public.agent_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    key_name TEXT NOT NULL,
    api_key TEXT UNIQUE NOT NULL, -- This will be the actual key provided to devs
    spending_limit_daily DECIMAL DEFAULT 0,
    current_daily_spend DECIMAL DEFAULT 0,
    last_reset_at TIMESTAMPTZ DEFAULT NOW(),
    permissions JSONB DEFAULT '{"airtime": true, "data": true}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

-- 2. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_api_keys;

-- 3. RLS Policies
ALTER TABLE public.agent_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can manage their own API keys" 
ON public.agent_api_keys 
FOR ALL 
USING (auth.uid() = agent_id);

CREATE POLICY "Admins can view all agent API keys" 
ON public.agent_api_keys 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 4. Function to reset daily spend (to be called by a cron job)
CREATE OR REPLACE FUNCTION reset_agent_api_daily_spend()
RETURNS void AS $$
BEGIN
    UPDATE public.agent_api_keys 
    SET current_daily_spend = 0, 
        last_reset_at = NOW()
    WHERE last_reset_at < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- 5. Add index for fast lookup
CREATE INDEX idx_agent_api_keys_lookup ON public.agent_api_keys(api_key);
