-- SPIN THE WHEEL SYSTEM

-- 1. Add tracking column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_spin_at TIMESTAMP WITH TIME ZONE;

-- 2. Create the spin RPC
CREATE OR REPLACE FUNCTION public.spin_the_wheel(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_last_spin TIMESTAMP WITH TIME ZONE;
    v_points_to_award INTEGER;
    v_now TIMESTAMP WITH TIME ZONE := now();
    v_random FLOAT;
BEGIN
    -- 1. Check last spin
    SELECT last_spin_at INTO v_last_spin
    FROM public.profiles
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_last_spin IS NOT NULL AND v_last_spin::date = v_now::date THEN
        RETURN jsonb_build_object('success', false, 'error', 'You have already spun the wheel today! Come back tomorrow.');
    END IF;

    -- 2. Random prize logic
    v_random := random();
    
    IF v_random < 0.05 THEN -- 5% chance
        v_points_to_award := 100; -- Jackpot
    ELSIF v_random < 0.15 THEN -- 10% chance
        v_points_to_award := 50;
    ELSIF v_random < 0.40 THEN -- 25% chance
        v_points_to_award := 20;
    ELSIF v_random < 0.70 THEN -- 30% chance
        v_points_to_award := 10;
    ELSE -- 30% chance
        v_points_to_award := 5;
    END IF;

    -- 3. Update profile
    UPDATE public.profiles
    SET last_spin_at = v_now
    WHERE user_id = p_user_id;

    -- 4. Award points
    UPDATE public.wallets
    SET loyalty_balance = loyalty_balance + v_points_to_award
    WHERE agent_id = p_user_id;

    RETURN jsonb_build_object(
        'success', true, 
        'points_awarded', v_points_to_award,
        'random_seed', v_random
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.spin_the_wheel(UUID) TO authenticated;
