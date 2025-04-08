# RLS Fix Testing Guide

This guide will help you verify that the Row-Level Security (RLS) fixes have been implemented correctly and resolved the recursion issues.

## 1. Prerequisite Setup

Before testing, ensure you've:

1. Run the `fix_rls_recursion.sql` script in Supabase SQL Editor
2. Run the `fix_applications_policy.sql` script in Supabase SQL Editor
3. Updated the frontend code according to the implementation guide
4. Rebuilt and deployed the application

## 2. Testing Scenarios

### 2.1. Tenant Profile Creation

**Test Steps:**

1. Register a new tenant account
2. After registration, check browser console for errors
3. Verify in the Supabase database that a tenant profile record was created

**Expected Result:**

- No errors in the console
- Tenant profile record exists in the database
- No recursion or 500 errors during profile creation

### 2.2. Property Lookup via Application Link

**Test Steps:**

1. Create a property with an application link as an agent
2. Open the application link in a browser
3. Check that the property details load correctly

**Expected Result:**

- Property details load successfully
- No RLS errors in the console
- Application form shows the correct property details

### 2.3. Existing Application Check

**Test Steps:**

1. Submit an application for a property as a tenant
2. Log out
3. Log back in and visit the same application link

**Expected Result:**

- System correctly identifies that an existing application exists
- Redirects to the document upload step
- No recursion errors in the console

### 2.4. Application Submission

**Test Steps:**

1. As a tenant, navigate to a property application link
2. Complete the application form
3. Submit the application

**Expected Result:**

- Application submits successfully
- System redirects to document upload
- No infinite recursion errors in the console

### 2.5. Document Upload for Application

**Test Steps:**

1. After submitting an application, proceed to document upload
2. Upload a test document (e.g., PDF or image)
3. Complete the process

**Expected Result:**

- Document uploads and processes successfully
- Document is associated with the correct application
- No RLS errors during document upload

## 3. Troubleshooting Common Issues

### Problem: Still seeing recursion errors during application submission

**Solution:**

- Verify that the `insert_application` function was created in the database
- Check that the `tenantStore.submitApplication` function is trying the RPC method first
- Ensure the `can_tenant_create_application` function exists and is used in the policy

### Problem: Property data not loading via application link

**Solution:**

- Verify that the `get_property_by_token` function exists in the database
- Check that the `fetchPropertyByToken` method in the store is using the RPC method
- Review browser console for any specific errors

### Problem: User profile creation failing

**Solution:**

- Check that the `create_tenant_profile` function exists in the database
- Review the tenant profile RLS policies for any conflicts
- Ensure the function has SECURITY DEFINER privileges

## 4. Verifying Through Database Queries

You can directly verify the success of these fixes by running these queries in the Supabase SQL Editor:

```sql
-- Check that the helper functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'get_property_by_token',
  'create_tenant_profile',
  'get_tenant_applications_for_property',
  'insert_application',
  'can_tenant_create_application'
);

-- Check that the RLS policies are correctly set up
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('applications', 'tenant_profiles', 'properties');
```

If any functions are missing, re-run the appropriate SQL scripts. If policies are incorrectly configured, review and apply the fixes again.

## 5. Next Steps

Once you've confirmed that all tests pass and the RLS issues are resolved:

1. **Monitor Production Usage**: Keep an eye on error logs and user feedback
2. **Review Supabase Logs**: Check for any remaining RLS issues or performance problems
3. **Consider Performance Optimization**: Some of these fixes prioritize reliability over performance - you may want to optimize once stability is confirmed

If you encounter any issues not covered in this guide, refer to the Supabase documentation on [Row Level Security](https://supabase.io/docs/guides/auth/row-level-security) for more advanced troubleshooting.
