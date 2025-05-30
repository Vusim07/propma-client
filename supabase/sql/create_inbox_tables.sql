-- Create enum for email status
CREATE TYPE email_status AS ENUM (
    'received',
    'sent',
    'draft',
    'archived',
    'deleted',
    'bounced',
    'failed'
);

-- Create enum for email priority
CREATE TYPE email_priority AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);

-- Function to generate agent email address
CREATE OR REPLACE FUNCTION generate_agent_email_address(
    p_first_name TEXT,
    p_user_id UUID
) RETURNS TEXT AS $$
BEGIN
    -- Sanitize first name: lowercase and remove spaces
    RETURN LOWER(REGEXP_REPLACE(p_first_name, '\s+', '', 'g')) || '-' || p_user_id || '@n.agentamara.com';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to generate team email address
CREATE OR REPLACE FUNCTION generate_team_email_address(
    p_company_name TEXT,
    p_team_id UUID
) RETURNS TEXT AS $$
BEGIN
    -- Sanitize company name: lowercase, remove spaces and special characters
    RETURN LOWER(REGEXP_REPLACE(p_company_name, '[^a-zA-Z0-9]', '', 'g')) 
           || '-' || p_team_id || '@n.agentamara.com';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create table for email addresses (for both individual users and teams)
CREATE TABLE email_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    email_address TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Ensure either user_id or team_id is set, but not both
    CONSTRAINT email_address_owner CHECK (
        (user_id IS NOT NULL AND team_id IS NULL) OR
        (user_id IS NULL AND team_id IS NOT NULL)
    ),
    -- Ensure email format matches our pattern
    CONSTRAINT email_address_format CHECK (
        (user_id IS NOT NULL AND email_address ~ '^[a-z]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@n\.agentamara\.com$') OR
        (team_id IS NOT NULL AND email_address ~ '^[a-z0-9]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@n\.agentamara\.com$')
    ),
    -- Ensure unique email addresses
    UNIQUE(email_address)
);

-- Trigger function to set email address
CREATE OR REPLACE FUNCTION set_agent_email_address()
RETURNS TRIGGER AS $$
BEGIN
    -- For individual users
    IF NEW.user_id IS NOT NULL THEN
        NEW.email_address := generate_agent_email_address(
            (SELECT first_name FROM users WHERE id = NEW.user_id),
            NEW.user_id
        );
    -- For teams
    ELSIF NEW.team_id IS NOT NULL THEN
        NEW.email_address := generate_team_email_address(
            (SELECT company_name FROM users WHERE id = (SELECT user_id FROM team_members WHERE team_id = NEW.team_id AND role = 'admin' LIMIT 1)),
            NEW.team_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for email address generation
CREATE TRIGGER set_agent_email_address_trigger
    BEFORE INSERT ON email_addresses
    FOR EACH ROW
    EXECUTE FUNCTION set_agent_email_address();

-- Create table for email threads
CREATE TABLE email_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    status email_status DEFAULT 'received',
    priority email_priority DEFAULT 'normal',
    needs_follow_up BOOLEAN DEFAULT false,
    lead_source TEXT,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES tenant_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Ensure either user_id or team_id is set, but not both
    CONSTRAINT email_thread_owner CHECK (
        (user_id IS NOT NULL AND team_id IS NULL) OR
        (user_id IS NULL AND team_id IS NOT NULL)
    )
);

-- Create table for email messages
CREATE TABLE email_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID REFERENCES email_threads(id) ON DELETE CASCADE,
    message_id TEXT UNIQUE, -- For tracking external message IDs
    from_address TEXT NOT NULL,
    from_name TEXT,
    to_address TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    body_html TEXT,
    status TEXT CHECK (status IN ('new', 'replied')) DEFAULT 'unread',
    is_read BOOLEAN DEFAULT false,
    has_attachments BOOLEAN DEFAULT false,
    in_reply_to TEXT, -- References parent message_id
    sent_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create table for email attachments
CREATE TABLE email_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES email_messages(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create table for AI suggestions
CREATE TABLE email_ai_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES email_messages(id) ON DELETE CASCADE,
    suggestion_type TEXT NOT NULL, -- e.g., 'follow_up', 'response', 'classification'
    content TEXT NOT NULL,
    confidence_score FLOAT,
    is_applied BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create table for email bounces and errors
CREATE TABLE email_delivery_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES email_messages(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- e.g., 'bounce', 'delivery', 'complaint'
    recipient TEXT NOT NULL,
    status TEXT NOT NULL,
    error_message TEXT,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create table for storing raw email messages
CREATE TABLE IF NOT EXISTS email_raw_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES email_messages(message_id) ON DELETE CASCADE,
    raw_content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_email_threads_team_id ON email_threads(team_id);
CREATE INDEX idx_email_threads_status ON email_threads(status);
CREATE INDEX idx_email_threads_needs_follow_up ON email_threads(needs_follow_up);
CREATE INDEX idx_email_messages_thread_id ON email_messages(thread_id);
CREATE INDEX idx_email_messages_status ON email_messages(status);
CREATE INDEX idx_email_messages_is_read ON email_messages(is_read);
CREATE INDEX idx_email_messages_sent_at ON email_messages(sent_at);
CREATE INDEX idx_email_messages_received_at ON email_messages(received_at);
CREATE INDEX IF NOT EXISTS idx_email_raw_messages_message_id ON email_raw_messages(message_id);

-- Add RLS policies
ALTER TABLE email_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_raw_messages ENABLE ROW LEVEL SECURITY;

-- Email addresses policies
CREATE POLICY "Users can view their own email addresses"
    ON email_addresses FOR SELECT
    USING (
        user_id = auth.uid() OR
        (team_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = email_addresses.team_id
            AND team_members.user_id = auth.uid()
        ))
    );

CREATE POLICY "Users can insert their own email addresses"
    ON email_addresses FOR INSERT
    WITH CHECK (
        user_id = auth.uid() OR
        (team_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = email_addresses.team_id
            AND team_members.user_id = auth.uid()
            AND team_members.role = 'admin'
        ))
    );

CREATE POLICY "Users can update their own email addresses"
    ON email_addresses FOR UPDATE
    USING (
        user_id = auth.uid() OR
        (team_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = email_addresses.team_id
            AND team_members.user_id = auth.uid()
            AND team_members.role = 'admin'
        ))
    );

-- Email threads policies
CREATE POLICY "Users can view their own email threads"
    ON email_threads FOR SELECT
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = email_threads.team_id
            AND team_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own email threads"
    ON email_threads FOR INSERT
    WITH CHECK (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = email_threads.team_id
            AND team_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own email threads"
    ON email_threads FOR UPDATE
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.team_id = email_threads.team_id
            AND team_members.user_id = auth.uid()
        )
    );

-- Email messages policies
CREATE POLICY "Users can view their own email messages"
    ON email_messages FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM email_threads
        JOIN team_members ON team_members.team_id = email_threads.team_id
        WHERE email_threads.id = email_messages.thread_id
        AND team_members.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert their own email messages"
    ON email_messages FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM email_threads
        JOIN team_members ON team_members.team_id = email_threads.team_id
        WHERE email_threads.id = email_messages.thread_id
        AND team_members.user_id = auth.uid()
    ));

CREATE POLICY "Users can update their own email messages"
    ON email_messages FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM email_threads
        JOIN team_members ON team_members.team_id = email_threads.team_id
        WHERE email_threads.id = email_messages.thread_id
        AND team_members.user_id = auth.uid()
    ));

-- Similar policies for attachments, AI suggestions, and delivery logs
-- (Following the same pattern of team-based access control)

-- Add updated_at triggers
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON email_addresses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON email_threads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON email_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON email_ai_suggestions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies for email_raw_messages
CREATE POLICY "Team members can view their team's raw messages"
    ON email_raw_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM email_messages em
            JOIN email_threads et ON em.thread_id = et.id
            WHERE em.message_id = email_raw_messages.message_id
            AND et.team_id IN (
                SELECT team_id FROM team_members
                WHERE user_id = auth.uid()
            )
        )
    ); 