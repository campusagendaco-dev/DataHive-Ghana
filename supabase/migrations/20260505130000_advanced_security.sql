-- Add security fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS transaction_pin TEXT; -- Hashed PIN
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_security_update TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add security fields to user_roles for IP lockdown
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS allowed_ips TEXT[]; -- Array of allowed IPs

-- Create security logs table
CREATE TABLE IF NOT EXISTS public.security_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'login', 'pin_change', 'biometric_added', 'withdrawal_request'
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on security_logs
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own security logs" 
    ON public.security_logs FOR SELECT 
    USING (auth.uid() = user_id);

-- Create a function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
    p_user_id UUID,
    p_action TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.security_logs (user_id, action, metadata)
    VALUES (p_user_id, p_action, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to log_security_event
GRANT EXECUTE ON FUNCTION public.log_security_event TO authenticated;
