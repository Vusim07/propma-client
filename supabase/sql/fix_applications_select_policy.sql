-- Fix for the infinite recursion in applications table SELECT policy
-- Run this in Supabase SQL Editor

-- First create a helper function to check if a user can view applications
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
  -- This is handled by a separate policy
  ELSIF user_role IN ('agent', 'landlord') THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Replace the problematic SELECT policy for tenants
DROP POLICY IF EXISTS "Tenants can view their own applications" ON applications;

-- Create a new policy that avoids recursion
CREATE POLICY "Tenants can view their own applications"
ON applications
FOR SELECT
TO authenticated
USING (
  -- Use our helper function to avoid recursion
  can_view_application(auth.uid(), tenant_id)
);

-- Create function to safely get applications by tenant and property
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