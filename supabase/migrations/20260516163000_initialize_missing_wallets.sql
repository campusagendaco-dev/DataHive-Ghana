-- Migration: Initialize Missing Wallets
-- Description: Ensures every user in the profiles table has a corresponding record in the wallets table.
-- This prevents null responses in the frontend and ensures financial consistency for all agents.

INSERT INTO public.wallets (agent_id, balance, loyalty_balance, api_balance, created_at, updated_at)
SELECT 
    p.user_id, 
    0.00, 
    0, 
    0.00, 
    now(), 
    now()
FROM public.profiles p
LEFT JOIN public.wallets w ON p.user_id = w.agent_id
WHERE w.agent_id IS NULL
ON CONFLICT (agent_id) DO NOTHING;

-- Log the action to the sentinel audit log
INSERT INTO public.sentinel_actions (action_type, status, reasoning)
VALUES (
    'wallet_initialization', 
    'executed', 
    'System-wide wallet initialization completed. Ensured all profiles have a linked wallet record to prevent display discrepancies.'
);

-- Ensure RLS policies are robust for the wallets table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'wallets' AND policyname = 'Agents can view own wallet'
    ) THEN
        CREATE POLICY "Agents can view own wallet" ON public.wallets
        FOR SELECT USING (auth.uid() = agent_id);
    END IF;
END $$;
