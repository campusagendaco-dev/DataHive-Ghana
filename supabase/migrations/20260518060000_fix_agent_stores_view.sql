-- 20260518060000_fix_agent_stores_view.sql
-- Expands the public.agent_stores joined view to expose agent prices, disabled packages, full_name, and approval statuses

DROP VIEW IF EXISTS public.agent_stores CASCADE;

CREATE VIEW public.agent_stores WITH (security_invoker = true) AS
SELECT 
  s.id AS store_id,
  s.user_id,
  s.store_name,
  s.slug,
  p.full_name,
  p.momo_number,
  p.momo_network,
  p.momo_account_name,
  s.store_logo_url,
  s.store_primary_color,
  p.whatsapp_number,
  p.support_number,
  p.whatsapp_group_link,
  p.email,
  s.custom_domain,
  s.domain_verified,
  s.store_banner_url,
  s.store_description,
  p.agent_prices,
  p.sub_agent_prices,
  p.disabled_packages,
  p.is_agent,
  p.is_sub_agent,
  p.agent_approved,
  p.sub_agent_approved,
  p.parent_agent_id,
  p.sub_agent_activation_markup,
  s.created_at,
  s.updated_at
FROM public.reseller_stores s
LEFT JOIN public.profiles p ON s.user_id = p.user_id;

GRANT SELECT ON public.agent_stores TO anon, authenticated;
