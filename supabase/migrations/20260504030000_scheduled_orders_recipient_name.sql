ALTER TABLE public.scheduled_orders
  ADD COLUMN IF NOT EXISTS recipient_name TEXT;
