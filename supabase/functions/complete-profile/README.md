# Complete Profile Edge Function

This Edge Function creates or updates a user profile with elevated database privileges, allowing it to bypass RLS policies.

## Local Development

```bash
# Start the local development server
supabase functions serve --no-verify-jwt

# Invoke the function locally
curl --request POST 'http://localhost:54321/functions/v1/complete-profile' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"id":"user_id","email":"user@example.com","first_name":"John","last_name":"Doe","role":"tenant","phone":"+123456789"}'
```

## Deployment

```bash
# Deploy to your Supabase project
supabase functions deploy complete-profile --no-verify-jwt
```

## Usage in front-end

Use the Supabase JS client to invoke the function:

```typescript
const { data, error } = await supabase.functions.invoke('complete-profile', {
	body: JSON.stringify({
		id: userId,
		email: userEmail,
		first_name: firstName,
		last_name: lastName,
		role: userRole,
		phone: phoneNumber || null,
		company_name: companyName || null,
	}),
});
```
