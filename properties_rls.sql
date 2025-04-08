-- Enable RLS on properties table
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Create a stored function to safely check if a property exists for a token
CREATE OR REPLACE FUNCTION get_property_by_token(token_param TEXT)
RETURNS SETOF properties
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM properties 
  WHERE application_link ILIKE CONCAT('%', token_param, '%')
  LIMIT 1;
$$;

-- First drop existing policies if needed
DO $$
BEGIN
    DROP POLICY IF EXISTS "Anyone can view properties with application links" ON properties;
    
    -- Create a policy that allows anyone to view properties
    -- This is necessary for the application process
    CREATE POLICY "Anyone can view properties with application links"
    ON properties
    FOR SELECT
    TO authenticated
    USING (true);
END $$;

-- Agent access to properties
DO $$
BEGIN
    DROP POLICY IF EXISTS "Agents can manage their properties" ON properties;
    
    -- Create a policy for agents managing their properties
    CREATE POLICY "Agents can manage their properties"
    ON properties
    FOR ALL
    TO authenticated
    USING (
        -- User is an agent or landlord
        (SELECT role FROM users WHERE id = auth.uid()) IN ('agent', 'landlord') 
        AND
        -- The agent owns the property
        agent_id = auth.uid()
    )
    WITH CHECK (
        -- User is an agent or landlord
        (SELECT role FROM users WHERE id = auth.uid()) IN ('agent', 'landlord') 
        AND
        -- The agent owns the property
        agent_id = auth.uid()
    );
END $$;

-- Service roles have full access
DO $$
BEGIN
    DROP POLICY IF EXISTS "Service roles have full access to properties" ON properties;
    
    -- Create a policy for service roles
    CREATE POLICY "Service roles have full access to properties"
    ON properties
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
END $$; 