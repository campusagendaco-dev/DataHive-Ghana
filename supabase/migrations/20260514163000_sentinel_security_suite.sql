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
USING (auth.jwt() ->> 'role' = 'service_role' OR (SELECT is_admin FROM profiles WHERE user_id = auth.uid()));

-- Realtime for dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE sentinel_security_audits;
ALTER PUBLICATION supabase_realtime ADD TABLE blocked_ips;
