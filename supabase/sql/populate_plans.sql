-- Amara Platform Plans: Free, Basic, Growth, Professional, and Credit Bundles
-- This script overrides all previous plans. Run this to reset the plans table.

-- Remove all existing plans
TRUNCATE public.plans RESTART IDENTITY CASCADE;

-- Free Plan
INSERT INTO public.plans (
    id, name, price, usage_limit, inbox_limit, includes_credit_check, description, extra_usage, is_team_plan, is_paygo, max_team_size, popular, features
) VALUES (
    'free',
    'Free',
    0,
    20,
    50,
    false,
    'Get started with basic screenings and automated inbox responses per month.',
    NULL,
    false,
    false,
    NULL,
    false,
    '["50 Inbox replies", "20 Screening/affordability usage"]'::jsonb
);

-- Basic Plan
INSERT INTO public.plans (
    id, name, price, usage_limit, inbox_limit, includes_credit_check, description, extra_usage, is_team_plan, is_paygo, max_team_size, popular, features
) VALUES (
    'basic',
    'Basic',
    499,
    250,
    500,
    false,
    'Includes 250 screenings and 500 inbox responses per month for solo agents.',
    NULL,
    false,
    false,
    NULL,
    false,
    '["500 Inbox usage", "250 Screening/affordability usage"]'::jsonb
);

-- Growth Plan
INSERT INTO public.plans (
    id, name, price, usage_limit, inbox_limit, includes_credit_check, description, extra_usage, is_team_plan, is_paygo, max_team_size, popular, features
) VALUES (
    'growth',
    'Growth',
    1499,
    500,
    2000,
    false,
    'For small teams',
    NULL,
    true,
    false,
    3,
    true,
    '["2000 Inbox Replies", "500 Screening/affordability usage", "Up to 3 team members", "Priority support"]'::jsonb
);

-- Professional Plan
INSERT INTO public.plans (
    id, name, price, usage_limit, inbox_limit, includes_credit_check, description, extra_usage, is_team_plan, is_paygo, max_team_size, popular, features
) VALUES (
    'professional',
    'Professional',
    5999,
    2000,
    5000,
    false,
    'For agencies and larger teams',
    NULL,
    true,
    false,
    15,
    false,
    '["2000 Inbox Replies", "5000 Screening/affordability usage", "Up to 15 team members", "Account Manager", "Priority support", "Custom branding", "API access"]'::jsonb
);

-- Credit Bundles (Pay-as-you-go Add-ons)
INSERT INTO public.plans (
    id, name, price, usage_limit, inbox_limit, includes_credit_check, description, extra_usage, is_team_plan, is_paygo, max_team_size, popular, features, price_per_screening
) VALUES
    ('bundle-10', '10 Screening Credits', 590, 10, 0, true, 'Buy 10 extra screening/credit report credits. Credits never expire.', NULL, false, true, NULL, false, '["Extra screening/credit report credits"]'::jsonb, 'R59'),
    ('bundle-25', '25 Screening Credits', 1400, 25, 0, true, 'Buy 25 extra screening/credit report credits. Credits never expire.', NULL, false, true, NULL, false, '["Extra screening/credit report credits"]'::jsonb, 'R56'),
    ('bundle-50', '50 Screening Credits', 2700, 50, 0, true, 'Buy 50 extra screening/credit report credits. Credits never expire.', NULL, false, true, NULL, false, '["Extra screening/credit report credits"]'::jsonb, 'R54');

-- Notes:
-- All base plans have includes_credit_check = false. Bundles have includes_credit_check = true.
-- The UI should communicate: "Credit checks available as add-ons. Purchase a bundle to enable credit checks for your account."
-- Usage is enforced by available credits, not just the plan flag.
