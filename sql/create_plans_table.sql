-- Create an enum type for plan types
CREATE TYPE plan_type AS ENUM ('individual', 'team', 'paygo');

-- Create the plans table
CREATE TABLE public.plans (
    id TEXT PRIMARY KEY,  -- e.g., 'starter-individual'
    name TEXT NOT NULL,   -- e.g., 'Individual Starter'
    price INTEGER NOT NULL, -- Price in ZAR
    usage_limit INTEGER NOT NULL,
    description TEXT NOT NULL,
    extra_usage TEXT,
    is_team_plan BOOLEAN NOT NULL DEFAULT false,
    is_paygo BOOLEAN NOT NULL DEFAULT false,
    max_team_size INTEGER,  -- NULL for individual plans
    popular BOOLEAN DEFAULT false,
    features JSONB NOT NULL, -- Store features as a JSON array
    price_per_screening TEXT, -- Cost breakdown for pay-as-you-go plans
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add RLS policy for read-only access
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to all authenticated users"
    ON public.plans
    FOR SELECT
    TO authenticated
    USING (true);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_plans_updated_at
    BEFORE UPDATE ON plans
    FOR EACH ROW
    EXECUTE FUNCTION update_plans_updated_at();
