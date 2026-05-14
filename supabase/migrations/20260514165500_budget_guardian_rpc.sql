-- Function to atomically increment sentinel cost and update logs
CREATE OR REPLACE FUNCTION public.increment_sentinel_cost(amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Update main settings
    UPDATE public.system_settings
    SET 
        sentinel_current_month_cost_usd = sentinel_current_month_cost_usd + amount,
        sentinel_low_power_mode = CASE 
            WHEN (sentinel_current_month_cost_usd + amount) >= (sentinel_monthly_budget_usd * sentinel_budget_alert_threshold) 
            THEN true 
            ELSE sentinel_low_power_mode 
        END
    WHERE id = 1;

    -- 2. Update daily log
    INSERT INTO public.sentinel_usage_logs (day, cost_usd, function_calls)
    VALUES (CURRENT_DATE, amount, 1)
    ON CONFLICT (day) DO UPDATE
    SET 
        cost_usd = public.sentinel_usage_logs.cost_usd + amount,
        function_calls = public.sentinel_usage_logs.function_calls + 1;
END;
$$;
