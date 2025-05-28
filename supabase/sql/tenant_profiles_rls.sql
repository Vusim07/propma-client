-- Enable RLS on tenant_profiles table
ALTER TABLE tenant_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (uncomment if you need to replace existing policies)
-- DROP POLICY IF EXISTS "Tenants can access own profile" ON tenant_profiles;
-- DROP POLICY IF EXISTS "Tenants can create own profile" ON tenant_profiles;
-- DROP POLICY IF EXISTS "Tenants can update own profile" ON tenant_profiles;
-- DROP POLICY IF EXISTS "Agents can view tenant profiles" ON tenant_profiles;
-- DROP POLICY IF EXISTS "Service roles have full access to tenant_profiles" ON tenant_profiles;

-- Create policies that avoid recursion (only if they don't exist)

-- Check if policy exists before creating
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tenant_profiles' AND policyname = 'Tenants can access own profile'
    ) THEN
        -- Allow all authenticated users to see their own tenant profile
        -- This avoids recursion by using the tenant_id column which is a direct reference to users.id
        CREATE POLICY "Tenants can access own profile"
        ON tenant_profiles
        FOR SELECT
        TO authenticated
        USING (
            -- Direct reference to user ID without recursive query
            tenant_id = auth.uid()
        );
    END IF;
END $$;

-- Check if policy exists before creating
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tenant_profiles' AND policyname = 'Tenants can create own profile'
    ) THEN
        -- Allow tenants to create their own profile
        CREATE POLICY "Tenants can create own profile" 
        ON tenant_profiles
        FOR INSERT
        TO authenticated
        WITH CHECK (
            -- Only the user with matching ID can create their profile
            tenant_id = auth.uid() AND
            -- User must have tenant role
            (SELECT role FROM users WHERE id = auth.uid()) = 'tenant'
        );
    END IF;
END $$;

-- Check if policy exists before creating
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tenant_profiles' AND policyname = 'Tenants can update own profile'
    ) THEN
        -- Allow tenants to update their own profile
        CREATE POLICY "Tenants can update own profile"
        ON tenant_profiles
        FOR UPDATE
        TO authenticated
        USING (
            -- Only the user with matching ID can update their profile
            tenant_id = auth.uid() AND
            -- User must have tenant role
            (SELECT role FROM users WHERE id = auth.uid()) = 'tenant'
        );
    END IF;
END $$;

-- Check if policy exists before creating
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tenant_profiles' AND policyname = 'Agents can view tenant profiles'
    ) THEN
        -- Allow agents/landlords to view tenant profiles
        CREATE POLICY "Agents can view tenant profiles"
        ON tenant_profiles
        FOR SELECT
        TO authenticated
        USING (
            -- User must be an agent or landlord
            (SELECT role FROM users WHERE id = auth.uid()) IN ('agent', 'landlord')
        );
    END IF;
END $$;

-- Check if policy exists before creating
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tenant_profiles' AND policyname = 'Service roles have full access to tenant_profiles'
    ) THEN
        -- Allow system-level operations (for admin/service roles)
        CREATE POLICY "Service roles have full access to tenant_profiles"
        ON tenant_profiles
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;
END $$; 