-- Drop the stale integer overload that causes ambiguity with the numeric variant
DROP FUNCTION IF EXISTS public.convert_loyalty_points(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.convert_loyalty_points(UUID, INT) CASCADE;

-- Ensure only one canonical version exists (numeric/DECIMAL)
DROP FUNCTION IF EXISTS public.convert_loyalty_points(UUID, NUMERIC) CASCADE;

CREATE FUNCTION public.convert_loyalty_points(user_id UUID, points_to_convert NUMERIC)
RETURNS JSONB AS $$
DECLARE
    wallet_row RECORD;
    cash_value NUMERIC;
BEGIN
    IF points_to_convert <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid points amount');
    END IF;

    SELECT * INTO wallet_row FROM public.wallets WHERE agent_id = user_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
    END IF;

    IF wallet_row.loyalty_balance < points_to_convert THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient loyalty balance');
    END IF;

    -- 100 points = 1 GHS
    cash_value := points_to_convert / 100;

    UPDATE public.wallets
    SET
        loyalty_balance = loyalty_balance - points_to_convert,
        balance = balance + cash_value
    WHERE agent_id = user_id;

    RETURN jsonb_build_object(
        'success', true,
        'converted_points', points_to_convert,
        'cash_added', cash_value,
        'new_balance', wallet_row.balance + cash_value,
        'new_loyalty_balance', wallet_row.loyalty_balance - points_to_convert
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.convert_loyalty_points(UUID, NUMERIC) TO authenticated;
