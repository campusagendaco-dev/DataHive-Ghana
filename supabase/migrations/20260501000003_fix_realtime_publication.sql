-- Fix: agent_stores is a VIEW and cannot be added to the supabase_realtime publication.
-- Idempotently ensure only real tables are in the publication.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.orders';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'support_conversations'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversations';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'support_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages';
  END IF;
END $$;

-- Prevent confusion: this is a security-restricted VIEW, not a table.
-- Do NOT toggle realtime on it in the Supabase dashboard — it will always fail.
COMMENT ON VIEW public.agent_stores IS 'READ-ONLY VIEW over profiles (security-restricted). Cannot be added to supabase_realtime — subscribe to the profiles table instead.';
