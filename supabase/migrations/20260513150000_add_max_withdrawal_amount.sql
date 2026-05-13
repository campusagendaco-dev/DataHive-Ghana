-- Add max_withdrawal_amount to system_settings
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS max_withdrawal_amount numeric(12,2) DEFAULT 5000.00;

-- Update request_withdrawal to also enforce max
CREATE OR REPLACE FUNCTION public.request_withdrawal(p_agent_id UUID, p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_profit          NUMERIC;
    v_total_withdrawn       NUMERIC;
    v_wallet_balance        NUMERIC;
    v_available_to_withdraw NUMERIC;
    v_withdrawal_id         UUID;
    v_fee                   NUMERIC;
    v_net_amount            NUMERIC;
    v_min_withdrawal        NUMERIC;
    v_max_withdrawal        NUMERIC;
    v_system_enabled        BOOLEAN;
    v_status                TEXT := 'pending';
BEGIN
    SELECT
      COALESCE(min_withdrawal_amount, 25.00),
      COALESCE(max_withdrawal_amount, 5000.00),
      COALESCE(withdrawal_system_enabled, true)
    INTO v_min_withdrawal, v_max_withdrawal, v_system_enabled
    FROM public.system_settings WHERE id = 1;

    IF NOT v_system_enabled THEN
      RETURN jsonb_build_object('success', false, 'error', 'Withdrawal system is currently undergoing maintenance.');
    END IF;

    IF p_amount < v_min_withdrawal THEN
      RETURN jsonb_build_object('success', false, 'error', format('Minimum withdrawal is GHS %.2f', v_min_withdrawal));
    END IF;

    IF p_amount > v_max_withdrawal THEN
      RETURN jsonb_build_object('success', false, 'error', format('Maximum withdrawal is GHS %.2f', v_max_withdrawal));
    END IF;

    -- Calculate lifetime profit
    SELECT COALESCE(SUM(profit), 0) INTO v_total_profit
    FROM public.orders
    WHERE agent_id = p_agent_id AND status = 'fulfilled';

    SELECT v_total_profit + COALESCE(SUM(parent_profit), 0) INTO v_total_profit
    FROM public.orders
    WHERE parent_agent_id = p_agent_id AND status = 'fulfilled';

    -- Total already withdrawn (pending + completed + processing)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_withdrawn
    FROM public.withdrawals
    WHERE agent_id = p_agent_id AND status IN ('pending', 'completed', 'processing');

    -- Liquid wallet balance
    SELECT balance INTO v_wallet_balance
    FROM public.wallets
    WHERE agent_id = p_agent_id;

    v_available_to_withdraw := LEAST(v_total_profit - v_total_withdrawn, COALESCE(v_wallet_balance, 0));

    IF p_amount > v_available_to_withdraw THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Insufficient balance',
        'available', ROUND(v_available_to_withdraw, 2)
      );
    END IF;

    v_fee        := ROUND(p_amount * 0.015, 2);
    v_net_amount := p_amount - v_fee;

    INSERT INTO public.withdrawals (agent_id, amount, fee, net_amount, status)
    VALUES (p_agent_id, p_amount, v_fee, v_net_amount, v_status)
    RETURNING id INTO v_withdrawal_id;

    IF public.should_auto_approve_withdrawal(v_withdrawal_id) THEN
      UPDATE public.withdrawals
      SET status = 'processing', failure_reason = 'Auto-approved based on system rules'
      WHERE id = v_withdrawal_id;
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

-- Rebuild public view to include max_withdrawal_amount
DROP VIEW IF EXISTS public.public_system_settings CASCADE;
CREATE VIEW public.public_system_settings AS
SELECT
  id, disable_ordering, dark_mode_enabled, store_visitor_popup_enabled,
  customer_service_number, support_channel_link, holiday_mode_enabled, holiday_message,
  mtn_markup_percentage, telecel_markup_percentage, at_markup_percentage,
  auto_pending_sms_enabled, show_announcement, announcement_title, announcement_message,
  free_data_enabled, free_data_network, free_data_package_size,
  free_data_max_claims, free_data_claims_count,
  home_page_video_url, home_page_video_muted,
  withdrawal_auto_approve_enabled, withdrawal_auto_approve_max_amount,
  withdrawal_auto_approve_min_age_days, withdrawal_auto_approve_require_no_chargebacks,
  min_withdrawal_amount, max_withdrawal_amount, withdrawal_system_enabled,
  traditional_background_enabled, background_custom_image_url, enable_privacy_shield,
  show_scrolling_ad, scrolling_ad_text, scrolling_ad_image_url,
  agent_activation_fee, sub_agent_base_fee, wassce_price, bece_price,
  maintenance_mode, maintenance_message, whatsapp_bot_prompt,
  auto_api_switch,
  tutorial_buy_video_url, tutorial_agent_video_url, tutorial_subagent_video_url,
  updated_at
FROM public.system_settings;

GRANT SELECT ON public.public_system_settings TO anon, authenticated, service_role;
