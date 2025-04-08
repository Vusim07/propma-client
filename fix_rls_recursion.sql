-- This script fixes all RLS issues related to recursion
-- Run this in the Supabase SQL Editor

-- First, create helper functions to avoid RLS recursion

-- 1. Create tenant profile helper functions
CREATE OR REPLACE FUNCTION get_tenant_profile_for_user(user_id UUID)
RETURNS SETOF tenant_profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM tenant_profiles WHERE tenant_id = user_id;
$$;

-- Create tenant profile creation function
CREATE OR REPLACE FUNCTION create_tenant_profile(
  p_tenant_id UUID,
  p_first_name TEXT,
  p_last_name TEXT,
  p_email TEXT,
  p_phone TEXT DEFAULT NULL,
  p_current_address TEXT DEFAULT NULL,
  p_id_number TEXT DEFAULT NULL,
  p_employment_status TEXT DEFAULT 'employed',
  p_monthly_income NUMERIC DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_profile_id UUID;
BEGIN
  -- Check if a profile already exists
  SELECT id INTO new_profile_id FROM tenant_profiles WHERE tenant_id = p_tenant_id LIMIT 1;
  
  -- If a profile exists, just return its ID
  IF new_profile_id IS NOT NULL THEN
    RETURN new_profile_id;
  END IF;
  
  -- Otherwise create a new profile
  INSERT INTO tenant_profiles (
    tenant_id,
    first_name,
    last_name,
    email,
    phone,
    current_address,
    id_number,
    employment_status,
    monthly_income
  ) VALUES (
    p_tenant_id,
    p_first_name,
    p_last_name,
    p_email,
    p_phone,
    p_current_address,
    p_id_number,
    p_employment_status,
    p_monthly_income
  )
  RETURNING id INTO new_profile_id;
  
  RETURN new_profile_id;
END;
$$;

-- 2. Create property helper functions
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

-- 3. Create application helper functions
CREATE OR REPLACE FUNCTION get_tenant_applications_for_property(
  tenant_id_param UUID,
  property_id_param UUID
)
RETURNS SETOF applications
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM applications 
  WHERE tenant_id = tenant_id_param 
  AND property_id = property_id_param;
$$;

-- Now fix the RLS policies

-- 1. Fix tenant_profiles RLS policies
-- Enable RLS on tenant_profiles table
ALTER TABLE tenant_profiles ENABLE ROW LEVEL SECURITY;

-- Drop any problematic policies
DROP POLICY IF EXISTS "Tenants can access own profile" ON tenant_profiles;
DROP POLICY IF EXISTS "Tenants can create own profile" ON tenant_profiles;
DROP POLICY IF EXISTS "Tenants can update own profile" ON tenant_profiles;
DROP POLICY IF EXISTS "Agents can view tenant profiles" ON tenant_profiles;
DROP POLICY IF EXISTS "Service roles have full access to tenant_profiles" ON tenant_profiles;

-- Recreate policies without recursion
CREATE POLICY "Tenants can access own profile"
ON tenant_profiles
FOR SELECT
TO authenticated
USING (
    -- Direct reference to user ID without recursive query
    tenant_id = auth.uid()
);

-- Allow tenants to create their own profile
CREATE POLICY "Tenants can create own profile" 
ON tenant_profiles
FOR INSERT
TO authenticated
WITH CHECK (
    -- Only the user with matching ID can create their profile
    tenant_id = auth.uid()
);

-- Allow tenants to update their own profile
CREATE POLICY "Tenants can update own profile"
ON tenant_profiles
FOR UPDATE
TO authenticated
USING (
    -- Only the user with matching ID can update their profile
    tenant_id = auth.uid()
);

-- Allow agents/landlords to view tenant profiles
CREATE POLICY "Agents can view tenant profiles"
ON tenant_profiles
FOR SELECT
TO authenticated
USING (
    -- User must be an agent or landlord
    (SELECT role FROM users WHERE id = auth.uid()) IN ('agent', 'landlord')
);

-- Allow service roles full access
CREATE POLICY "Service roles have full access to tenant_profiles"
ON tenant_profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 2. Fix applications RLS policies
-- Enable RLS on applications table
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Drop any problematic policies
DROP POLICY IF EXISTS "Tenants can create their own applications" ON applications;
DROP POLICY IF EXISTS "Tenants can view their own applications" ON applications;
DROP POLICY IF EXISTS "Agents can view applications for their properties" ON applications;
DROP POLICY IF EXISTS "Agents can update applications for their properties" ON applications;
DROP POLICY IF EXISTS "Service roles have full access to applications" ON applications;

-- Recreate applications policies
-- Allow tenants to create applications
CREATE POLICY "Tenants can create their own applications"
ON applications
FOR INSERT
TO authenticated
WITH CHECK (
    -- Verify the user has 'tenant' role
    (SELECT role FROM users WHERE id = auth.uid()) = 'tenant'
);

-- Allow tenants to view their own applications without recursion
CREATE POLICY "Tenants can view their own applications"
ON applications
FOR SELECT
TO authenticated
USING (
    -- Direct join using a subquery that doesn't cause recursion
    (SELECT role FROM users WHERE id = auth.uid()) = 'tenant'
    AND
    EXISTS (
        SELECT 1 FROM tenant_profiles 
        WHERE tenant_profiles.id = applications.tenant_id 
        AND tenant_profiles.tenant_id = auth.uid()
    )
);

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

-- Allow system-level operations
CREATE POLICY "Service roles have full access to applications"
ON applications
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 3. Fix properties RLS policies
-- Enable RLS on properties table
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Drop any problematic policies
DROP POLICY IF EXISTS "Anyone can view properties with application links" ON properties;
DROP POLICY IF EXISTS "Agents can manage their properties" ON properties;
DROP POLICY IF EXISTS "Service roles have full access to properties" ON properties;

-- Create properties policies
-- Allow anyone to view properties - this is important for the application process
CREATE POLICY "Anyone can view properties with application links"
ON properties
FOR SELECT
TO authenticated
USING (true);

-- Allow agents to manage their properties
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

-- Allow service roles full access
CREATE POLICY "Service roles have full access to properties"
ON properties
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add any additional policies for documents, etc., if needed
-- This covers the core recursion issues 