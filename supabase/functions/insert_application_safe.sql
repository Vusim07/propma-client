-- First handle duplicates
DO $$ 
BEGIN
  -- Clean up any duplicates before adding constraint
  WITH ranked_applications AS (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY tenant_id, property_id 
             ORDER BY created_at DESC
           ) as rn
    FROM applications
  )
  DELETE FROM applications a
  USING ranked_applications ra
  WHERE a.id = ra.id AND ra.rn > 1;
END $$;

-- Create the function
CREATE OR REPLACE FUNCTION insert_application_safe(
  p_property_id UUID,
  p_agent_id UUID,
  p_tenant_id UUID,
  p_employer TEXT,
  p_employment_duration INTEGER,
  p_monthly_income NUMERIC,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_application_id UUID;
BEGIN
  -- Lock the potential application record to prevent race conditions
  PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id::text || p_property_id::text));
  
  -- Check for existing application
  SELECT id INTO v_application_id
  FROM applications
  WHERE tenant_id = p_tenant_id 
    AND property_id = p_property_id
  ORDER BY created_at DESC
  LIMIT 1;
    
  -- Return existing application if found
  IF v_application_id IS NOT NULL THEN
    RETURN v_application_id;
  END IF;
  
  -- Insert new application if none exists
  INSERT INTO applications (
    property_id,
    agent_id,
    tenant_id,
    employer,
    employment_duration,
    monthly_income,
    notes,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_property_id,
    p_agent_id,
    p_tenant_id,
    p_employer,
    p_employment_duration,
    p_monthly_income,
    p_notes,
    'pending',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_application_id;
  
  RETURN v_application_id;
END;
$$;

-- Run these separately after function creation:
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'unique_tenant_property_application'
  ) THEN
    ALTER TABLE applications
    ADD CONSTRAINT unique_tenant_property_application 
    UNIQUE (tenant_id, property_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_applications_tenant_property 
ON applications(tenant_id, property_id);
