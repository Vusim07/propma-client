-- Create calendar integrations table
CREATE TABLE calendar_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) NOT NULL,
  provider TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  token_expiry TIMESTAMP WITH TIME ZONE,
  calendar_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add RLS policies
ALTER TABLE calendar_integrations ENABLE ROW LEVEL SECURITY;

-- Only the owner can view their calendar integration
CREATE POLICY "Users can view own calendar integrations" 
ON calendar_integrations FOR SELECT 
USING (auth.uid() = user_id);

-- Only the owner can delete their calendar integration
CREATE POLICY "Users can delete own calendar integrations" 
ON calendar_integrations FOR DELETE 
USING (auth.uid() = user_id);

-- Add calendar_event_id to appointments table
ALTER TABLE appointments 
ADD COLUMN calendar_event_id TEXT; 