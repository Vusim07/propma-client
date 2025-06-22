-- Drop the old function with user_id parameter
DROP FUNCTION IF EXISTS increment_inbox_usage(uuid, uuid, boolean);

-- Recreate the function with p_user_id and p_team_id parameters
CREATE OR REPLACE FUNCTION increment_inbox_usage(
  p_user_id uuid DEFAULT NULL,
  p_team_id uuid DEFAULT NULL,
  check_only boolean DEFAULT FALSE
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  sub record;
  usage_limit integer;
  current_usage integer;
  remaining integer;
  is_team boolean := false;
BEGIN
  -- Find the active subscription for the user or team
  IF p_team_id IS NOT NULL THEN
    SELECT * INTO sub FROM subscriptions
      WHERE team_id = p_team_id AND status = 'active'
      ORDER BY created_at DESC LIMIT 1;
    is_team := true;
  ELSIF p_user_id IS NOT NULL THEN
    SELECT * INTO sub FROM subscriptions
      WHERE user_id = p_user_id AND status = 'active'
      ORDER BY created_at DESC LIMIT 1;
    is_team := false;
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'No user or team specified');
  END IF;

  IF sub IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No active subscription found');
  END IF;

  usage_limit := coalesce(sub.inbox_limit, 0);
  current_usage := coalesce(sub.inbox_usage, 0);
  remaining := usage_limit - current_usage;

  IF usage_limit = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No inbox limit set for this subscription',
      'usage_limit', usage_limit,
      'current_usage', current_usage,
      'remaining', remaining,
      'is_team', is_team
    );
  END IF;

  IF current_usage >= usage_limit THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Inbox limit reached',
      'usage_limit', usage_limit,
      'current_usage', current_usage,
      'remaining', 0,
      'limit_reached', true,
      'is_team', is_team
    );
  END IF;

  -- Only increment if not check_only
  IF NOT check_only THEN
    UPDATE subscriptions
      SET inbox_usage = inbox_usage + 1
      WHERE id = sub.id;
    current_usage := current_usage + 1;
    remaining := usage_limit - current_usage;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'usage_limit', usage_limit,
    'current_usage', current_usage,
    'remaining', remaining,
    'limit_reached', false,
    'is_team', is_team
  );
END;
$$;
