CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    plan_name TEXT NOT NULL,
    plan_price INTEGER NOT NULL, -- Price in cents (ZAR)
    usage_limit INTEGER NOT NULL,
    current_usage INTEGER DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'cancelled')),
    paystack_subscription_id TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add an index for faster lookups by user_id
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions (user_id);
