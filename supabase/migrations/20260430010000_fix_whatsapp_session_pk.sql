-- Fix: revert to single primary key on phone_number
-- Since we use one bot for all agents, each customer has one active session

ALTER TABLE public.whatsapp_sessions DROP CONSTRAINT IF EXISTS whatsapp_sessions_pkey;
ALTER TABLE public.whatsapp_sessions ADD PRIMARY KEY (phone_number);
