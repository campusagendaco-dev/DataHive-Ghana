-- Enable Row Level Security (RLS) on the idempotency_keys table to prevent unauthorized data exposure or key injection.
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own idempotency keys" ON public.idempotency_keys;
CREATE POLICY "Users can manage own idempotency keys" ON public.idempotency_keys
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can do everything on idempotency keys" ON public.idempotency_keys;
CREATE POLICY "Service role can do everything on idempotency keys" ON public.idempotency_keys
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
