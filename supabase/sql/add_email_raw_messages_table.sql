-- Migration: Add email_raw_messages table
-- Description: Creates a table to store raw email content for future processing
-- Dependencies: email_messages table must exist

-- Create table for storing raw email messages
CREATE TABLE IF NOT EXISTS email_raw_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES email_messages(message_id) ON DELETE CASCADE,
    raw_content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_raw_messages_message_id ON email_raw_messages(message_id);

-- Enable RLS
ALTER TABLE email_raw_messages ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for team-based access
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

-- Add updated_at trigger
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON email_raw_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment to table
COMMENT ON TABLE email_raw_messages IS 'Stores raw email content for future processing and analysis';
COMMENT ON COLUMN email_raw_messages.message_id IS 'References the message_id from email_messages table';
COMMENT ON COLUMN email_raw_messages.raw_content IS 'The complete raw email content including headers and body'; 