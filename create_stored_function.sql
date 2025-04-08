-- Create a stored function that will run with security definer privileges
-- This bypasses RLS for this specific operation
CREATE OR REPLACE FUNCTION get_tenant_profile_for_user(user_id UUID)
RETURNS SETOF tenant_profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM tenant_profiles WHERE tenant_id = user_id;
$$;

-- Create a stored function to safely create a tenant profile
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

-- Create a function to safely check if an application exists for a tenant and property
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