-- Fix: Add missing payment_method column which is referenced by modern triggers and edge functions
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method text;
