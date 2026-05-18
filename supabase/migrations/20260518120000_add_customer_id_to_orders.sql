-- 20260518120000_add_customer_id_to_orders.sql
-- Adds an optional customer_id column to the orders table.
-- Used by store_wallet_topup orders to link the store customer being credited,
-- so the paystack-webhook can reliably read it without depending on Paystack metadata alone.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id)
  WHERE customer_id IS NOT NULL;
