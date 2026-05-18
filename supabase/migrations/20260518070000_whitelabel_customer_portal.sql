-- 20260518070000_whitelabel_customer_portal.sql
-- Create the deposit_requests table to manage customer mobile money funding requests on reseller storefronts

CREATE TABLE IF NOT EXISTS public.deposit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  sender_name TEXT NOT NULL,
  sender_phone TEXT NOT NULL,
  transaction_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;

-- Drop policies if they already exist
DROP POLICY IF EXISTS "customers_manage_deposit_requests" ON public.deposit_requests;
DROP POLICY IF EXISTS "agents_manage_deposit_requests" ON public.deposit_requests;

-- Customers can select, insert their own deposit requests
CREATE POLICY "customers_manage_deposit_requests" ON public.deposit_requests
  FOR ALL TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());

-- Agents can select, update deposit requests assigned to their store
CREATE POLICY "agents_manage_deposit_requests" ON public.deposit_requests
  FOR ALL TO authenticated USING (agent_id = auth.uid()) WITH CHECK (agent_id = auth.uid());

-- Grant access to anon and authenticated
GRANT SELECT, INSERT, UPDATE ON public.deposit_requests TO anon, authenticated;
