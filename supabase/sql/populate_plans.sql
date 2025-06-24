-- Insert Individual Monthly Plans
INSERT INTO public.plans (
    id,
    name, 
    price,
    usage_limit,
    description,
    extra_usage,
    is_team_plan,
    is_paygo,
    features,
    popular
) VALUES 
(
    'free-plan',
    'Free Plan',
    0,
    25,
    50,
    false,
    'Free starter plan for new agents. Limited usage, upgrade for more features.',
    NULL,
    false,
    false,
    NULL,
    false,
    '["Basic tenant screening", "Limited support", "Upgrade anytime"]'::jsonb
);
    (
        'starter-individual',
        'Individual Starter',
        999,
        20,
        '20 screening credits included',
        'R59 per additional screening',
        false,
        false,
        '[
            "R49 effective cost per screening",
            "Calendar integration",
            "Advanced tenant verification",
            "Document automation",
            "Smart scheduling system",
            "Email & chat support"
        ]'::jsonb,
        false
    ),
    (
        'growth-individual',
        'Individual Growth',
        2499,
        50,
        '50 screening credits included',
        'R59 per additional screening',
        false,
        false,
        '[
            "R49 effective cost per screening",
            "Everything in Starter, plus:",
            "E-mail/Inbox integration",
            "Priority tenant verification",
            "Analytics dashboard",
            "API integration with listing sites",
            "Priority support"
        ]'::jsonb,
        true
    );

-- Insert Team Plans
INSERT INTO public.plans (
    id,
    name,
    price,
    usage_limit,
    description,
    extra_usage,
    is_team_plan,
    is_paygo,
    max_team_size,
    features,
    popular
) VALUES 
    (
        'starter-team',
        'Team Starter',
        2999,
        60,
        '60 screening credits included, up to 3 team members',
        'R59 per additional screening',
        true,
        false,
        3,
        '[
            "R49 effective cost per screening",
            "Everything in Individual Growth, plus:",
            "Team workspace",
            "Role management",
            "Activity tracking",
            "Shared screening history"
        ]'::jsonb,
        false
    ),
    (
        'growth-team',
        'Team Growth',
        5999,
        120,
        '120 screening credits included, up to 10 team members',
        'R59 per additional screening',
        true,
        false,
        10,
        '[
            "R49 effective cost per screening",
            "Everything in Team Starter, plus:",
            "Advanced team analytics",
            "Custom branding",
            "Dedicated account manager",
            "SLA support"
        ]'::jsonb,
        true
    );   

-- Insert Pay-as-you-go Plans
INSERT INTO public.plans (
    id,
    name,
    price,
    usage_limit,
    description,
    is_team_plan,
    is_paygo,
    features,
    popular,
    price_per_screening
) VALUES
    (
        'bundle-10',
        '10 Credit Bundle',
        590,
        10,
        'Most popular pay-as-you-go option',
        false,
        true,
        '[
            "Everything in Single Credit, plus:",
            "Priority tenant verification",
            "Better per-screening rate",
            "Credits never expire",
            "Priority support"
        ]'::jsonb,
        true,
        'R59 per screening'
    ),
    (
        'bundle-25',
        '25 Credit Bundle',
        1475,
        25,
        'Best value for high volume agencies',
        false,
        true,
        '[
            "Everything in 25 Credit Bundle",
            "Lowest per-screening rate",
            "Analytics dashboard",
            "Priority support"
        ]'::jsonb,
        false,
        'R59 per screening'
    ),
    (
        'bundle-50',
        '50 Credit Bundle',
        2950,
        50,
        'Best value for high volume agencies',
        false,
        true,
        '[
            "Everything in 50 Credit Bundle",
            "Lowest per-screening rate",
            "Analytics dashboard",
            "Priority support"
        ]'::jsonb,
        false,
        'R59 per screening'
    );
