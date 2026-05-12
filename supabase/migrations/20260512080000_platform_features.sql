-- ============================================================
-- PLATFORM FEATURES MIGRATION
-- Provider balance alerts, auto-refund, fraud detection,
-- maintenance mode, feature flags, SMS templates,
-- agent credit/float, withdrawal auto-approval rules
-- ============================================================

-- ─────────────────────────────────────────
-- 1. PROVIDER ENHANCEMENTS
-- ─────────────────────────────────────────
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS balance               numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_alert_threshold numeric(12,2) DEFAULT 500,
  ADD COLUMN IF NOT EXISTS balance_checked_at    timestamptz,
  ADD COLUMN IF NOT EXISTS consecutive_failures  int          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_disable_on_low_balance boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS disabled_reason       text;

-- ─────────────────────────────────────────
-- 2. AUTO-REFUND ON FAILED ORDERS
-- ─────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refunded_at     timestamptz,
  ADD COLUMN IF NOT EXISTS refund_amount   numeric(12,2),
  ADD COLUMN IF NOT EXISTS refund_reason   text,
  ADD COLUMN IF NOT EXISTS auto_refunded   boolean DEFAULT false;

-- Function to refund a failed order back to agent wallet
CREATE OR REPLACE FUNCTION public.refund_failed_order(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order  public.orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN RETURN false; END IF;
  IF v_order.auto_refunded THEN RETURN false; END IF;  -- idempotent
  IF v_order.payment_method NOT IN ('wallet', 'balance') THEN RETURN false; END IF;
  IF v_order.amount <= 0 THEN RETURN false; END IF;

  -- Refund wallet
  PERFORM public.credit_wallet(p_agent_id := v_order.agent_id, p_amount := v_order.amount);

  -- Mark order as refunded
  UPDATE public.orders SET
    auto_refunded  = true,
    refunded_at    = now(),
    refund_amount  = v_order.amount,
    refund_reason  = 'Auto-refund: order fulfillment failed',
    updated_at     = now()
  WHERE id = p_order_id;

  -- Log it
  INSERT INTO public.system_logs (level, source, event, message, order_id, agent_id, data)
  VALUES (
    'info', 'system', 'order.refunded',
    format('Auto-refund GHS %.2f for failed order', v_order.amount),
    p_order_id, v_order.agent_id,
    jsonb_build_object('amount', v_order.amount, 'network', v_order.network, 'package_size', v_order.package_size)
  );

  -- Notify agent
  INSERT INTO public.user_notifications (user_id, title, message, type, data)
  VALUES (
    v_order.agent_id,
    'Order Refunded',
    format('GHS %.2f has been refunded to your wallet. Order for %s %s could not be fulfilled.',
      v_order.amount, v_order.network, v_order.package_size),
    'info',
    jsonb_build_object('order_id', p_order_id, 'amount', v_order.amount)
  )
  ON CONFLICT DO NOTHING;

  RETURN true;
END;
$$;

-- Trigger: auto-refund when order transitions to fulfillment_failed
CREATE OR REPLACE FUNCTION public.trigger_auto_refund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'fulfillment_failed'
     AND OLD.status != 'fulfillment_failed'
     AND NEW.payment_method IN ('wallet', 'balance')
     AND NOT COALESCE(NEW.auto_refunded, false)
  THEN
    PERFORM public.refund_failed_order(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_refund ON public.orders;
CREATE TRIGGER trg_auto_refund
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trigger_auto_refund();

-- ─────────────────────────────────────────
-- 3. FRAUD / VELOCITY DETECTION
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blacklisted_phones (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  phone        text        NOT NULL UNIQUE,
  reason       text,
  blacklisted_by uuid,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.blacklisted_phones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_manage_blacklisted_phones"
  ON public.blacklisted_phones FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS public.fraud_flags (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id    uuid        REFERENCES public.orders(id),
  agent_id    uuid,
  phone       text,
  flag_type   text        NOT NULL, -- 'velocity' | 'blacklist' | 'duplicate'
  details     jsonb,
  reviewed    boolean     DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_read_fraud_flags"
  ON public.fraud_flags FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Velocity check function: returns flag type or NULL if clean
CREATE OR REPLACE FUNCTION public.check_order_velocity(
  p_phone    text,
  p_agent_id uuid
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_phone_count   int;
  v_agent_count   int;
  v_is_blacklisted boolean;
BEGIN
  -- Check blacklist
  SELECT EXISTS (SELECT 1 FROM public.blacklisted_phones WHERE phone = p_phone)
  INTO v_is_blacklisted;
  IF v_is_blacklisted THEN RETURN 'blacklist'; END IF;

  -- Same phone ordered more than 5 times in last hour across all agents
  SELECT COUNT(*) INTO v_phone_count
  FROM public.orders
  WHERE customer_phone = p_phone
    AND created_at > now() - interval '1 hour'
    AND status NOT IN ('fulfillment_failed', 'pending');
  IF v_phone_count >= 5 THEN RETURN 'velocity_phone'; END IF;

  -- Same agent placing more than 50 orders per hour
  SELECT COUNT(*) INTO v_agent_count
  FROM public.orders
  WHERE agent_id = p_agent_id
    AND created_at > now() - interval '1 hour';
  IF v_agent_count >= 50 THEN RETURN 'velocity_agent'; END IF;

  RETURN NULL;
END;
$$;

-- ─────────────────────────────────────────
-- 4. MAINTENANCE MODE
-- ─────────────────────────────────────────
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS maintenance_mode        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS maintenance_message     text    DEFAULT 'We are performing scheduled maintenance. Please check back shortly.',
  ADD COLUMN IF NOT EXISTS maintenance_started_at  timestamptz,
  ADD COLUMN IF NOT EXISTS maintenance_eta         text;

-- ─────────────────────────────────────────
-- 5. FEATURE FLAGS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id           uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  key          text    NOT NULL UNIQUE,  -- 'free_data', 'referral_program', 'whatsapp_bot', etc.
  label        text    NOT NULL,
  description  text,
  enabled      boolean DEFAULT true,
  enabled_for  jsonb   DEFAULT '[]'::jsonb,  -- array of user_ids for partial rollout
  disabled_for jsonb   DEFAULT '[]'::jsonb,  -- array of user_ids to exclude
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_read_feature_flags"
  ON public.feature_flags FOR SELECT USING (true);

CREATE POLICY "admins_manage_feature_flags"
  ON public.feature_flags FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Seed core flags
INSERT INTO public.feature_flags (key, label, description, enabled) VALUES
  ('free_data',          'Free Data Campaign',   'Allow agents to claim free data bundles',        false),
  ('referral_program',   'Referral Program',     'Enable referral links and bonus credits',        true),
  ('whatsapp_bot',       'WhatsApp Bot',         'Allow agents to configure WhatsApp ordering bot', true),
  ('airtime_purchase',   'Airtime Purchase',     'Enable airtime buying for agents',               false),
  ('result_checker',     'Result Checker',       'Enable WAEC/BECE result checking feature',       true),
  ('api_access',         'Developer API',        'Allow agents to generate and use API keys',      true),
  ('agent_credit',       'Agent Credit/Float',   'Allow trusted agents to buy on credit',          false),
  ('bulk_disbursement',  'Bulk Disbursement',    'Enable CSV bulk data disbursement',              true)
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────
-- 6. SMS TEMPLATES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sms_templates (
  id          uuid  DEFAULT gen_random_uuid() PRIMARY KEY,
  key         text  NOT NULL UNIQUE,  -- 'payment_success', 'order_fulfilled', etc.
  label       text  NOT NULL,
  body        text  NOT NULL,         -- supports {phone}, {package}, {amount}, {network}, {agent_name}
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Handle case where table already exists without key/label columns
ALTER TABLE public.sms_templates ADD COLUMN IF NOT EXISTS key       text;
ALTER TABLE public.sms_templates ADD COLUMN IF NOT EXISTS label     text;
ALTER TABLE public.sms_templates ADD COLUMN IF NOT EXISTS body      text;
ALTER TABLE public.sms_templates ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.sms_templates ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.sms_templates ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Drop NOT NULL on legacy columns that may conflict with new inserts
DO $$ DECLARE col record; BEGIN
  FOR col IN SELECT column_name FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'sms_templates'
               AND is_nullable = 'NO' AND column_name NOT IN ('id','key','label','body')
  LOOP
    EXECUTE format('ALTER TABLE public.sms_templates ALTER COLUMN %I DROP NOT NULL', col.column_name);
  END LOOP;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sms_templates_key_key' AND conrelid = 'public.sms_templates'::regclass
  ) THEN
    ALTER TABLE public.sms_templates ADD CONSTRAINT sms_templates_key_key UNIQUE (key);
  END IF;
END $$;

ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_manage_sms_templates"
  ON public.sms_templates FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "service_read_sms_templates"
  ON public.sms_templates FOR SELECT USING (true);

INSERT INTO public.sms_templates (key, label, body) VALUES
  ('payment_success',  'Payment Confirmed',     'Hi, your payment of GHS {amount} has been received. Your {package} for {phone} is being processed. - SwiftData GH'),
  ('order_fulfilled',  'Data Delivered',        'Your {network} {package} data bundle has been delivered to {phone}. Thank you for using SwiftData GH!'),
  ('order_failed',     'Order Failed',          'We were unable to deliver your {package} bundle to {phone}. Your wallet has been refunded GHS {amount}. Contact support if needed.'),
  ('order_refunded',   'Wallet Refunded',       'GHS {amount} has been refunded to your SwiftData wallet for the failed order. Your current balance is available in the app.'),
  ('low_balance',      'Low Wallet Balance',    'Your SwiftData wallet balance is low. Top up now to continue selling data bundles. Visit the app to top up.'),
  ('withdrawal_approved', 'Withdrawal Approved','Your withdrawal of GHS {amount} to {momo_number} ({momo_network}) has been approved and is being processed.'),
  ('error_spike_alert','Error Spike Alert',     'ALERT: {count} system errors detected in the last 10 minutes on SwiftData. Login to admin panel immediately.')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────
-- 7. AGENT CREDIT / FLOAT SYSTEM
-- ─────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credit_enabled   boolean  DEFAULT false,
  ADD COLUMN IF NOT EXISTS credit_limit     numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_used      numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_due_date  date,
  ADD COLUMN IF NOT EXISTS credit_approved_by uuid,
  ADD COLUMN IF NOT EXISTS credit_approved_at timestamptz;

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id    uuid        NOT NULL,
  order_id    uuid,
  type        text        NOT NULL, -- 'draw' | 'repay' | 'adjust'
  amount      numeric(12,2) NOT NULL,
  balance_after numeric(12,2),
  note        text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_read_credit_transactions"
  ON public.credit_transactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "agents_read_own_credit"
  ON public.credit_transactions FOR SELECT
  USING (agent_id = auth.uid());

-- Function to draw credit for an order
CREATE OR REPLACE FUNCTION public.draw_agent_credit(
  p_agent_id uuid,
  p_amount   numeric,
  p_order_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_available numeric;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE user_id = p_agent_id FOR UPDATE;
  IF NOT FOUND OR NOT v_profile.credit_enabled THEN RETURN false; END IF;

  v_available := COALESCE(v_profile.credit_limit, 0) - COALESCE(v_profile.credit_used, 0);
  IF v_available < p_amount THEN RETURN false; END IF;

  UPDATE public.profiles
    SET credit_used = COALESCE(credit_used, 0) + p_amount, updated_at = now()
  WHERE user_id = p_agent_id;

  INSERT INTO public.credit_transactions (agent_id, order_id, type, amount, balance_after, note)
  VALUES (p_agent_id, p_order_id, 'draw', p_amount,
          COALESCE(v_profile.credit_used, 0) + p_amount, 'Credit drawn for order');

  RETURN true;
END;
$$;

-- Function to repay credit
CREATE OR REPLACE FUNCTION public.repay_agent_credit(
  p_agent_id uuid,
  p_amount   numeric,
  p_note     text DEFAULT 'Manual repayment'
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_used numeric;
BEGIN
  SELECT COALESCE(credit_used, 0) INTO v_used FROM public.profiles WHERE user_id = p_agent_id;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.profiles
    SET credit_used = GREATEST(0, credit_used - p_amount), updated_at = now()
  WHERE user_id = p_agent_id;

  INSERT INTO public.credit_transactions (agent_id, type, amount, balance_after, note)
  VALUES (p_agent_id, 'repay', p_amount, GREATEST(0, v_used - p_amount), p_note);

  RETURN true;
END;
$$;

-- ─────────────────────────────────────────
-- 8. WITHDRAWAL AUTO-APPROVAL RULES
-- ─────────────────────────────────────────
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS withdrawal_auto_approve_enabled  boolean  DEFAULT false,
  ADD COLUMN IF NOT EXISTS withdrawal_auto_approve_max_amount numeric(12,2) DEFAULT 200,
  ADD COLUMN IF NOT EXISTS withdrawal_auto_approve_min_age_days int DEFAULT 7,
  ADD COLUMN IF NOT EXISTS withdrawal_auto_approve_require_no_chargebacks boolean DEFAULT true;

-- Function: evaluate if a withdrawal should be auto-approved
CREATE OR REPLACE FUNCTION public.should_auto_approve_withdrawal(p_withdrawal_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_w     RECORD;
  v_cfg   RECORD;
  v_days  int;
  v_failed_count int;
BEGIN
  SELECT * INTO v_w
  FROM public.wallet_withdrawals WHERE id = p_withdrawal_id;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT * INTO v_cfg FROM public.system_settings WHERE id = 1;
  IF NOT v_cfg.withdrawal_auto_approve_enabled THEN RETURN false; END IF;
  IF v_w.amount > v_cfg.withdrawal_auto_approve_max_amount THEN RETURN false; END IF;

  -- Check agent account age
  SELECT EXTRACT(DAY FROM now() - p.created_at)::int INTO v_days
  FROM public.profiles p WHERE p.user_id = v_w.agent_id;
  IF v_days < v_cfg.withdrawal_auto_approve_min_age_days THEN RETURN false; END IF;

  -- Check for recent failed/disputed orders
  IF v_cfg.withdrawal_auto_approve_require_no_chargebacks THEN
    SELECT COUNT(*) INTO v_failed_count
    FROM public.orders
    WHERE agent_id = v_w.agent_id
      AND status = 'fulfillment_failed'
      AND created_at > now() - interval '7 days';
    IF v_failed_count > 3 THEN RETURN false; END IF;
  END IF;

  RETURN true;
END;
$$;
