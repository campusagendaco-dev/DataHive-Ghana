-- Aggressive manual approval for willlywilly8000
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Try to find in profiles first (case insensitive)
    SELECT user_id INTO target_user_id FROM public.profiles 
    WHERE email ILIKE '%willlywilly8000%' 
       OR full_name ILIKE '%Williams Awunyoh%' 
       OR email ILIKE '%willy%'
    LIMIT 1;
    
    -- If not found in profiles, try auth.users
    IF target_user_id IS NULL THEN
        SELECT id INTO target_user_id FROM auth.users WHERE email ILIKE '%willlywilly8000%' LIMIT 1;
    END IF;
    
    IF target_user_id IS NOT NULL THEN
        -- Promote to Agent
        UPDATE public.profiles
        SET 
            is_agent = true,
            agent_approved = true,
            sub_agent_approved = true,
            onboarding_complete = true,
            is_sub_agent = false,
            parent_agent_id = NULL
        WHERE user_id = target_user_id;

        -- Fulfill activation orders
        UPDATE public.orders
        SET status = 'fulfilled'
        WHERE agent_id = target_user_id
          AND order_type IN ('agent_activation', 'sub_agent_activation')
          AND status IN ('paid', 'pending', 'processing');
          
        RAISE NOTICE 'User % approved successfully', target_user_id;
    ELSE
        RAISE EXCEPTION 'User matching willlywilly8000 NOT FOUND anywhere';
    END IF;
END $$;
