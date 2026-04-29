-- Migration: Add WhatsApp Sessions table for bot state management
-- Description: Creates a table to store the state of ongoing WhatsApp bot interactions.

CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
    phone_number TEXT PRIMARY KEY,
    current_step TEXT NOT NULL DEFAULT 'MENU',
    order_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Enable all for service role on whatsapp_sessions"
ON public.whatsapp_sessions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow anon to have no access directly (edge functions bypass RLS via service role)
