-- Add AI-related columns to email_messages table
ALTER TABLE email_messages
ADD COLUMN IF NOT EXISTS ai_confidence double precision,
ADD COLUMN IF NOT EXISTS ai_response_type text,
ADD COLUMN IF NOT EXISTS ai_processed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS ai_metadata jsonb DEFAULT '{}'::jsonb;

-- Create index for AI-related queries
CREATE INDEX IF NOT EXISTS idx_email_messages_ai_processed 
ON email_messages(ai_processed_at);

-- Add comment to explain the columns
COMMENT ON COLUMN email_messages.ai_confidence IS 'Confidence score from AI processing (0-1)';
COMMENT ON COLUMN email_messages.ai_response_type IS 'Type of AI response (e.g., availability_check, viewing_request)';
COMMENT ON COLUMN email_messages.ai_processed_at IS 'Timestamp when AI processing was completed';
COMMENT ON COLUMN email_messages.ai_metadata IS 'Additional AI processing metadata and results';

-- Create a view for AI-processed messages
CREATE OR REPLACE VIEW ai_processed_messages AS
SELECT 
    m.*,
    t.subject as thread_subject,
    t.status as thread_status
FROM email_messages m
JOIN email_threads t ON m.thread_id = t.id
WHERE m.ai_processed_at IS NOT NULL;
