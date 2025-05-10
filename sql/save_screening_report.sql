-- Step 1: Fix the increment_screening_usage function
DROP FUNCTION IF EXISTS public.increment_screening_usage(uuid);

CREATE OR REPLACE FUNCTION public.increment_screening_usage(p_agent_id uuid)
RETURNS void AS $$
DECLARE
    v_subscription_id uuid;
BEGIN
    -- Get the active subscription for this agent
    SELECT s.id INTO v_subscription_id
    FROM subscriptions s
    WHERE s.user_id = p_agent_id AND s.status = 'active'
    ORDER BY s.created_at DESC
    LIMIT 1;
    
    IF v_subscription_id IS NOT NULL THEN
        -- Update usage count using explicit parameter reference
        UPDATE subscriptions
        SET 
            current_usage = (
                SELECT count(*) 
                FROM screening_reports
                WHERE agent_id = p_agent_id
                AND created_at >= date_trunc('month', current_timestamp)
            ),
            updated_at = now()
        WHERE id = v_subscription_id;
        
        RAISE NOTICE 'Updated usage count for subscription: %', v_subscription_id;
    ELSE
        RAISE NOTICE 'No active subscription found for agent_id: %', p_agent_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 2: The trigger function is already correct, but here it is for completeness
CREATE OR REPLACE FUNCTION trg_incr_usage_from_screening_report()
RETURNS trigger AS $$
BEGIN
    PERFORM increment_screening_usage(NEW.agent_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Recreate the trigger (optional if it already exists and works)
DROP TRIGGER IF EXISTS trg_after_ins_screening_reports ON screening_reports;
CREATE TRIGGER trg_after_ins_screening_reports
AFTER INSERT ON screening_reports
FOR EACH ROW
EXECUTE FUNCTION trg_incr_usage_from_screening_report();