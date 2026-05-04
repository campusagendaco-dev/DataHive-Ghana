-- ── Leaderboard v2: add month_orders, week_sales_amount, streak ───────────────
DROP FUNCTION IF EXISTS get_agent_leaderboard();
CREATE OR REPLACE FUNCTION get_agent_leaderboard()
RETURNS TABLE (
    rank_position       BIGINT,
    agent_name          TEXT,
    day_orders          BIGINT,
    week_orders         BIGINT,
    month_orders        BIGINT,
    week_sales_amount   NUMERIC,
    streak              INT,
    is_current_user     BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH period_data AS (
        SELECT
            o.agent_id,
            COUNT(o.id) FILTER (
                WHERE o.created_at >= date_trunc('day', timezone('UTC', now()))
            )                                                              AS day_count,
            COUNT(o.id) FILTER (
                WHERE o.created_at >= date_trunc('week', timezone('UTC', now()))
            )                                                              AS week_count,
            COUNT(o.id) FILTER (
                WHERE o.created_at >= date_trunc('month', timezone('UTC', now()))
            )                                                              AS month_count,
            COALESCE(SUM(o.amount) FILTER (
                WHERE o.order_type IN ('data','api','airtime','utility')
                  AND o.created_at >= date_trunc('week', timezone('UTC', now()))
            ), 0)                                                          AS week_sales
        FROM orders o
        WHERE o.agent_id IS NOT NULL
          AND o.status = 'fulfilled'
        GROUP BY o.agent_id
    ),
    -- Streak: consecutive UTC days with ≥1 fulfilled order ending today or yesterday
    agent_days AS (
        SELECT
            agent_id,
            DATE(created_at AT TIME ZONE 'UTC') AS order_date
        FROM orders
        WHERE status = 'fulfilled'
          AND agent_id IS NOT NULL
          AND created_at >= NOW() - INTERVAL '90 days'
        GROUP BY agent_id, DATE(created_at AT TIME ZONE 'UTC')
    ),
    consecutive AS (
        SELECT
            agent_id,
            order_date,
            order_date - (ROW_NUMBER() OVER (
                PARTITION BY agent_id ORDER BY order_date ASC
            ))::int AS grp
        FROM agent_days
    ),
    streak_groups AS (
        SELECT
            agent_id, grp,
            COUNT(*)::int            AS streak_len,
            MAX(order_date)          AS last_day
        FROM consecutive
        GROUP BY agent_id, grp
    ),
    current_streaks AS (
        SELECT DISTINCT ON (agent_id)
            agent_id,
            streak_len AS streak
        FROM streak_groups
        WHERE last_day >= (now() AT TIME ZONE 'UTC')::date - 1
        ORDER BY agent_id, last_day DESC
    ),
    ranked AS (
        SELECT
            pd.agent_id,
            pd.day_count,
            pd.week_count,
            pd.month_count,
            pd.week_sales,
            COALESCE(cs.streak, 0)::int                              AS streak,
            RANK() OVER (ORDER BY pd.day_count DESC, pd.week_count DESC) AS rnk
        FROM period_data pd
        LEFT JOIN current_streaks cs ON cs.agent_id = pd.agent_id
        WHERE pd.day_count > 0 OR pd.week_count > 0
    )
    SELECT
        r.rnk,
        CASE
            WHEN r.agent_id = auth.uid() THEN p.full_name
            ELSE SUBSTRING(p.full_name FROM 1 FOR 3) || '***'
        END AS agent_name,
        r.day_count,
        r.week_count,
        r.month_count,
        r.week_sales,
        r.streak,
        (r.agent_id = auth.uid()) AS is_current_user
    FROM ranked r
    JOIN profiles p ON r.agent_id = p.user_id
    ORDER BY r.rnk ASC
    LIMIT 50;
END;
$$;

-- ── All-time Hall of Fame ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_alltime_leaderboard()
RETURNS TABLE (
    rank_position  BIGINT,
    agent_name     TEXT,
    total_orders   BIGINT,
    total_amount   NUMERIC,
    is_current_user BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH alltime AS (
        SELECT
            o.agent_id,
            COUNT(o.id)                                                    AS total_orders,
            COALESCE(SUM(o.amount) FILTER (
                WHERE o.order_type IN ('data','api','airtime','utility')
            ), 0)                                                          AS total_amount
        FROM orders o
        WHERE o.agent_id IS NOT NULL
          AND o.status = 'fulfilled'
        GROUP BY o.agent_id
    ),
    ranked AS (
        SELECT
            agent_id, total_orders, total_amount,
            RANK() OVER (ORDER BY total_orders DESC) AS rnk
        FROM alltime
    )
    SELECT
        r.rnk,
        CASE
            WHEN r.agent_id = auth.uid() THEN p.full_name
            ELSE SUBSTRING(p.full_name FROM 1 FOR 3) || '***'
        END AS agent_name,
        r.total_orders,
        r.total_amount,
        (r.agent_id = auth.uid()) AS is_current_user
    FROM ranked r
    JOIN profiles p ON r.agent_id = p.user_id
    ORDER BY r.rnk ASC
    LIMIT 100;
END;
$$;

GRANT EXECUTE ON FUNCTION get_agent_leaderboard()   TO authenticated;
GRANT EXECUTE ON FUNCTION get_alltime_leaderboard() TO authenticated;
