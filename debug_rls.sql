-- Show all RLS policies for the applications table
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual, 
  with_check 
FROM 
  pg_policies 
WHERE 
  tablename = 'applications';

-- Check which role the current user has
SELECT auth.uid() as current_user_id, (SELECT role FROM users WHERE id = auth.uid()) as user_role;

-- Check if the current user has tenant profiles
SELECT * FROM tenant_profiles WHERE tenant_id = auth.uid();

-- For testing permission with a specific tenant
-- Replace 'tenant_user_id' with an actual user ID
SELECT 
  (SELECT role FROM users WHERE id = 'tenant_user_id') as tenant_role,
  EXISTS(SELECT 1 FROM tenant_profiles WHERE tenant_id = 'tenant_user_id') as has_tenant_profile; 