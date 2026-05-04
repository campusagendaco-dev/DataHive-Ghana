-- Add customer_name column to orders for tracking verified guest names
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- Update the existing records where we might have saved it in metadata (if any)
-- (No current records would have this yet based on our analysis, but good practice)

-- Enable searching by customer_name in AdminOrders
CREATE INDEX IF NOT EXISTS idx_orders_customer_name ON public.orders(customer_name);
