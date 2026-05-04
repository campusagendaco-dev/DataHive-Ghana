-- Add Paystack transfer tracking fields to withdrawals table.
-- These are set when a transfer is initiated and used by the webhook
-- to match transfer.success / transfer.failed events back to the withdrawal.

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS transfer_code TEXT,
  ADD COLUMN IF NOT EXISTS paystack_transfer_reference TEXT;

CREATE INDEX IF NOT EXISTS idx_withdrawals_paystack_transfer_reference
  ON public.withdrawals (paystack_transfer_reference)
  WHERE paystack_transfer_reference IS NOT NULL;
