-- 1. BLACKLIST TABLE
CREATE TABLE IF NOT EXISTS public.security_blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('ip', 'domain')),
    value TEXT NOT NULL UNIQUE,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- 2. PURGE TEST ACCOUNTS FUNCTION
CREATE OR REPLACE FUNCTION public.purge_test_accounts()
RETURNS JSONB AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Delete from profiles first (cascading deletes should handle other tables if configured, 
    -- but usually wallets/orders are linked)
    
    -- We'll delete orders, wallets, and profiles for these test accounts
    DELETE FROM public.orders WHERE agent_id IN (
        SELECT user_id FROM public.profiles 
        WHERE email LIKE 'apitest%' 
           OR email LIKE '%@example.com'
           OR email LIKE '%@swiftdata.gh'
    );

    DELETE FROM public.wallets WHERE agent_id IN (
        SELECT user_id FROM public.profiles 
        WHERE email LIKE 'apitest%' 
           OR email LIKE '%@example.com'
           OR email LIKE '%@swiftdata.gh'
    );

    DELETE FROM public.profiles 
    WHERE email LIKE 'apitest%' 
       OR email LIKE '%@example.com'
       OR email LIKE '%@swiftdata.gh';

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN jsonb_build_object('success', true, 'deleted_count', v_deleted_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. BULK SUSPEND FUNCTION
CREATE OR REPLACE FUNCTION public.bulk_suspend_users(p_user_ids UUID[], p_suspend BOOLEAN)
RETURNS JSONB AS $$
BEGIN
    UPDATE public.profiles 
    SET is_suspended = p_suspend 
    WHERE user_id = ANY(p_user_ids);

    RETURN jsonb_build_object('success', true, 'updated_count', array_length(p_user_ids, 1));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. PERMISSIONS
GRANT ALL ON public.security_blacklist TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_test_accounts() TO service_role;
GRANT EXECUTE ON FUNCTION public.bulk_suspend_users(UUID[], BOOLEAN) TO service_role;
