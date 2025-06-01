CREATE OR REPLACE FUNCTION get_existing_application(
  p_tenant_id UUID,
  p_property_id UUID
) RETURNS applications
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_application applications;
BEGIN
  -- Get the most recent application for this tenant/property pair
  SELECT *
  INTO v_application
  FROM applications
  WHERE tenant_id = p_tenant_id 
    AND property_id = p_property_id
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN v_application;
END;
$$;
