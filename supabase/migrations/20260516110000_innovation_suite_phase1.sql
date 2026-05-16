-- Innovation Suite: Phase 1 (AI Judge) & Phase 2 (Float Bridge)
-- This migration establishes the infrastructure for autonomous disputes and AI-powered liquidity.

-- 1. Create Disputes Table
CREATE TABLE IF NOT EXISTS public.order_disputes (
    id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id            uuid REFERENCES public.orders(id) NOT NULL,
    user_id             uuid REFERENCES auth.users(id) NOT NULL,
    reason              text NOT NULL,
    evidence_metadata   jsonb DEFAULT '{}',
    status              text DEFAULT 'pending', -- pending, ai_investigating, resolved, rejected
    judgment_reasoning  text,
    resolution_action   text, -- refund, partial_refund, manual_review
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

-- 2. Enhance Wallets with AI Trust Score & Auto-Credit
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS ai_trust_score float DEFAULT 50.0; -- 0 to 100
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS auto_credit_limit NUMERIC DEFAULT 0.0;
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS last_credit_review timestamptz;

-- 3. Trigger for AI Judge to wake up
CREATE OR REPLACE FUNCTION public.handle_new_dispute()
RETURNS TRIGGER AS $$
BEGIN
  -- Awaken the Oracle AI to investigate the dispute instantly
  -- This will call the oracle-ai edge function
  RAISE NOTICE 'Oracle AI Awakened for Dispute Investigation on Order %', NEW.order_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_dispute_sentinel
  AFTER INSERT ON public.order_disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_dispute();

-- 4. Log the initialization of the God Mode Suite
INSERT INTO public.sentinel_actions (action_type, status, reasoning)
VALUES ('innovation_init', 'executed', 'God Mode Innovation Suite (Phase 1 & 2) infrastructure has been deployed. AI Judge and Float Bridge are now active.');

-- RLS for Disputes
ALTER TABLE public.order_disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own disputes" ON public.order_disputes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create disputes" ON public.order_disputes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage all disputes" ON public.order_disputes FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
