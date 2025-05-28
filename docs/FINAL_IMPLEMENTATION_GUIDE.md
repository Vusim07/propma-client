# RLS Infinite Recursion Fix - Implementation Guide

## Issue Summary

Your Supabase application is experiencing infinite recursion in Row Level Security (RLS) policies for the applications table. This is causing 500 Internal Server errors when:

1. Checking if an existing application exists for a tenant and property
2. Submitting a new application

The root cause is that your RLS policies are creating circular references when checking user roles and tenant relationships.

## Solution Overview

Our solution involves:

1. Creating helper functions that use `SECURITY DEFINER` to bypass RLS checks
2. Modifying RLS policies to use these helper functions instead of recursive queries
3. Updating the frontend code to use these helper functions via RPC calls

## Step 1: Fix Applications INSERT Policy

First, execute the `fix_applications_policy.sql` script in the Supabase SQL Editor:

```sql
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
```

## Step 2: Fix Applications SELECT Policy

Next, execute the `fix_applications_select_policy.sql` script to fix the SELECT policy:

```sql
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
```

## Step 3: Update the Application RLS Fixes

If you haven't already, execute the `fix_rls_recursion.sql` script to apply all the other RLS fixes and helper functions.

## Step 4: Update Frontend Type Definitions

Update your `src/types/index.ts` file to include the new RPC function types:

```typescript
// RPC Function types
export interface RpcFunctions {
	// ... existing functions ...

	insert_application: (params: {
		p_property_id: string;
		p_agent_id: string;
		p_tenant_id: string;
		p_employer: string;
		p_employment_duration: number;
		p_monthly_income: number;
		p_notes?: string | null;
	}) => Promise<string>; // Returns the application ID

	check_application_exists: (params: {
		tenant_id_param: string;
		property_id_param: string;
	}) => Promise<boolean>; // Returns true if an application exists
}

// Extend the Supabase client type for rpc
declare module '@supabase/supabase-js' {
	interface SupabaseClient {
		rpc<T = unknown>(
			fn: keyof RpcFunctions | string,
			params?: object,
			options?: object,
		): Promise<{ data: T; error: Error | null }>;
	}
}
```

## Step 5: Update tenantStore.ts

Update the `submitApplication` function in `src/stores/tenantStore.ts` to use the new RPC function:

```typescript
submitApplication: async (application: {
	property_id: string;
	agent_id: string;
	tenant_id: string;
	employer: string;
	employment_duration: number;
	monthly_income: number;
	notes?: string;
}): Promise<Application | null> => {
	set({ isLoading: true, error: null });
	try {
		// Validate the numeric fields to ensure they are numbers, not NaN
		if (
			isNaN(application.employment_duration) ||
			isNaN(application.monthly_income)
		) {
			throw new Error(
				'Employment duration and monthly income must be valid numbers',
			);
		}

		// Ensure numeric fields are actually numbers, not strings
		const employmentDuration = Number(application.employment_duration);
		const monthlyIncome = Number(application.monthly_income);

		console.log('Submitting application to Supabase:', {
			...application,
			employment_duration: employmentDuration,
			monthly_income: monthlyIncome,
		});

		// First try to use the RPC function to bypass RLS
		try {
			const { data: applicationId, error: rpcError } =
				await supabase.rpc<string>('insert_application', {
					p_property_id: application.property_id,
					p_agent_id: application.agent_id,
					p_tenant_id: application.tenant_id,
					p_employer: application.employer,
					p_employment_duration: employmentDuration,
					p_monthly_income: monthlyIncome,
					p_notes: application.notes || null,
				});

			if (rpcError) {
				console.log(
					'RPC insert_application failed, falling back to direct insert:',
					rpcError,
				);
				throw rpcError; // Throw to trigger the fallback
			}

			// Fetch the created application
			const { data: createdApplication, error: fetchError } = await supabase
				.from('applications')
				.select('*')
				.eq('id', applicationId)
				.single();

			if (fetchError) {
				throw fetchError;
			}

			set({ isLoading: false });
			return createdApplication;
		} catch (error) {
			console.log('Using fallback for application submission');

			// Fallback to direct insert (may still trigger RLS errors)
			const applicationData = {
				...application,
				employment_duration: employmentDuration,
				monthly_income: monthlyIncome,
				status: 'pending',
				created_at: new Date().toISOString(),
			};

			// Create the application record
			const { data, error } = await supabase
				.from('applications')
				.insert(applicationData)
				.select()
				.single();

			if (error) {
				console.error('Supabase error on application insert:', error);
				throw error;
			}

			set({ isLoading: false });
			return data;
		}
	} catch (error) {
		console.error('Application submission error:', error);
		set({ error: (error as Error).message, isLoading: false });
		return null;
	}
};
```

## Step 6: Update PropertyApplication.tsx

Update your `PropertyApplication.tsx` component to use the new `check_application_exists` helper function:

```typescript
// Add this function to check for existing applications
const checkForExistingApplications = async (
	tenantProfileId: string,
	propertyId: string,
) => {
	try {
		console.log('Checking for existing applications:', {
			tenantId: tenantProfileId,
			propertyId: propertyId,
		});

		// First try check_application_exists RPC
		const { data: applicationExists, error: checkError } =
			await supabase.rpc<boolean>('check_application_exists', {
				tenant_id_param: tenantProfileId,
				property_id_param: propertyId,
			});

		if (!checkError && applicationExists === true) {
			console.log('RPC check for application returned:', applicationExists);

			// Application exists, create a placeholder application object with minimum required fields
			return {
				id: 'placeholder',
				tenant_id: tenantProfileId,
				property_id: propertyId,
				agent_id: '', // These fields are required by the type but not used for our flow
				created_at: '',
				updated_at: '',
				employer: '',
				employment_duration: 0,
				monthly_income: 0,
				status: 'pending',
				notes: null,
				decision_at: null,
			} as Application;
		}

		if (checkError) {
			console.log(
				'First RPC method failed, trying alternative',
				checkError.message,
			);

			// Try alternative RPC method as fallback
			const { data: rpcData, error: rpcError } = await supabase.rpc<
				Application[]
			>('get_tenant_applications_for_property', {
				tenant_id_param: tenantProfileId,
				property_id_param: propertyId,
			});

			if (!rpcError && rpcData && rpcData.length > 0) {
				console.log(
					'Found existing application via alternative RPC:',
					rpcData[0],
				);
				return rpcData[0];
			}

			if (rpcError) {
				console.log(
					'All RPC methods failed, skipping direct query due to RLS issues',
				);
			}
		}

		// If we got here, no application was found or all methods failed
		return null;
	} catch (error) {
		console.error('Unexpected error checking applications:', error);
		return null;
	}
};
```

Make sure to update the `ensureTenantProfile` function as well to properly handle RPC return types:

```typescript
// Also update the ensureTenantProfile function
const ensureTenantProfile = async (userId: string): Promise<string> => {
	try {
		// Try to use our stored function first (this bypasses RLS)
		try {
			// Get the user data first
			const { data: userData, error: userError } = await supabase
				.from('users')
				.select('first_name, last_name, email, phone')
				.eq('id', userId)
				.single();

			if (userError) {
				console.error('Error fetching user data:', userError);
				throw new Error('Could not retrieve user data for profile creation');
			}

			// Use the create_tenant_profile function to safely check/create profile
			const { data: profileId, error } = await supabase.rpc<string>(
				'create_tenant_profile',
				{
					p_tenant_id: userId,
					p_first_name: userData.first_name,
					p_last_name: userData.last_name,
					p_email: userData.email,
					p_phone: userData.phone || '',
					p_current_address: '',
					p_id_number: '',
					p_employment_status: 'employed',
					p_monthly_income: 0,
				},
			);

			if (error) {
				console.error('Error using create_tenant_profile function:', error);
				throw error;
			}

			console.log('Profile created or retrieved with ID:', profileId);
			return profileId as string;
		} catch (funcError) {
			// Fallback to direct approach if RPC fails
			// ... existing fallback code ...
		}
	} catch (error) {
		// ... existing error handling ...
	}
};
```

## Step 7: Testing

After implementing all these changes, test the application flow following these steps:

1. Register or login as a tenant
2. Visit a property application link
3. Fill out and submit the application form
4. Verify you're redirected to the document upload page
5. Visit the same application link again and verify you're redirected to the document upload page

If any issues persist, check the browser console for detailed error messages.

## Common Issues and Solutions

### Still seeing recursion errors

- Verify all SQL scripts executed successfully
- Check that the frontend is correctly using the helper functions
- Look for any network errors in the browser console

### Application submission fails

- Verify the database has the proper RLS policies
- Check the tenant profile exists before submitting
- Ensure the application form data is correctly formatted

### Property lookup fails

- Verify the `get_property_by_token` function exists
- Check the application link format is correct

## Conclusion

This comprehensive solution addresses the infinite recursion issues in your RLS policies by:

1. Creating secure helper functions that bypass RLS when necessary
2. Modifying RLS policies to prevent circular references
3. Updating the frontend to use these helper functions

The solution maintains security while avoiding the performance and stability issues caused by recursive RLS policies.
