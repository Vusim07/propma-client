-- Create production email addresses for existing users and teams
-- This script assumes users and teams already exist in the database

-- First, create email addresses for individual users
INSERT INTO email_addresses (
    user_id,
    team_id,
    email_address,
    is_active,
    is_primary,
    created_at,
    updated_at
)
SELECT 
    u.id as user_id,
    NULL as team_id,
    -- Generate email address using sanitized first name and user_id
    -- Use COALESCE to ensure we always have a valid email address
    COALESCE(
        LOWER(REGEXP_REPLACE(u.first_name, '[^a-zA-Z0-9]', '', 'g')) || '-' || u.id || '@n.agentamara.com',
        'user-' || u.id || '@n.agentamara.com'  -- Fallback if first_name is empty or only special characters
    ) as email_address,
    true as is_active,
    true as is_primary,
    NOW() as created_at,
    NOW() as updated_at
FROM users u
WHERE u.role = 'agent'
AND u.role != 'pending'  -- Skip users with pending role
AND u.first_name IS NOT NULL  -- Ensure first_name exists
AND u.first_name != ''  -- Ensure first_name is not empty
AND NOT EXISTS (
    SELECT 1 FROM email_addresses ea 
    WHERE ea.user_id = u.id
);

-- Then create email addresses for teams
INSERT INTO email_addresses (
    user_id,
    team_id,
    email_address,
    is_active,
    is_primary,
    created_at,
    updated_at
)
SELECT 
    NULL as user_id,
    t.id as team_id,
    -- Generate email address using sanitized team name and team_id
    -- Use COALESCE to ensure we always have a valid email address
    COALESCE(
        LOWER(REGEXP_REPLACE(t.name, '[^a-zA-Z0-9]', '', 'g')) || '-' || t.id || '@n.agentamara.com',
        'team-' || t.id || '@n.agentamara.com'  -- Fallback if team name is empty or only special characters
    ) as email_address,
    true as is_active,
    true as is_primary,
    NOW() as created_at,
    NOW() as updated_at
FROM teams t
WHERE EXISTS (  -- Only create team email if team has an admin with company name
    SELECT 1 FROM users u
    JOIN team_members tm ON u.id = tm.user_id
    WHERE tm.team_id = t.id 
    AND tm.role = 'admin'
    AND u.company_name IS NOT NULL
    AND u.company_name != ''
)
AND NOT EXISTS (
    SELECT 1 FROM email_addresses ea 
    WHERE ea.team_id = t.id
);

-- Create a function to get a test email address for a user or team
CREATE OR REPLACE FUNCTION get_test_email_address(
    p_user_id UUID DEFAULT NULL,
    p_team_id UUID DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
    v_email TEXT;
    v_user_role TEXT;
    v_user_first_name TEXT;
    v_team_has_admin BOOLEAN;
BEGIN
    IF p_user_id IS NOT NULL THEN
        -- Get user's role and first name
        SELECT role, first_name INTO v_user_role, v_user_first_name
        FROM users
        WHERE id = p_user_id;

        -- Only return email if user has complete profile
        IF v_user_role != 'pending' AND v_user_first_name IS NOT NULL AND v_user_first_name != '' THEN
            SELECT email_address INTO v_email
            FROM email_addresses
            WHERE user_id = p_user_id
            AND is_active = true
            LIMIT 1;
        END IF;
    ELSIF p_team_id IS NOT NULL THEN
        -- Check if team has an admin with company name
        SELECT EXISTS (
            SELECT 1 FROM users u
            JOIN team_members tm ON u.id = tm.user_id
            WHERE tm.team_id = p_team_id 
            AND tm.role = 'admin'
            AND u.company_name IS NOT NULL
            AND u.company_name != ''
        ) INTO v_team_has_admin;

        -- Only return email if team has valid admin
        IF v_team_has_admin THEN
            SELECT email_address INTO v_email
            FROM email_addresses
            WHERE team_id = p_team_id
            AND is_active = true
            LIMIT 1;
        END IF;
    END IF;
    
    RETURN v_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments explaining the changes
COMMENT ON FUNCTION get_test_email_address IS 'Returns email address only for users with complete profiles (non-pending role and non-empty first name) or teams with valid admin'; 