-- First, drop the existing constraint
ALTER TABLE email_addresses DROP CONSTRAINT IF EXISTS email_address_format;

-- Add the new constraint with the updated domain
ALTER TABLE email_addresses ADD CONSTRAINT email_address_format CHECK (
    (user_id IS NOT NULL AND email_address ~ '^[a-z]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@mail\.agentamara\.com$') OR
    (team_id IS NOT NULL AND email_address ~ '^[a-z0-9]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@mail\.agentamara\.com$')
);

-- Update any existing email addresses that might not match the new format
UPDATE email_addresses
SET email_address = REGEXP_REPLACE(
    email_address,
    '@n\.agentamara\.com$',
    '@mail.agentamara.com'
)
WHERE email_address LIKE '%@n.agentamara.com'; 