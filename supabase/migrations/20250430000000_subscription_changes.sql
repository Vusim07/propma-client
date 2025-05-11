-- Create subscription changes table to track plan upgrades/downgrades
CREATE TABLE IF NOT EXISTS public.subscription_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID REFERENCES public.subscriptions(id),
    previous_plan_name TEXT NOT NULL,
    new_plan_name TEXT NOT NULL,
    prorated_amount DECIMAL(10,2) NOT NULL,
    unused_credits INT NOT NULL,
    credit_value DECIMAL(10,2) NOT NULL,
    final_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id),
    team_id UUID REFERENCES public.teams(id)
);

-- Enable RLS on the subscription_changes table
ALTER TABLE public.subscription_changes ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscription changes
CREATE POLICY "Users view own subscription changes" ON public.subscription_changes
FOR SELECT USING (
    auth.uid() = user_id OR 
    team_id IN (
        SELECT team_id FROM public.team_members 
        WHERE user_id = auth.uid()
    )
);

-- Add indexes for better query performance
CREATE INDEX idx_subscription_changes_subscription_id ON public.subscription_changes(subscription_id);
CREATE INDEX idx_subscription_changes_team_id ON public.subscription_changes(team_id);

-- Create trigger to automatically record subscription changes
CREATE OR REPLACE FUNCTION public.handle_subscription_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.plan_name != NEW.plan_name THEN
        INSERT INTO public.subscription_changes (
            subscription_id,
            previous_plan_name,
            new_plan_name,
            prorated_amount,
            unused_credits,
            credit_value,
            final_amount,
            user_id,
            team_id
        ) VALUES (
            NEW.id,
            OLD.plan_name,
            NEW.plan_name,
            NEW.plan_price,
            (OLD.usage_limit - OLD.current_usage),
            (OLD.usage_limit - OLD.current_usage) * (OLD.plan_price / OLD.usage_limit),
            NEW.plan_price,
            NEW.user_id,
            NEW.team_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscription_change_trigger
    AFTER UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_subscription_change();

-- Add comment describing the table's purpose
COMMENT ON TABLE public.subscription_changes IS 'Tracks the history of subscription plan changes including proration calculations';