-- Modify the user notification function to handle missing settings and empty names
CREATE OR REPLACE FUNCTION public.handle_user_notification()
RETURNS TRIGGER AS $$
DECLARE
    functions_url text;
    service_key text;
BEGIN
    -- Skip notification for initial user creation (empty names)
    IF NEW.first_name = '' AND NEW.last_name = '' THEN
        RETURN NEW;
    END IF;

    -- Get the required settings
    BEGIN
        functions_url := current_setting('app.settings.supabase_functions_url');
        service_key := current_setting('app.settings.service_role_key');
    EXCEPTION WHEN OTHERS THEN
        -- Log the error but don't fail the transaction
        RAISE WARNING 'Missing required settings for Slack notification: %', SQLERRM;
        RETURN NEW;
    END;

    -- Only proceed if we have both required settings
    IF functions_url IS NOT NULL AND service_key IS NOT NULL THEN
        -- Call the Slack notification function
        PERFORM
            net.http_post(
                url := CONCAT(functions_url, '/slack-notifications'),
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', CONCAT('Bearer ', service_key)
                ),
                body := jsonb_build_object(
                    'type', CASE 
                        WHEN TG_OP = 'INSERT' THEN 'user_created'
                        WHEN TG_OP = 'UPDATE' THEN 'user_updated'
                    END,
                    'first_name', NEW.first_name,
                    'last_name', NEW.last_name,
                    'email', NEW.email,
                    'company_name', NEW.company_name,
                    'role', NEW.role,
                    'phone', NEW.phone
                )
            );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the changes
COMMENT ON FUNCTION public.handle_user_notification IS 'Sends Slack notifications when users are created or updated, but only for complete user records with non-empty names'; 