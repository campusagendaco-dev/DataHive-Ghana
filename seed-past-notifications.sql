-- Seed retroactive notifications from last 14 days with cross-reference to ensure user accounts exist
INSERT INTO public.user_notifications (user_id, title, message, type, link, created_at, read)
SELECT 
  o.agent_id as user_id,
  CASE 
     WHEN o.status = 'fulfilled' AND o.order_type = 'wallet_topup' THEN '💰 Wallet Credited'
     WHEN o.status = 'fulfilled' THEN '✅ Order Delivered'
     WHEN o.status = 'fulfillment_failed' AND o.order_type = 'wallet_topup' THEN '❌ Wallet Top-up Failed'
     ELSE '❌ Order Failed'
  END as title,
  CASE
     WHEN o.status = 'fulfilled' AND o.order_type = 'wallet_topup' THEN 'Successfully credited GHS ' || COALESCE(o.amount::text, '0.00') || ' to your wallet via direct top-up.'
     WHEN o.status = 'fulfilled' THEN 'Success! ' || COALESCE(o.package_size, 'Order') || ' (' || UPPER(COALESCE(o.network, 'DATA')) || ') has been successfully delivered to ' || COALESCE(o.customer_phone, 'client') || '.'
     WHEN o.status = 'fulfillment_failed' AND o.order_type = 'wallet_topup' THEN 'Alert: Your wallet top-up of GHS ' || COALESCE(o.amount::text, '0.00') || ' failed to process.'
     ELSE 'Alert: The order for ' || COALESCE(o.customer_phone, 'your package') || ' failed to deliver. Your funds have been automatically restored to your wallet.'
  END as message,
  CASE 
     WHEN o.status = 'fulfilled' THEN 'success'
     ELSE 'error'
  END as type,
  '/dashboard/transactions' as link,
  o.created_at as created_at,
  true as read
FROM public.orders o
JOIN auth.users u ON o.agent_id = u.id  -- ONLY valid real users
WHERE o.status IN ('fulfilled', 'fulfillment_failed')
AND o.agent_id != '00000000-0000-0000-0000-000000000000'
AND o.created_at >= NOW() - INTERVAL '14 days'
ORDER BY o.created_at DESC
LIMIT 500;
