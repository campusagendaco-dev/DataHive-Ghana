-- Initialize the "God Mode" AI Data Core

-- 1. AI Insights Table (Profit Optimizer & Liquidity Forecaster)
CREATE TABLE IF NOT EXISTS public.ai_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES auth.users(id),
    type TEXT NOT NULL, -- 'profit_optimization', 'liquidity_warning', 'market_opportunity'
    insight_text TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb, -- Store raw numbers, e.g., { "suggested_rate": 0.6, "current_rate": 0.5 }
    is_applied BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Fraud Risk Engine (Sentinel Prime)
CREATE TABLE IF NOT EXISTS public.fraud_risk_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES auth.users(id),
    order_id UUID REFERENCES public.orders(id),
    risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_factors TEXT[] DEFAULT '{}', -- e.g., ['high_velocity', 'unusual_location', 'multiple_failures']
    action_taken TEXT DEFAULT 'monitored', -- 'monitored', 'flagged', 'blocked'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Auto-Reconciliation Ledger
CREATE TABLE IF NOT EXISTS public.reconciliation_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    provider TEXT NOT NULL, -- 'theTeller', 'Paystack'
    total_system_volume NUMERIC(15,2) NOT NULL,
    total_provider_volume NUMERIC(15,2) NOT NULL,
    discrepancy NUMERIC(15,2) NOT NULL,
    status TEXT DEFAULT 'pending', -- 'balanced', 'discrepancy_found', 'resolved'
    findings JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Enable RLS for Admin Visibility
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_risk_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_reports ENABLE ROW LEVEL SECURITY;

-- Only admins can see AI insights and Fraud logs
CREATE POLICY "Admin full access to AI insights" ON public.ai_insights FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admin full access to Fraud logs" ON public.fraud_risk_logs FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admin full access to Recon reports" ON public.reconciliation_reports FOR ALL TO authenticated USING (public.is_admin());

-- 5. Helper Function for Real-Time Risk Scoring
CREATE OR REPLACE FUNCTION calculate_terminal_risk(p_agent_id UUID)
RETURNS INTEGER AS $$
DECLARE
    recent_count INTEGER;
    failed_count INTEGER;
    v_risk INTEGER := 0;
BEGIN
    -- Check velocity (orders in last 5 minutes)
    SELECT COUNT(*) INTO recent_count FROM public.orders 
    WHERE agent_id = p_agent_id AND created_at > now() - interval '5 minutes';
    
    IF recent_count > 5 THEN v_risk := v_risk + 30; END IF;
    IF recent_count > 10 THEN v_risk := v_risk + 50; END IF;
    
    -- Check failure rate
    SELECT COUNT(*) INTO failed_count FROM public.orders 
    WHERE agent_id = p_agent_id AND status = 'failed' AND created_at > now() - interval '1 hour';
    
    IF failed_count > 3 THEN v_risk := v_risk + 20; END IF;
    
    RETURN LEAST(v_risk, 100);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
