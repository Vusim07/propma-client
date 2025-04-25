/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// Deno-specific imports that won't be resolved by the TS compiler in VS Code
// but will work in the Supabase Edge Function environment
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

// Simplified CORS handler function
const handleCors = (req) => {
	// Get origin from request
	const origin = req.headers.get('Origin') || 'http://localhost:5173';

	// Basic CORS headers - allowing the request origin or localhost
	const headers = {
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers':
			'authorization, x-client-info, apikey, content-type',
		'Access-Control-Allow-Credentials': 'true',
	};

	// Immediately handle OPTIONS request
	if (req.method === 'OPTIONS') {
		// 204 responses should not have a body
		return new Response(null, { headers, status: 204 });
	}

	// For other requests, just return the headers to apply
	return headers;
};

serve(async (req) => {
	// Process CORS first, before any other logic
	const corsResult = handleCors(req);

	// If this was an OPTIONS request, handleCors already returned a Response
	if (req.method === 'OPTIONS') {
		return corsResult;
	}

	try {
		// Extract and log auth headers for debugging
		const authHeader = req.headers.get('Authorization');
		const apiKey = req.headers.get('apikey');

		console.log('Auth header present:', !!authHeader);
		console.log('API key present:', !!apiKey);

		if (!authHeader) {
			return new Response(
				JSON.stringify({
					error: 'Unauthorized',
					details: 'Missing Authorization header',
				}),
				{
					status: 401,
					headers: {
						...corsResult,
						'Content-Type': 'application/json',
					},
				},
			);
		}

		// Parse the request body
		const body = await req.json();
		const { calendar_id } = body;

		// Validate required fields
		if (!calendar_id) {
			return new Response(
				JSON.stringify({
					error: 'Missing required field: calendar_id',
				}),
				{
					status: 400,
					headers: {
						...corsResult,
						'Content-Type': 'application/json',
					},
				},
			);
		}

		// Get environment variables
		const supabaseUrl = Deno.env.get('SUPABASE_URL');
		const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

		console.log('Supabase URL available:', !!supabaseUrl);
		console.log('Service role key available:', !!supabaseServiceRoleKey);

		if (!supabaseUrl || !supabaseServiceRoleKey) {
			return new Response(
				JSON.stringify({
					error: 'Server Configuration Error',
					details: 'Missing required environment variables',
				}),
				{
					status: 500,
					headers: {
						...corsResult,
						'Content-Type': 'application/json',
					},
				},
			);
		}

		// Create an admin client with service role key to perform operations
		const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
			auth: {
				autoRefreshToken: false,
				persistSession: false,
			},
		});

		// Get the JWT token from the authorization header
		const token = authHeader.replace('Bearer ', '');

		// Verify the JWT token directly
		const {
			data: { user },
			error: jwtError,
		} = await supabaseAdmin.auth.getUser(token);

		if (jwtError || !user) {
			console.error(
				'JWT verification error:',
				jwtError?.message || 'User not found',
			);
			return new Response(
				JSON.stringify({
					error: 'Unauthorized',
					details: jwtError?.message || 'Invalid token',
					code: jwtError?.code || 'unknown',
				}),
				{
					status: 401,
					headers: {
						...corsResult,
						'Content-Type': 'application/json',
					},
				},
			);
		}

		console.log('Authenticated user:', user.id);

		// Get the calendar integration for the user
		const { data: integration, error: integrationError } = await supabaseAdmin
			.from('calendar_integrations')
			.select('*')
			.eq('user_id', user.id)
			.eq('provider', 'google')
			.single();

		if (integrationError || !integration) {
			console.error('No integration found for user:', user.id);
			return new Response(
				JSON.stringify({
					error: 'No calendar integration found',
					details: integrationError?.message || 'Integration not found',
				}),
				{
					status: 404,
					headers: {
						...corsResult,
						'Content-Type': 'application/json',
					},
				},
			);
		}

		// Update the default calendar ID
		const { error: updateError } = await supabaseAdmin
			.from('calendar_integrations')
			.update({ calendar_id })
			.eq('id', integration.id);

		if (updateError) {
			console.error('Error updating calendar integration:', updateError);
			return new Response(
				JSON.stringify({
					error: 'Database update failed',
					details: updateError.message,
				}),
				{
					status: 500,
					headers: {
						...corsResult,
						'Content-Type': 'application/json',
					},
				},
			);
		}

		return new Response(
			JSON.stringify({
				success: true,
				message: 'Default calendar updated successfully',
				calendar_id,
			}),
			{
				status: 200,
				headers: {
					...corsResult,
					'Content-Type': 'application/json',
				},
			},
		);
	} catch (error) {
		console.error('Error updating default calendar:', error);
		return new Response(
			JSON.stringify({
				error: 'Failed to update default calendar',
				message: error.message,
			}),
			{
				status: 500,
				headers: {
					...corsResult,
					'Content-Type': 'application/json',
				},
			},
		);
	}
});
