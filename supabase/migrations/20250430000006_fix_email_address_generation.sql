-- Modify the email address generation trigger to only create addresses for complete profiles
CREATE OR REPLACE FUNCTION set_agent_email_address()
RETURNS TRIGGER AS $$
DECLARE
    user_first_name TEXT;
    user_role TEXT;
BEGIN
    -- For individual users
    IF NEW.user_id IS NOT NULL THEN
        -- Get user's first name and role
        SELECT first_name, role INTO user_first_name, user_role
        FROM users WHERE id = NEW.user_id;

        -- Only generate email for complete profiles (non-empty first name and non-pending role)
        IF user_first_name IS NOT NULL AND user_first_name != '' AND user_role != 'pending' THEN
            NEW.email_address := generate_agent_email_address(user_first_name, NEW.user_id);
        ELSE
            -- Raise an error if trying to create email for incomplete profile
            RAISE EXCEPTION 'Cannot create email address for user with incomplete profile (first_name: %, role: %)', 
                user_first_name, user_role;
        END IF;

    -- For teams
    ELSIF NEW.team_id IS NOT NULL THEN
        -- Get team admin's company name
        SELECT company_name INTO user_first_name
        FROM users u
        JOIN team_members tm ON u.id = tm.user_id
        WHERE tm.team_id = NEW.team_id AND tm.role = 'admin'
        LIMIT 1;

        -- Only generate email if company name exists
        IF user_first_name IS NOT NULL AND user_first_name != '' THEN
            NEW.email_address := generate_team_email_address(user_first_name, NEW.team_id);
        ELSE
            -- Raise an error if trying to create email for team without company name
            RAISE EXCEPTION 'Cannot create email address for team without company name';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically create email address when profile is completed
CREATE OR REPLACE FUNCTION handle_profile_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if this is an update and the role is changing from 'pending'
    IF TG_OP = 'UPDATE' AND OLD.role = 'pending' AND NEW.role != 'pending' THEN
        -- Check if user already has an email address
        IF NOT EXISTS (
            SELECT 1 FROM email_addresses 
            WHERE user_id = NEW.id AND is_active = true
        ) THEN
            -- Create new email address
            INSERT INTO email_addresses (user_id, is_primary)
            VALUES (NEW.id, true);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for profile completion
DROP TRIGGER IF EXISTS on_profile_completion ON public.users;
CREATE TRIGGER on_profile_completion
    AFTER UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_profile_completion();

-- Add comments explaining the changes
COMMENT ON FUNCTION set_agent_email_address IS 'Generates email addresses only for users with complete profiles (non-empty first name and non-pending role)';
COMMENT ON FUNCTION handle_profile_completion IS 'Automatically creates email address when a user completes their profile by updating their role from pending'; 