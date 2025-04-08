-- Fix for the infinite recursion in applications table INSERT policy
-- Run this in Supabase SQL Editor

-- First create a helper function that doesn't rely on RLS policies 
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

-- Drop the problematic policy
DROP POLICY IF EXISTS "Tenants can create their own applications" ON applications;

-- Create a new policy that avoids recursion
CREATE POLICY "Tenants can create their own applications"
ON applications
FOR INSERT
TO authenticated
WITH CHECK (
  -- Use our helper function instead of a policy that might trigger recursion
  can_tenant_create_application(auth.uid())
);

-- Create a specialized function for application insertion
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
BEGIN
  -- Insert the application directly
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