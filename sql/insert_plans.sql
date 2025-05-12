-- Insert Individual Plans
INSERT INTO public.plans (id, name, price, usage_limit, description, extra_usage, is_team_plan, features, popular)
VALUES 
    ('starter-individual', 'Individual Starter', 500, 20, '20 screening credits included', 'R65 per additional screening', false, 
    '["R25 effective cost per screening", "Advanced tenant verification", "Document automation", "Smart scheduling system", "Email & chat support"]',
    false),
    
    ('growth-individual', 'Individual Growth', 950, 40, '40 screening credits included', 'R65 per additional screening', false,
    '["R23.75 effective cost per screening", "Everything in Starter, plus:", "Priority tenant verification", "Analytics dashboard", "API integration with listing sites", "Priority support"]',
    true);

-- Insert Team Plans
INSERT INTO public.plans (id, name, price, usage_limit, description, extra_usage, is_team_plan, max_team_size, features, popular)
VALUES 
    ('starter-team', 'Team Starter', 1500, 60, '60 screening credits included', 'R65 per additional screening', true, 3,
    '["R25 effective cost per screening", "Up to 3 team members", "Team dashboard & analytics", "Shared document library", "Team workflow automation", "Priority support"]',
    false),
    
    ('growth-team', 'Team Growth', 2850, 120, '120 screening credits included', 'R65 per additional screening', true, 10,
    '["R23.75 effective cost per screening", "Up to 10 team members", "Everything in Team Starter, plus:", "Advanced team analytics", "Custom workflow templates", "API integrations", "Premium support"]',
    true),
    
    ('enterprise-team', 'Team Enterprise', 5700, 240, '240 screening credits included', 'Volume discounts available', true, 25,
    '["Volume-based discounts", "Up to 25 team members", "Everything in Team Growth, plus:", "Dedicated account manager", "Custom API integrations", "Advanced team analytics", "Custom reporting", "24/7 premium support"]',
    false);
