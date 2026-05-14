-- Migration: Add RPC for Loyalty Points Redemption via AI
-- This function atomically deducts points and adds wallet balance
CREATE OR REPLACE FUNCTION public.redeem_loyalty_points_to_wallet(
    user_id UUID,
    points_amount INTEGER,
    credit_amount NUMERIC
) RETURNS VOID AS $$
BEGIN
    -- 1. Deduct points
    UPDATE public.profiles 
    SET loyalty_points = loyalty_points - points_amount
    WHERE id = user_id AND loyalty_points >= points_amount;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient points';
    END IF;

    -- 2. Add wallet balance
    UPDATE public.profiles 
    SET wallet_balance = wallet_balance + credit_amount
    WHERE id = user_id;

    -- 3. Log transaction
    INSERT INTO public.transactions (user_id, amount, type, status, description)
    VALUES (user_id, credit_amount, 'deposit', 'completed', 'Loyalty points redemption via Ama AI');

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
