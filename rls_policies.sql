-- Enable RLS on applications table
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (uncomment if you need to replace existing policies)
-- DROP POLICY IF EXISTS "Tenants can create their own applications" ON applications;
-- DROP POLICY IF EXISTS "Agents can view applications for their properties" ON applications;
-- DROP POLICY IF EXISTS "Agents can update applications for their properties" ON applications;
-- DROP POLICY IF EXISTS "Tenants can view their own applications" ON applications;
-- DROP POLICY IF EXISTS "Service roles have full access to applications" ON applications;

-- Create policies only if they don't exist

-- Check if policy exists before creating
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'applications' AND policyname = 'Tenants can create their own applications'
    ) THEN
        -- Allow tenants to create applications
        CREATE POLICY "Tenants can create their own applications"
        ON applications
        FOR INSERT
        TO authenticated
        WITH CHECK (
            -- Verify the user has 'tenant' role
            (SELECT role FROM users WHERE id = auth.uid()) = 'tenant'
        );
    END IF;
END $$;

-- Create an improved policy for tenants viewing their own applications
DO $$
BEGIN
    -- First drop the existing policy if it exists to replace it
    DROP POLICY IF EXISTS "Tenants can view their own applications" ON applications;
    
    -- Create a simplified policy that doesn't cause recursion
    CREATE POLICY "Tenants can view their own applications"
    ON applications
    FOR SELECT
    TO authenticated
    USING (
        -- Application belongs to the tenant's profile using a direct reference
        EXISTS (
            SELECT 1 FROM tenant_profiles 
            WHERE tenant_profiles.id = applications.tenant_id 
            AND tenant_profiles.tenant_id = auth.uid()
        )
    );
END $$;

-- Check if policy exists before creating
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'applications' AND policyname = 'Agents can view applications for their properties'
    ) THEN
        -- Allow agents to view applications for their properties
        CREATE POLICY "Agents can view applications for their properties"
        ON applications
        FOR SELECT
        TO authenticated
        USING (
            -- User is an agent or landlord
            (SELECT role FROM users WHERE id = auth.uid()) IN ('agent', 'landlord') 
            AND
            -- The agent is associated with the property
            (agent_id = auth.uid() OR property_id IN (
                SELECT id FROM properties WHERE agent_id = auth.uid()
            ))
        );
    END IF;
END $$;

-- Check if policy exists before creating
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'applications' AND policyname = 'Agents can update applications for their properties'
    ) THEN
        -- Allow agents to update applications for their properties
        CREATE POLICY "Agents can update applications for their properties"
        ON applications
        FOR UPDATE
        TO authenticated
        USING (
            -- User is an agent/landlord
            (SELECT role FROM users WHERE id = auth.uid()) IN ('agent', 'landlord')
            AND
            -- The agent is associated with the property
            (agent_id = auth.uid() OR property_id IN (
                SELECT id FROM properties WHERE agent_id = auth.uid()
            ))
        );
    END IF;
END $$;

-- Check if policy exists before creating
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'applications' AND policyname = 'Service roles have full access to applications'
    ) THEN
        -- Allow system-level operations (optional, for admin/service roles)
        CREATE POLICY "Service roles have full access to applications"
        ON applications
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;
END $$; 