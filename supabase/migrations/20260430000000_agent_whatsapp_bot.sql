-- Migration: Add WhatsApp bot configuration columns for agents
-- Each agent can connect their own WaSender session

-- Add bot config columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wa_bot_api_key TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS wa_bot_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS wa_bot_greeting TEXT DEFAULT '';

-- Add agent_id to whatsapp_sessions to link customer conversations to specific agents
ALTER TABLE public.whatsapp_sessions
  ADD COLUMN IF NOT EXISTS agent_id TEXT DEFAULT '';

-- Index for fast lookup by agent_id
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_agent_id ON public.whatsapp_sessions(agent_id);

-- Composite unique index so the same phone can talk to different agent bots
ALTER TABLE public.whatsapp_sessions DROP CONSTRAINT IF EXISTS whatsapp_sessions_pkey;
ALTER TABLE public.whatsapp_sessions ADD PRIMARY KEY (phone_number, agent_id);
