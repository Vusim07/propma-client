-- Create subscription_changes table
CREATE TABLE IF NOT EXISTS subscription_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID REFERENCES subscriptions(id),
    previous_plan_name TEXT NOT NULL,
    new_plan_name TEXT NOT NULL,
    prorated_amount DECIMAL(10,2) NOT NULL,
    unused_credits INT NOT NULL,
    credit_value DECIMAL(10,2) NOT NULL,
    final_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id),
    team_id UUID REFERENCES teams(id)
);

-- Add RLS policy for subscription changes
ALTER TABLE subscription_changes ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscription changes
CREATE POLICY "Users view own subscription changes"
ON subscription_changes FOR SELECT
USING (
    auth.uid() = user_id OR
    team_id IN (
        SELECT team_id FROM team_members 
        WHERE user_id = auth.uid()
    )
);

-- Create index for better query performance
CREATE INDEX idx_subscription_changes_subscription_id 
ON subscription_changes(subscription_id);

CREATE INDEX idx_subscription_changes_team_id 
ON subscription_changes(team_id);

-- Add subscription change trigger to track history
CREATE OR REPLACE FUNCTION handle_subscription_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.plan_name != NEW.plan_name THEN
        INSERT INTO subscription_changes (
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
    AFTER UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION handle_subscription_change();