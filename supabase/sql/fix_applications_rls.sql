-- Comprehensive fix for the applications table RLS policies
-- This script addresses issues with application retrieval and the "placeholder" ID problem

-- Enable RLS on applications table if not already enabled
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- 1. Helper Functions

-- Function to check if a user can view an application without using RLS
CREATE OR REPLACE FUNCTION can_view_application(user_id UUID, application_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get the user's role directly without using any policies
  SELECT role INTO user_role FROM users WHERE id = user_id;
  
  -- If user is a tenant, they can only view their own applications
  IF user_role = 'tenant' THEN
    RETURN EXISTS (
      SELECT 1 
      FROM tenant_profiles 
      WHERE tenant_id = user_id 
      AND id = application_tenant_id
    );
  -- If user is agent or landlord, they can view applications for their properties
  ELSIF user_role IN ('agent', 'landlord') THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Function for tenants to check if they can create applications
CREATE OR REPLACE FUNCTION can_tenant_create_application(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users WHERE id = user_id AND role = 'tenant'
  );
END;
$$;

-- 2. Improved function for checking if an application exists
-- This function returns application ID instead of just boolean
CREATE OR REPLACE FUNCTION get_application_id_if_exists(
  tenant_id_param UUID,
  property_id_param UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  application_id UUID;
BEGIN
  SELECT id INTO application_id
  FROM applications 
  WHERE tenant_id = tenant_id_param 
  AND property_id = property_id_param
  LIMIT 1;
  
  RETURN application_id;
END;
$$;

-- Keep the old function for backward compatibility
CREATE OR REPLACE FUNCTION check_application_exists(
  tenant_id_param UUID,
  property_id_param UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM applications 
    WHERE tenant_id = tenant_id_param 
    AND property_id = property_id_param
  );
END;
$$;

-- 3. Function to retrieve tenant's applications for a property
CREATE OR REPLACE FUNCTION get_tenant_applications_for_property(
  tenant_id_param UUID,
  property_id_param UUID
)
RETURNS SETOF applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT * 
    FROM applications 
    WHERE tenant_id = tenant_id_param 
    AND property_id = property_id_param;
END;
$$;

-- 4. Improved application insertion function
CREATE OR REPLACE FUNCTION insert_application(
  p_property_id UUID,
  p_agent_id UUID,
  p_tenant_id UUID,
  p_employer TEXT,
  p_employment_duration NUMERIC,
  p_monthly_income NUMERIC,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_application_id UUID;
  existing_application_id UUID;
BEGIN
  -- First check if an application already exists
  SELECT id INTO existing_application_id
  FROM applications
  WHERE tenant_id = p_tenant_id AND property_id = p_property_id
  LIMIT 1;
  
  -- If application exists, update it instead of creating a new one
  IF existing_application_id IS NOT NULL THEN
    UPDATE applications
    SET 
      employer = p_employer,
      employment_duration = p_employment_duration,
      monthly_income = p_monthly_income,
      notes = p_notes,
      updated_at = NOW()
    WHERE id = existing_application_id;
    
    RETURN existing_application_id;
  END IF;

  -- Otherwise insert a new application
  INSERT INTO applications (
    property_id,
    agent_id,
    tenant_id,
    employer,
    employment_duration,
    monthly_income,
    notes,
    status,
    created_at
  ) VALUES (
    p_property_id,
    p_agent_id,
    p_tenant_id,
    p_employer,
    p_employment_duration,
    p_monthly_income,
    p_notes,
    'pending',
    NOW()
  )
  RETURNING id INTO new_application_id;
  
  RETURN new_application_id;
END;
$$;

-- 5. Drop and recreate all RLS policies

-- Drop existing policies
DROP POLICY IF EXISTS "Tenants can create their own applications" ON applications;
DROP POLICY IF EXISTS "Tenants can view their own applications" ON applications;
DROP POLICY IF EXISTS "Agents can view applications for their properties" ON applications;
DROP POLICY IF EXISTS "Agents can update applications for their properties" ON applications;
DROP POLICY IF EXISTS "Service roles have full access to applications" ON applications;

-- Recreate policies with improved logic

-- 1. Allow tenants to create applications
CREATE POLICY "Tenants can create their own applications"
ON applications
FOR INSERT
TO authenticated
WITH CHECK (
  can_tenant_create_application(auth.uid())
);

-- 2. Allow tenants to view their own applications
CREATE POLICY "Tenants can view their own applications"
ON applications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tenant_profiles 
    WHERE tenant_profiles.id = applications.tenant_id 
    AND tenant_profiles.tenant_id = auth.uid()
  )
);

-- 3. Allow agents to view applications for their properties
CREATE POLICY "Agents can view applications for their properties"
ON applications
FOR SELECT
TO authenticated
USING (
  (SELECT role FROM users WHERE id = auth.uid()) IN ('agent', 'landlord') 
  AND
  (agent_id = auth.uid() OR property_id IN (
    SELECT id FROM properties WHERE agent_id = auth.uid()
  ))
);

-- 4. Allow agents to update applications for their properties
CREATE POLICY "Agents can update applications for their properties"
ON applications
FOR UPDATE
TO authenticated
USING (
  (SELECT role FROM users WHERE id = auth.uid()) IN ('agent', 'landlord')
  AND
  (agent_id = auth.uid() OR property_id IN (
    SELECT id FROM properties WHERE agent_id = auth.uid()
  ))
);

-- 5. Allow service roles full access
CREATE POLICY "Service roles have full access to applications"
ON applications
FOR ALL
TO service_role
USING (true)
WITH CHECK (true); 