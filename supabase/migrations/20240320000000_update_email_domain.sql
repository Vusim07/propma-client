-- Update existing email addresses to use the new domain
UPDATE email_addresses
SET email_address = REPLACE(email_address, '@n.agentamara.com', '@mail.agentamara.com')
WHERE email_address LIKE '%@n.agentamara.com';

-- Update the email generation functions to use the new domain
CREATE OR REPLACE FUNCTION generate_agent_email_address(
    p_first_name TEXT,
    p_user_id UUID
) RETURNS TEXT AS $$
BEGIN
    -- Sanitize first name: lowercase and remove spaces
    RETURN LOWER(REGEXP_REPLACE(p_first_name, '\s+', '', 'g')) || '-' || p_user_id || '@mail.agentamara.com';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update team email generation function
CREATE OR REPLACE FUNCTION generate_team_email_address(
    p_company_name TEXT,
    p_team_id UUID
) RETURNS TEXT AS $$
BEGIN
    -- Sanitize company name: lowercase, remove spaces and special characters
    RETURN LOWER(REGEXP_REPLACE(p_company_name, '[^a-zA-Z0-9]', '', 'g')) 
           || '-' || p_team_id || '@mail.agentamara.com';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update the email format constraint
ALTER TABLE email_addresses DROP CONSTRAINT IF EXISTS email_address_format;

ALTER TABLE email_addresses ADD CONSTRAINT email_address_format CHECK (
    (user_id IS NOT NULL AND email_address ~ '^[a-z]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@mail\.agentamara\.com$') OR
    (team_id IS NOT NULL AND email_address ~ '^[a-z0-9]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@mail\.agentamara\.com$')
);

-- Update the test email function
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