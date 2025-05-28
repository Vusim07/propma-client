CREATE OR REPLACE FUNCTION increment_screening_usage(agent_id UUID)
RETURNS JSON AS $$
DECLARE
    subscription_record RECORD;
    new_usage INTEGER;
BEGIN
    -- Get the active subscription record for the agent
    SELECT s.*, 
           (SELECT count(*) FROM screening_reports 
            WHERE agent_id = agent_id 
              AND created_at >= date_trunc('month', current_timestamp)
           ) AS usage_count
    INTO subscription_record
    FROM subscriptions s
    WHERE s.user_id = agent_id AND s.status = 'active'
    ORDER BY s.created_at DESC
    LIMIT 1;

    IF subscription_record IS NULL THEN
        RETURN json_build_object('success', FALSE, 'message', 'No active subscription found');
    END IF;

    new_usage := subscription_record.usage_count;

    -- Update subscription with new aggregated usage
    UPDATE subscriptions
    SET current_usage = new_usage
    WHERE id = subscription_record.id;

    RETURN json_build_object(
        'success', TRUE,
        'message', 'Usage updated successfully',
        'current_usage', new_usage,
        'usage_limit', subscription_record.usage_limit,
        'remaining', subscription_record.usage_limit - new_usage,
        'is_team', subscription_record.is_team
    );
END;
$$ LANGUAGE plpgsql;