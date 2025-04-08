# Row-Level Security Implementation Guide

This guide explains how to implement the Row-Level Security (RLS) fixes for the PropMa application to avoid infinite recursion issues.

## Understanding the Problem

The application was experiencing infinite recursion in RLS policies, leading to:

- 500 Internal Server Error responses
- Inability to query properties via application links
- Failures when checking for existing applications
- Errors when creating or retrieving tenant profiles

## Solution Overview

The solution involves:

1. Creating helper functions with `SECURITY DEFINER` to bypass RLS
2. Rewriting RLS policies to avoid recursive queries
3. Updating application code to use these helper functions

## Step 1: Run SQL Script in Supabase

Run the `fix_rls_recursion.sql` script in the Supabase SQL Editor. This script:

- Creates the necessary helper functions
- Drops and recreates RLS policies to avoid recursion
- Sets up proper access controls for each user role

### Helper Functions Created

| Function                                                       | Purpose                                                   |
| -------------------------------------------------------------- | --------------------------------------------------------- |
| `get_tenant_profile_for_user(user_id)`                         | Safely retrieves a tenant profile by user ID              |
| `create_tenant_profile(...)`                                   | Creates or retrieves a tenant profile                     |
| `get_property_by_token(token)`                                 | Fetches a property by application link token              |
| `get_tenant_applications_for_property(tenant_id, property_id)` | Retrieves applications for a specific tenant and property |

## Step 2: Update Frontend Code

Update the application code to use these functions. Here are examples for each component:

### In tenantStore.ts

```typescript
fetchPropertyByToken: async (token: string): Promise<Property | null> => {
	set({ isLoading: true, error: null });
	try {
		// Try to use the stored function first (this bypasses RLS)
		const { data: rpcData, error: rpcError } = await supabase.rpc<Property[]>(
			'get_property_by_token',
			{ token_param: token },
		);

		if (!rpcError && rpcData && rpcData.length > 0) {
			set({ isLoading: false });
			return rpcData[0];
		}

		// Fallback to direct query if RPC fails
		if (rpcError) {
			console.log('RPC function failed, using fallback:', rpcError);
		}

		// Fallback to standard query
		const { data, error } = await supabase
			.from('properties')
			.select('*')
			.ilike('application_link', `%${token}%`)
			.maybeSingle();

		set({ isLoading: false });
		if (error) throw error;
		return data;
	} catch (error) {
		set({ error: (error as Error).message, isLoading: false });
		return null;
	}
};
```

### In PropertyApplication.tsx

Add a helper function for checking existing applications:

```typescript
const checkForExistingApplications = async (
	tenantProfileId: string,
	propertyId: string,
) => {
	try {
		// Try to use the RPC function first
		try {
			const { data: rpcData, error: rpcError } = await supabase.rpc(
				'get_tenant_applications_for_property',
				{
					tenant_id_param: tenantProfileId,
					property_id_param: propertyId,
				},
			);

			if (rpcError) {
				console.error('RPC error checking applications:', rpcError);
				throw rpcError;
			}

			if (rpcData && rpcData.length > 0) {
				return rpcData[0];
			}
		} catch (error) {
			console.log('RPC method unavailable, falling back to direct query');
		}

		// Fallback to direct query
		const { data, error } = await supabase
			.from('applications')
			.select('id')
			.eq('tenant_id', tenantProfileId)
			.eq('property_id', propertyId)
			.limit(1);

		if (error) return null;
		return data && data.length > 0 ? data[0] : null;
	} catch (error) {
		console.error('Error checking applications:', error);
		return null;
	}
};
```

For profile creation/retrieval:

```typescript
const ensureTenantProfile = async (userId: string): Promise<string> => {
	try {
		// Get the user data first
		const { data: userData, error: userError } = await supabase
			.from('users')
			.select('first_name, last_name, email, phone')
			.eq('id', userId)
			.single();

		if (userError) throw new Error('Could not retrieve user data');

		// Use the create_tenant_profile function
		const { data, error } = await supabase.rpc('create_tenant_profile', {
			p_tenant_id: userId,
			p_first_name: userData.first_name,
			p_last_name: userData.last_name,
			p_email: userData.email,
			p_phone: userData.phone || '',
			p_current_address: '',
			p_id_number: '',
			p_employment_status: 'employed',
			p_monthly_income: 0,
		});

		if (error) throw error;
		return data;
	} catch (error) {
		console.error('Profile creation failed, using fallback:', error);

		// Fallback implementation...
		// (existing code)
	}
};
```

## Step 3: Testing

Test the following scenarios:

1. Application link access for non-authenticated users
2. Tenant can create a profile and submit an application
3. Agent/landlord can view applications for their properties
4. Application process works with social login flows

## Troubleshooting

If you encounter issues:

1. **Check browser console for errors**: Look for RPC function errors which might indicate the functions haven't been created properly.

2. **Verify SQL script execution**: Ensure all functions were created by checking the Supabase database functions section.

3. **Fallback implementations**: The code includes fallbacks to direct queries if RPC functions fail, but may still encounter RLS issues.

4. **Add debug logs**: Monitor function calls and responses to identify any remaining issues.

## Security Considerations

The `SECURITY DEFINER` functions bypass RLS policies, but we've added protection by:

- Setting explicit search paths to avoid SQL injection
- Performing validation within functions
- Limiting function scope to specific use cases

## Further Improvements

Consider:

- Adding better types for RPC function calls
- Creating TypeScript interfaces for function parameters
- Adding caching for frequently accessed data
- Implementing proper error boundaries in React components
