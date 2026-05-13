-- Activate and Fix Withdrawal Auto-Approval System

-- 1. Add missing configuration columns to system_settings
ALTER TABLE public.system_settings 
  ADD COLUMN IF NOT EXISTS min_withdrawal_amount numeric(12,2) DEFAULT 25.00,
  ADD COLUMN IF NOT EXISTS withdrawal_system_enabled boolean DEFAULT true;

-- 2. Fix the should_auto_approve_withdrawal function
-- Correcting table name from wallet_withdrawals to withdrawals
-- Ensuring it references the latest config
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
  -- Fix: Use 'withdrawals' table instead of 'wallet_withdrawals'
  SELECT * INTO v_w
  FROM public.withdrawals WHERE id = p_withdrawal_id;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Get system config (assumes id=1)
  SELECT * INTO v_cfg FROM public.system_settings WHERE id = 1;
  
  -- Check if auto-approval is enabled globally
  IF NOT COALESCE(v_cfg.withdrawal_auto_approve_enabled, false) THEN RETURN false; END IF;
  
  -- Check amount threshold
  IF v_w.amount > COALESCE(v_cfg.withdrawal_auto_approve_max_amount, 200) THEN RETURN false; END IF;

  -- Check agent account age (security measure)
  SELECT EXTRACT(DAY FROM now() - p.created_at)::int INTO v_days
  FROM public.profiles p WHERE p.user_id = v_w.agent_id;
  
  IF v_days < COALESCE(v_cfg.withdrawal_auto_approve_min_age_days, 7) THEN RETURN false; END IF;

  -- Check for recent failed orders (fraud signal)
  IF COALESCE(v_cfg.withdrawal_auto_approve_require_no_chargebacks, true) THEN
    SELECT COUNT(*) INTO v_failed_count
    FROM public.orders
    WHERE agent_id = v_w.agent_id
      AND status = 'fulfillment_failed'
      AND created_at > now() - interval '7 days';
    
    -- If they have more than 5 failed orders in a week, manual review is better
    IF v_failed_count > 5 THEN RETURN false; END IF;
  END IF;

  RETURN true;
END;
$$;

-- 3. Update request_withdrawal RPC to integrate auto-approval
CREATE OR REPLACE FUNCTION public.request_withdrawal(p_agent_id UUID, p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_profit NUMERIC;
    v_total_withdrawn NUMERIC;
    v_wallet_balance NUMERIC;
    v_available_to_withdraw NUMERIC;
    v_withdrawal_id UUID;
    v_fee NUMERIC;
    v_net_amount NUMERIC;
    v_min_withdrawal NUMERIC;
    v_auto_approve BOOLEAN;
    v_status TEXT := 'pending';
BEGIN
    -- Get dynamic config
    SELECT 
      COALESCE(min_withdrawal_amount, 25.00),
      withdrawal_system_enabled
    INTO v_min_withdrawal, v_auto_approve
    FROM public.system_settings WHERE id = 1;

    -- Check if system is active
    IF NOT v_auto_approve THEN
      RETURN jsonb_build_object('success', false, 'error', 'Withdrawal system is currently undergoing maintenance.');
    END IF;

    -- Check min amount
    IF p_amount < v_min_withdrawal THEN
        RETURN jsonb_build_object('success', false, 'error', format('Minimum withdrawal is GHS %.2f', v_min_withdrawal));
    END IF;

    -- 1. Calculate Lifetime Profit
    SELECT COALESCE(SUM(profit), 0) INTO v_total_profit 
    FROM public.orders 
    WHERE agent_id = p_agent_id AND status = 'fulfilled';

    SELECT v_total_profit + COALESCE(SUM(parent_profit), 0) INTO v_total_profit
    FROM public.orders
    WHERE parent_agent_id = p_agent_id AND status = 'fulfilled';

    -- 2. Calculate Total Requested/Withdrawn
    SELECT COALESCE(SUM(amount), 0) INTO v_total_withdrawn
    FROM public.withdrawals
    WHERE agent_id = p_agent_id AND status IN ('pending', 'completed', 'processing');

    -- 3. Get Liquid Wallet Balance
    SELECT balance INTO v_wallet_balance
    FROM public.wallets
    WHERE agent_id = p_agent_id;

    -- 4. Available to withdraw
    v_available_to_withdraw := LEAST(v_total_profit - v_total_withdrawn, v_wallet_balance);

    IF p_amount > v_available_to_withdraw THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient balance',
            'available', ROUND(v_available_to_withdraw, 2)
        );
    END IF;

    -- 5. Calculate Fee (1.5%)
    v_fee := ROUND(p_amount * 0.015, 2);
    v_net_amount := p_amount - v_fee;

    -- 6. Insert Withdrawal
    INSERT INTO public.withdrawals (agent_id, amount, fee, net_amount, status)
    VALUES (p_agent_id, p_amount, v_fee, v_net_amount, v_status)
    RETURNING id INTO v_withdrawal_id;

    -- 7. Evaluate Auto-Approval
    IF public.should_auto_approve_withdrawal(v_withdrawal_id) THEN
      UPDATE public.withdrawals SET status = 'processing', failure_reason = 'Auto-approved based on system rules' WHERE id = v_withdrawal_id;
      v_status := 'processing';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'withdrawal_id', v_withdrawal_id,
        'fee', v_fee,
        'net_amount', v_net_amount,
        'status', v_status
    );
END;
$$;

-- 4. Refresh the public view to include new columns
DROP VIEW IF EXISTS public.public_system_settings CASCADE;
CREATE OR REPLACE VIEW public.public_system_settings AS
SELECT 
  id,
  auto_api_switch,
  holiday_mode_enabled,
  holiday_message,
  disable_ordering,
  dark_mode_enabled,
  store_visitor_popup_enabled,
  customer_service_number,
  support_channel_link,
  mtn_markup_percentage,
  telecel_markup_percentage,
  at_markup_percentage,
  show_announcement,
  announcement_title,
  announcement_message,
  free_data_enabled,
  free_data_network,
  free_data_package_size,
  free_data_max_claims,
  free_data_claims_count,
  home_page_video_url,
  home_page_video_muted,
  agent_activation_fee,
  sub_agent_base_fee,
  wassce_price,
  bece_price,
  show_scrolling_ad,
  scrolling_ad_text,
  scrolling_ad_image_url,
  traditional_background_enabled,
  background_custom_image_url,
  enable_privacy_shield,
  maintenance_mode,
  maintenance_message,
  withdrawal_auto_approve_enabled,
  withdrawal_auto_approve_max_amount,
  withdrawal_auto_approve_min_age_days,
  withdrawal_auto_approve_require_no_chargebacks,
  min_withdrawal_amount,
  withdrawal_system_enabled,
  updated_at
FROM public.system_settings;

GRANT SELECT ON public.public_system_settings TO anon, authenticated, service_role;
