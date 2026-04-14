-- Sub-agent system

-- 1. Extend profiles with sub-agent fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_sub_agent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sub_agent_approved BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS parent_agent_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS sub_agent_activation_markup NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sub_agent_prices JSONB NOT NULL DEFAULT '{}';

-- 2. Add sub-agent base fee to system_settings
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS sub_agent_base_fee NUMERIC NOT NULL DEFAULT 80;

-- 3. Allow parent agents to update their sub agents' profiles (for setting agent_prices)
CREATE POLICY "Parent agents can update sub agent profiles"
  ON public.profiles
  FOR UPDATE TO authenticated
  USING (parent_agent_id = auth.uid())
  WITH CHECK (parent_agent_id = auth.uid());

-- 4. Allow anon to view agent store profiles for sub agents too
--    (existing policy already covers is_agent=true AND onboarding_complete AND agent_approved)
--    No change needed — sub agents will have those flags set on activation.

-- 5. Allow agents to read their own sub agents' profiles
CREATE POLICY "Agents can view their sub agents"
  ON public.profiles
  FOR SELECT TO authenticated
  USING (parent_agent_id = auth.uid());
