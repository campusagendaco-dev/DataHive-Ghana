-- SECURITY HARDENING: Revoke public access from sensitive RPC functions.
-- By default, Postgres allows 'PUBLIC' to execute functions. 
-- We must explicitly revoke this and only grant to 'service_role'.

-- 1. credit_wallet
REVOKE EXECUTE ON FUNCTION public.credit_wallet(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_wallet(UUID, NUMERIC) TO service_role;

-- 2. debit_wallet
REVOKE EXECUTE ON FUNCTION public.debit_wallet(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debit_wallet(UUID, NUMERIC) TO service_role;

-- 3. request_withdrawal
REVOKE EXECUTE ON FUNCTION public.request_withdrawal(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(UUID, NUMERIC) TO service_role;

-- 4. increment_api_usage
REVOKE EXECUTE ON FUNCTION public.increment_api_usage(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_api_usage(UUID) TO service_role;

-- 5. handle_new_user (Trigger function, should only be used by system)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- 6. generate_topup_reference (Trigger function)
REVOKE EXECUTE ON FUNCTION public.generate_topup_reference() FROM PUBLIC;
