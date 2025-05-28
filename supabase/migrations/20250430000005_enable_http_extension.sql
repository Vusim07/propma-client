-- Enable the pg_net extension for making HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant usage to authenticated users
GRANT USAGE ON SCHEMA net TO authenticated;
GRANT USAGE ON SCHEMA net TO service_role;

-- Grant execute permission on the http functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO service_role;

-- Update the notification functions to use the correct schema
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

    -- Get the required settings from app_settings table
    SELECT value INTO functions_url FROM app_settings WHERE key = 'supabase_functions_url';
    SELECT value INTO service_key FROM app_settings WHERE key = 'service_role_key';

    -- Only proceed if we have both required settings
    IF functions_url IS NOT NULL AND service_key IS NOT NULL THEN
        -- Call the Slack notification function using the correct schema
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
    ELSE
        -- Log warning if settings are missing
        RAISE WARNING 'Missing required settings for Slack notification. Please check app_settings table.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the subscription notification function to use the correct schema
CREATE OR REPLACE FUNCTION public.handle_subscription_notification()
RETURNS TRIGGER AS $$
DECLARE
    functions_url text;
    service_key text;
BEGIN
    -- Only send notification for new subscriptions
    IF TG_OP = 'INSERT' THEN
        -- Get the required settings from app_settings table
        SELECT value INTO functions_url FROM app_settings WHERE key = 'supabase_functions_url';
        SELECT value INTO service_key FROM app_settings WHERE key = 'service_role_key';

        -- Only proceed if we have both required settings
        IF functions_url IS NOT NULL AND service_key IS NOT NULL THEN
            -- Call the Slack notification function using the correct schema
            PERFORM
                net.http_post(
                    url := CONCAT(functions_url, '/slack-notifications'),
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', CONCAT('Bearer ', service_key)
                    ),
                    body := jsonb_build_object(
                        'type', 'subscription_created',
                        'id', NEW.id,
                        'user_id', NEW.user_id,
                        'plan_name', NEW.plan_name,
                        'plan_price', NEW.plan_price,
                        'team_id', NEW.team_id,
                        'plan_type', NEW.plan_type,
                        'is_team', NEW.is_team,
                        'usage_limit', NEW.usage_limit,
                        'current_usage', NEW.current_usage,
                        'status', NEW.status,
                        'paystack_subscription_id', NEW.paystack_subscription_id,
                        'start_date', NEW.start_date,
                        'end_date', NEW.end_date
                    )
                );
        ELSE
            -- Log warning if settings are missing
            RAISE WARNING 'Missing required settings for Slack notification. Please check app_settings table.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments explaining the changes
COMMENT ON FUNCTION public.handle_user_notification IS 'Sends Slack notifications when users are created or updated, using settings from app_settings table and pg_net extension';
COMMENT ON FUNCTION public.handle_subscription_notification IS 'Sends Slack notifications when new subscriptions are created, using settings from app_settings table and pg_net extension'; 