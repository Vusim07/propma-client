-- Function to check if a team has reached its member limit
CREATE OR REPLACE FUNCTION check_team_member_limit(p_team_id uuid)
RETURNS boolean AS $$
DECLARE
    max_members integer;
    current_members integer;
    pending_invites integer;
BEGIN
    -- Get team's max_members
    SELECT t.max_members INTO max_members
    FROM teams t
    WHERE t.id = p_team_id;

    -- Get current member count
    SELECT COUNT(*) INTO current_members
    FROM team_members
    WHERE team_id = p_team_id;

    -- Get pending invitations count
    SELECT COUNT(*) INTO pending_invites
    FROM team_invitations
    WHERE team_id = p_team_id
    AND status = 'pending';

    -- Return true if there's still room for more members
    RETURN (current_members + pending_invites) < max_members;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on team_invitations if not already enabled
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- Policy to prevent creating invitations if team is at member limit
CREATE POLICY "enforce_team_member_limit_on_invite" ON team_invitations
FOR INSERT TO authenticated
WITH CHECK (
    check_team_member_limit(team_id)
    AND EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = team_invitations.team_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'admin'
    )
);

-- Policy to prevent adding members if team is at limit
CREATE POLICY "enforce_team_member_limit_on_join" ON team_members
FOR INSERT TO authenticated
WITH CHECK (
    check_team_member_limit(team_id)
);

-- Function to check if a team has an active subscription
CREATE OR REPLACE FUNCTION check_team_subscription(p_team_id uuid)
RETURNS boolean AS $$
DECLARE
    has_active_sub boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM teams t
        JOIN subscriptions s ON t.subscription_id = s.id
        WHERE t.id = p_team_id
        AND s.status = 'active'
    ) INTO has_active_sub;
    
    RETURN has_active_sub;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policy to prevent team actions without active subscription
CREATE POLICY "require_active_subscription_for_invite" ON team_invitations
FOR INSERT TO authenticated
WITH CHECK (
    check_team_subscription(team_id)
);

-- Trigger to update team member count in team_stats
CREATE TABLE IF NOT EXISTS team_stats (
    team_id uuid PRIMARY KEY REFERENCES teams(id),
    member_count integer DEFAULT 0,
    pending_invites integer DEFAULT 0,
    last_updated timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_team_stats()
RETURNS trigger AS $$
BEGIN
    -- Update stats when members change
    IF TG_TABLE_NAME = 'team_members' THEN
        INSERT INTO team_stats (team_id, member_count)
        VALUES (
            COALESCE(NEW.team_id, OLD.team_id),
            (
                SELECT COUNT(*)
                FROM team_members
                WHERE team_id = COALESCE(NEW.team_id, OLD.team_id)
            )
        )
        ON CONFLICT (team_id) DO UPDATE
        SET 
            member_count = (
                SELECT COUNT(*)
                FROM team_members
                WHERE team_id = COALESCE(NEW.team_id, OLD.team_id)
            ),
            last_updated = now();
    END IF;

    -- Update stats when invitations change
    IF TG_TABLE_NAME = 'team_invitations' THEN
        INSERT INTO team_stats (team_id, pending_invites)
        VALUES (
            COALESCE(NEW.team_id, OLD.team_id),
            (
                SELECT COUNT(*)
                FROM team_invitations
                WHERE team_id = COALESCE(NEW.team_id, OLD.team_id)
                AND status = 'pending'
            )
        )
        ON CONFLICT (team_id) DO UPDATE
        SET 
            pending_invites = (
                SELECT COUNT(*)
                FROM team_invitations
                WHERE team_id = COALESCE(NEW.team_id, OLD.team_id)
                AND status = 'pending'
            ),
            last_updated = now();
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for member stats
CREATE TRIGGER update_team_member_stats
    AFTER INSERT OR DELETE OR UPDATE ON team_members
    FOR EACH ROW
    EXECUTE FUNCTION update_team_stats();

CREATE TRIGGER update_team_invitation_stats
    AFTER INSERT OR DELETE OR UPDATE ON team_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_team_stats();

-- Grant access to team_stats
GRANT SELECT ON team_stats TO authenticated;
CREATE POLICY "users_view_own_team_stats" ON team_stats
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = team_stats.team_id
            AND team_members.user_id = auth.uid()
        )
    );