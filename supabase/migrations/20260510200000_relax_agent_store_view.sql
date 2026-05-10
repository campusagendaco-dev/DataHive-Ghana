-- RELAX AGENT STORE VIEW RESTRICTIONS
-- Updates the public agent_stores view to permit viewing of store profiles before formal admin approval.
-- This guarantees new agents can preview their active store URL immediately after setup.

CREATE OR REPLACE VIEW public.agent_stores AS
SELECT 
    user_id,
    full_name,
    store_name,
    whatsapp_number,
    support_number,
    whatsapp_group_link,
    agent_prices,
    sub_agent_prices,
    disabled_packages,
    is_agent,
    is_sub_agent,
    agent_approved,
    sub_agent_approved,
    parent_agent_id,
    sub_agent_activation_markup,
    store_logo_url,
    store_primary_color,
    slug,
    email
FROM public.profiles
WHERE (is_agent = true OR is_sub_agent = true)
  AND onboarding_complete = true;

-- Ensure select rights are propagated globally
GRANT SELECT ON public.agent_stores TO anon, authenticated;
