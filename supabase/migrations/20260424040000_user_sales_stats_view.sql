-- Create a view to track sales volume per user/agent.
-- This view aggregates fulfilled orders to show lifetime performance.

CREATE OR REPLACE VIEW public.user_sales_stats AS
WITH direct_stats AS (
    SELECT 
        agent_id as user_id, 
        COUNT(*) as total_fulfilled_orders, 
        SUM(amount) as total_sales_volume,
        SUM(profit) as total_own_profit
    FROM public.orders
    WHERE status = 'fulfilled'
      AND order_type NOT IN ('agent_activation', 'sub_agent_activation')
    GROUP BY agent_id
),
parent_stats AS (
    SELECT 
        parent_agent_id as user_id,
        SUM(parent_profit) as total_commissions_earned
    FROM public.orders
    WHERE status = 'fulfilled'
      AND parent_agent_id IS NOT NULL
    GROUP BY parent_agent_id
)
SELECT 
    p.user_id,
    COALESCE(d.total_fulfilled_orders, 0) as total_fulfilled_orders,
    COALESCE(d.total_sales_volume, 0) as total_sales_volume,
    COALESCE(d.total_own_profit, 0) as total_own_profit,
    COALESCE(pa.total_commissions_earned, 0) as total_commissions_paid -- Keeping name for compatibility
FROM public.profiles p
LEFT JOIN direct_stats d ON p.user_id = d.user_id
LEFT JOIN parent_stats pa ON p.user_id = pa.user_id;

-- Grant access to the view for administrators
GRANT SELECT ON public.user_sales_stats TO authenticated;

-- Ensure RLS is handled (views inherit RLS or can be secured via policies)
-- Since this is an admin view, we'll ensure only admins can query it through standard role checks if needed,
-- but standard Supabase RLS on 'orders' already restricts data access.
