
-- Function to get aggregated sales stats for the admin dashboard
CREATE OR REPLACE FUNCTION public.get_admin_sales_stats_v2(p_start_date TIMESTAMP WITH TIME ZONE)
RETURNS TABLE (
    bucket_date TEXT,
    customer_sales NUMERIC,
    agent_sales NUMERIC,
    sub_agent_sales NUMERIC,
    deposit_volume NUMERIC,
    order_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH date_series AS (
        SELECT generate_series(
            p_start_date::date, 
            CURRENT_DATE, 
            '1 day'::interval
        )::date as d
    ),
    order_buckets AS (
        SELECT 
            (o.created_at AT TIME ZONE 'UTC')::date as d,
            CASE 
                WHEN o.order_type IN ('data', 'airtime', 'utility', 'afa', 'api') THEN
                    CASE 
                        WHEN p.is_agent AND p.agent_approved AND NOT p.is_sub_agent THEN 'agent'
                        WHEN p.is_sub_agent AND p.sub_agent_approved THEN 'sub_agent'
                        ELSE 'customer'
                    END
                WHEN o.order_type IN ('wallet_topup', 'agent_activation', 'sub_agent_activation') THEN 'deposit'
                ELSE 'other'
            END as segment,
            COALESCE(o.paystack_verified_amount, o.amount) as amt
        FROM public.orders o
        LEFT JOIN public.profiles p ON o.agent_id = p.user_id
        WHERE o.status = 'fulfilled'
          AND o.created_at >= p_start_date
    )
    SELECT 
        ds.d::text as bucket_date,
        COALESCE(SUM(ob.amt) FILTER (WHERE ob.segment = 'customer'), 0) as customer_sales,
        COALESCE(SUM(ob.amt) FILTER (WHERE ob.segment = 'agent'), 0) as agent_sales,
        COALESCE(SUM(ob.amt) FILTER (WHERE ob.segment = 'sub_agent'), 0) as sub_agent_sales,
        COALESCE(SUM(ob.amt) FILTER (WHERE ob.segment = 'deposit'), 0) as deposit_volume,
        COUNT(ob.amt) FILTER (WHERE ob.segment != 'other') as order_count
    FROM date_series ds
    LEFT JOIN order_buckets ob ON ds.d = ob.d
    GROUP BY ds.d
    ORDER BY ds.d ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to authenticated users (admins will be checked via RLS or logic)
GRANT EXECUTE ON FUNCTION public.get_admin_sales_stats_v2 TO authenticated;
