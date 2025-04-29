-- Teams Schema Implementation
-- Description: Implements multi-tenancy support with teams, team members, and team invitations

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create teams table
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    subscription_id UUID REFERENCES subscriptions(id),
    plan_type TEXT CHECK (plan_type IN ('starter', 'growth', 'scale', 'enterprise')),
    max_members INT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, team_id)
);

-- 3. Create team_invitations table
CREATE TABLE IF NOT EXISTS team_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    role TEXT CHECK (role IN ('admin', 'member')) DEFAULT 'member',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    status TEXT CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')) DEFAULT 'pending'
);

-- 4. Add team-related columns to existing tables
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS active_team_id UUID REFERENCES teams(id),
ADD COLUMN IF NOT EXISTS is_individual BOOLEAN DEFAULT true;

ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);

ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);

ALTER TABLE screening_reports 
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);

ALTER TABLE email_workflows 
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);

ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id),
ADD COLUMN IF NOT EXISTS plan_type TEXT CHECK (plan_type IN ('starter', 'growth', 'scale', 'enterprise')),
ADD COLUMN IF NOT EXISTS is_team BOOLEAN DEFAULT false;

-- 5. Add updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. Create updated_at triggers for teams
CREATE TRIGGER update_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_team_id ON team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_properties_team_id ON properties(team_id);
CREATE INDEX IF NOT EXISTS idx_applications_team_id ON applications(team_id);
CREATE INDEX IF NOT EXISTS idx_screening_reports_team_id ON screening_reports(team_id);
CREATE INDEX IF NOT EXISTS idx_documents_team_id ON documents(team_id);