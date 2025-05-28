-- Create function to handle user notifications
CREATE OR REPLACE FUNCTION public.handle_user_notification()
RETURNS TRIGGER AS $$
BEGIN
    -- Call the Slack notification function
    PERFORM
        net.http_post(
            url := CONCAT(current_setting('app.settings.supabase_functions_url'), '/slack-notifications'),
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', CONCAT('Bearer ', current_setting('app.settings.service_role_key'))
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
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to handle subscription notifications
CREATE OR REPLACE FUNCTION public.handle_subscription_notification()
RETURNS TRIGGER AS $$
BEGIN
    -- Only send notification for new subscriptions
    IF TG_OP = 'INSERT' THEN
        -- Call the Slack notification function
        PERFORM
            net.http_post(
                url := CONCAT(current_setting('app.settings.supabase_functions_url'), '/slack-notifications'),
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', CONCAT('Bearer ', current_setting('app.settings.service_role_key'))
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
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for user notifications
DROP TRIGGER IF EXISTS on_user_notification ON public.users;
CREATE TRIGGER on_user_notification
    AFTER INSERT OR UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_notification();

-- Create trigger for subscription notifications
DROP TRIGGER IF EXISTS on_subscription_notification ON public.subscriptions;
CREATE TRIGGER on_subscription_notification
    AFTER INSERT ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_subscription_notification();

-- Add comments for documentation
COMMENT ON FUNCTION public.handle_user_notification IS 'Sends Slack notifications when users are created or updated';
COMMENT ON FUNCTION public.handle_subscription_notification IS 'Sends Slack notifications when new subscriptions are created'; 