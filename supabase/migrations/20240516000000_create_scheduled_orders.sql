CREATE TABLE IF NOT EXISTS public.scheduled_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY
);

ALTER TABLE public.scheduled_orders
    ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(15),
    ADD COLUMN IF NOT EXISTS network VARCHAR(50),
    ADD COLUMN IF NOT EXISTS package_size VARCHAR(50),
    ADD COLUMN IF NOT EXISTS frequency VARCHAR(20) CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- RLS Policies
ALTER TABLE public.scheduled_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scheduled orders"
    ON public.scheduled_orders FOR SELECT
    USING (auth.uid() = agent_id);

CREATE POLICY "Users can insert their own scheduled orders"
    ON public.scheduled_orders FOR INSERT
    WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "Users can update their own scheduled orders"
    ON public.scheduled_orders FOR UPDATE
    USING (auth.uid() = agent_id);

CREATE POLICY "Users can delete their own scheduled orders"
    ON public.scheduled_orders FOR DELETE
    USING (auth.uid() = agent_id);
