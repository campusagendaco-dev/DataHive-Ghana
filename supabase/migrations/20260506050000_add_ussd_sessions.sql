-- Migration: Add USSD Sessions table for Arkesel USSD state management
-- Description: Creates a table to store the state of ongoing USSD sessions.

CREATE TABLE IF NOT EXISTS public.ussd_sessions (
    session_id TEXT PRIMARY KEY,
    phone_number TEXT NOT NULL,
    agent_code TEXT,
    current_step TEXT NOT NULL DEFAULT 'MENU',
    order_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.ussd_sessions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Enable all for service role on ussd_sessions"
ON public.ussd_sessions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
