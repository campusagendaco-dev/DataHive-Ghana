-- DAILY CHECK-IN SYSTEM

-- 1. Add tracking columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_check_in TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS check_in_streak INTEGER DEFAULT 0;

-- 2. Create the check-in RPC
CREATE OR REPLACE FUNCTION public.claim_daily_check_in(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_last_check_in TIMESTAMP WITH TIME ZONE;
    v_streak INTEGER;
    v_points_to_award INTEGER;
    v_now TIMESTAMP WITH TIME ZONE := now();
BEGIN
    -- 1. Get current streak and last check-in
    SELECT last_check_in, check_in_streak INTO v_last_check_in, v_streak
    FROM public.profiles
    WHERE user_id = p_user_id
    FOR UPDATE;

    -- 2. Check if already checked in today (using date truncation for Ghana time/UTC)
    IF v_last_check_in IS NOT NULL AND v_last_check_in::date = v_now::date THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already checked in today. Come back tomorrow!');
    END IF;

    -- 3. Update streak
    -- If last check-in was yesterday, increment streak. Otherwise, reset to 1.
    IF v_last_check_in IS NOT NULL AND v_last_check_in::date = (v_now - INTERVAL '1 day')::date THEN
        v_streak := v_streak + 1;
    ELSE
        v_streak := 1;
    END IF;

    -- 4. Calculate points (5 points base, +5 for each day of streak, max 50)
    v_points_to_award := LEAST(5 + (v_streak - 1) * 5, 50);

    -- 5. Update profile
    UPDATE public.profiles
    SET 
        last_check_in = v_now,
        check_in_streak = v_streak
    WHERE user_id = p_user_id;

    -- 6. Award points to wallet
    UPDATE public.wallets
    SET loyalty_balance = loyalty_balance + v_points_to_award
    WHERE agent_id = p_user_id;

    RETURN jsonb_build_object(
        'success', true, 
        'streak', v_streak, 
        'points_awarded', v_points_to_award,
        'next_check_in', (v_now::date + INTERVAL '1 day')::timestamp with time zone
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.claim_daily_check_in(UUID) TO authenticated;
