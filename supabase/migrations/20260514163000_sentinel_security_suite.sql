-- Sentinel Security Suite
-- Enables autonomous threat detection and automated blacklisting

-- 1. Security Audit Log
CREATE TABLE IF NOT EXISTS public.sentinel_security_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ts TIMESTAMPTZ DEFAULT now(),
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    event_type TEXT,
    description TEXT,
    attacker_info JSONB, -- IP, UserAgent, etc.
    action_taken TEXT,
    is_resolved BOOLEAN DEFAULT false
);

-- 2. Blocked IPs (Autonomous Blacklist)
CREATE TABLE IF NOT EXISTS public.blocked_ips (
    ip_address TEXT PRIMARY KEY,
    reason TEXT,
    blocked_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    blocked_by TEXT DEFAULT 'sentinel-ai'
);

-- Enable RLS
ALTER TABLE public.sentinel_security_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;

-- Only admins can see security audits
CREATE POLICY "Admins can view security audits" 
ON public.sentinel_security_audits FOR SELECT 
USING (auth.jwt() ->> 'role' = 'service_role' OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Realtime for dashboard
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'sentinel_security_audits') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sentinel_security_audits;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'blocked_ips') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE blocked_ips;
  END IF;
END $$;
