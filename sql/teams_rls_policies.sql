-- Teams RLS Policies
-- Description: Row Level Security policies for teams, team members, and team invitations

-- First drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view teams they belong to" ON teams;
DROP POLICY IF EXISTS "Users can view team members" ON team_members;
DROP POLICY IF EXISTS "users_view_own_team_memberships" ON team_members;
DROP POLICY IF EXISTS "users_view_own_teams" ON teams;
DROP POLICY IF EXISTS "Users can view and manage their own team memberships" ON team_members;
DROP POLICY IF EXISTS "Admins can manage team members" ON team_members;
DROP POLICY IF EXISTS "team_admins_manage_members" ON team_members;
DROP POLICY IF EXISTS "Team admins manage invitations" ON team_invitations;
DROP POLICY IF EXISTS "Users view invitations for their email" ON team_invitations;
DROP POLICY IF EXISTS "users_view_own_invitations" ON team_invitations;
DROP POLICY IF EXISTS "admins_manage_invitations" ON team_invitations;
DROP POLICY IF EXISTS "Team members access team properties" ON properties;
DROP POLICY IF EXISTS "team_resource_access_properties" ON properties;
DROP POLICY IF EXISTS "Team members access team applications" ON applications;
DROP POLICY IF EXISTS "team_resource_access_applications" ON applications;
DROP POLICY IF EXISTS "Team members access team documents" ON documents;
DROP POLICY IF EXISTS "team_resource_access_documents" ON documents;
DROP POLICY IF EXISTS "Team members access team screening reports" ON screening_reports;
DROP POLICY IF EXISTS "team_resource_access_screening_reports" ON screening_reports;

-- Enable RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- Basic team member policies (no recursion)
CREATE POLICY "users_view_own_team_memberships" ON team_members 
FOR SELECT TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "users_view_own_teams" ON teams 
FOR SELECT TO authenticated 
USING (
    id IN (
        SELECT team_id FROM team_members 
        WHERE user_id = auth.uid()
    )
);

-- Add policy for team creation
CREATE POLICY "users_can_create_teams" ON teams 
FOR INSERT TO authenticated 
WITH CHECK (true);

-- Team admin policies (no recursion)
CREATE OR REPLACE FUNCTION is_team_admin(p_team_id uuid, p_user_id uuid)
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = p_team_id
        AND tm.user_id = p_user_id
        AND tm.role = 'admin'
    );
$$ LANGUAGE sql STABLE;

CREATE POLICY "team_admins_manage_members" ON team_members 
FOR ALL TO authenticated 
USING (
    is_team_admin(team_members.team_id, auth.uid())
);

-- Invitations
CREATE POLICY "admins_manage_invitations" ON team_invitations 
FOR ALL TO authenticated 
USING (
    is_team_admin(team_invitations.team_id, auth.uid())
);

CREATE POLICY "users_view_own_invitations" ON team_invitations 
FOR SELECT TO authenticated 
USING (
    email = (SELECT email FROM users WHERE id = auth.uid())
);

-- Resource policies
CREATE POLICY "team_resource_access_properties" ON properties 
FOR ALL TO authenticated 
USING (
    agent_id = auth.uid() OR
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);

CREATE POLICY "team_resource_access_applications" ON applications 
FOR ALL TO authenticated 
USING (
    agent_id = auth.uid() OR
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);

CREATE POLICY "team_resource_access_documents" ON documents 
FOR ALL TO authenticated 
USING (
    user_id = auth.uid() OR
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);

CREATE POLICY "team_resource_access_screening_reports" ON screening_reports 
FOR ALL TO authenticated 
USING (
    agent_id = auth.uid() OR
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);