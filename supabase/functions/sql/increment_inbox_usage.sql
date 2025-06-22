create or replace function increment_inbox_usage(
  user_id uuid default null,
  team_id uuid default null,
  check_only boolean default false
)
returns jsonb
language plpgsql
as $$
declare
  sub record;
  usage_limit integer;
  current_usage integer;
  remaining integer;
  is_team boolean := false;
begin
  -- Find the active subscription for the user or team
  if team_id is not null then
    select * into sub from subscriptions
      where team_id = team_id and status = 'active'
      order by created_at desc limit 1;
    is_team := true;
  elsif user_id is not null then
    select * into sub from subscriptions
      where user_id = user_id and status = 'active'
      order by created_at desc limit 1;
    is_team := false;
  else
    return jsonb_build_object('success', false, 'message', 'No user or team specified');
  end if;

  if sub is null then
    return jsonb_build_object('success', false, 'message', 'No active subscription found');
  end if;

  usage_limit := coalesce(sub.inbox_limit, 0);
  current_usage := coalesce(sub.inbox_usage, 0);
  remaining := usage_limit - current_usage;

  if usage_limit = 0 then
    return jsonb_build_object(
      'success', false,
      'message', 'No inbox limit set for this subscription',
      'usage_limit', usage_limit,
      'current_usage', current_usage,
      'remaining', remaining,
      'is_team', is_team
    );
  end if;

  if current_usage >= usage_limit then
    return jsonb_build_object(
      'success', false,
      'message', 'Inbox limit reached',
      'usage_limit', usage_limit,
      'current_usage', current_usage,
      'remaining', 0,
      'limit_reached', true,
      'is_team', is_team
    );
  end if;

  -- Only increment if not check_only
  if not check_only then
    update subscriptions
      set inbox_usage = inbox_usage + 1
      where id = sub.id;
    current_usage := current_usage + 1;
    remaining := usage_limit - current_usage;
  end if;

  return jsonb_build_object(
    'success', true,
    'usage_limit', usage_limit,
    'current_usage', current_usage,
    'remaining', remaining,
    'limit_reached', false,
    'is_team', is_team
  );
end;
$$;