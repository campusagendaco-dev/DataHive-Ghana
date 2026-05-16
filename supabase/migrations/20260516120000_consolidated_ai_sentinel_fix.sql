-- CONSOLIDATED SENTINEL & AI INTELLIGENCE INFRASTRUCTURE
-- Fixes 404 errors for ai_insights, fraud_risk_logs, sentinel_actions

-- 1. AI Insights Table
CREATE TABLE IF NOT EXISTS public.ai_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES public.profiles(id),
    type TEXT NOT NULL, -- 'profit_optimization', 'liquidity_warning', 'market_opportunity'
    insight_text TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_applied BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Fraud Risk Logs Table
CREATE TABLE IF NOT EXISTS public.fraud_risk_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES public.profiles(id),
    order_id UUID REFERENCES public.orders(id),
    risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_factors TEXT[] DEFAULT '{}',
    action_taken TEXT DEFAULT 'monitored',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.1 Fix existing foreign keys if they were created incorrectly
DO $$ 
BEGIN
    -- Fix ai_insights
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_insights' AND column_name = 'agent_id') THEN
        ALTER TABLE public.ai_insights DROP CONSTRAINT IF EXISTS ai_insights_agent_id_fkey;
        ALTER TABLE public.ai_insights ADD CONSTRAINT ai_insights_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.profiles(id);
    END IF;
    
    -- Fix fraud_risk_logs
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fraud_risk_logs' AND column_name = 'agent_id') THEN
        ALTER TABLE public.fraud_risk_logs DROP CONSTRAINT IF EXISTS fraud_risk_logs_agent_id_fkey;
        ALTER TABLE public.fraud_risk_logs ADD CONSTRAINT fraud_risk_logs_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.profiles(id);
    END IF;
END $$;

-- 3. Sentinel Strategies Table
CREATE TABLE IF NOT EXISTS public.sentinel_strategies (
    id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at          timestamptz DEFAULT now(),
    name                text NOT NULL,
    condition_prompt    text NOT NULL,
    action_template     jsonb NOT NULL,
    confidence_score    float DEFAULT 0.5,
    version             int DEFAULT 1,
    is_active           boolean DEFAULT true
);

-- 4. Sentinel Actions Table
CREATE TABLE IF NOT EXISTS public.sentinel_actions (
    id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ts                  timestamptz DEFAULT now(),
    action_type         text NOT NULL, -- switch_provider, retry_order, adjust_settings, notify_admin, lock_terminal
    status              text DEFAULT 'pending',
    effectiveness       int DEFAULT 0,
    reasoning           text,
    result              jsonb,
    metadata            jsonb
);

-- 5. Enable RLS
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_risk_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentinel_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentinel_actions ENABLE ROW LEVEL SECURITY;

-- 6. Permissions (Admin Only)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin access to ai_insights') THEN
        CREATE POLICY "Admin access to ai_insights" ON public.ai_insights FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin access to fraud_risk_logs') THEN
        CREATE POLICY "Admin access to fraud_risk_logs" ON public.fraud_risk_logs FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin access to sentinel_strategies') THEN
        CREATE POLICY "Admin access to sentinel_strategies" ON public.sentinel_strategies FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin access to sentinel_actions') THEN
        CREATE POLICY "Admin access to sentinel_actions" ON public.sentinel_actions FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
    END IF;
END $$;

-- 7. Realtime Enablement
-- 7. Realtime Enablement (Idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sentinel_actions') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sentinel_actions;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sentinel_strategies') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sentinel_strategies;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ai_insights') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_insights;
    END IF;
END $$;

-- 8. Support & Chat Infrastructure Upgrades
-- Add is_bot to support_messages if missing
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'support_messages' AND column_name = 'is_bot') THEN
        ALTER TABLE public.support_messages ADD COLUMN is_bot BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 9. AI Concierge Chat History
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'user', 'bot'
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Enable RLS for chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 11. Policies for chat_messages (Users can only see/insert their own messages)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own chat messages') THEN
        CREATE POLICY "Users can manage their own chat messages" ON public.chat_messages 
        FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- 12. Realtime for chat_messages
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
    END IF;
END $$;

