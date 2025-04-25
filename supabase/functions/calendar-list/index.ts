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

// Get OAuth credentials directly from environment variables
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';

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

		// Get environment variables
		const supabaseUrl = Deno.env.get('SUPABASE_URL');
		const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
		const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

		console.log('Supabase URL available:', !!supabaseUrl);
		console.log('Anon key available:', !!supabaseAnonKey);
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

		// Get calendar integration for the user
		const { data: integration, error: integrationError } = await supabaseAdmin
			.from('calendar_integrations')
			.select('*')
			.eq('user_id', user.id)
			.eq('provider', 'google')
			.single();

		if (integrationError || !integration) {
			console.error('No integration found for user:', user.id);
			console.error(
				'Integration error:',
				integrationError?.message || 'Integration not found',
			);

			return new Response(
				JSON.stringify({
					error: 'No calendar integration found',
					details:
						integrationError?.message ||
						'No Google Calendar integration exists for this user',
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

		console.log('Found integration for user:', user.id);

		// Check if token is expired and refresh if needed
		let accessToken = integration.access_token;
		if (new Date(integration.token_expiry) < new Date()) {
			try {
				console.log('Token expired, refreshing...');

				const refreshResponse = await fetch(
					'https://oauth2.googleapis.com/token',
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded',
						},
						body: new URLSearchParams({
							client_id: GOOGLE_CLIENT_ID,
							client_secret: GOOGLE_CLIENT_SECRET,
							refresh_token: integration.refresh_token,
							grant_type: 'refresh_token',
						}),
					},
				);

				if (!refreshResponse.ok) {
					const errorData = await refreshResponse.text();
					throw new Error(
						`Token refresh failed: ${refreshResponse.status} ${errorData}`,
					);
				}

				const tokens = await refreshResponse.json();
				console.log('Token refreshed successfully');

				// Update access token for this request
				accessToken = tokens.access_token;

				// Update the tokens in the database
				const updateData = {
					access_token: tokens.access_token,
					token_expiry: new Date(
						Date.now() + (tokens.expires_in || 3600) * 1000,
					).toISOString(),
				};

				// If we received a new refresh token, update that too
				if (tokens.refresh_token) {
					updateData.refresh_token = tokens.refresh_token;
				}

				const { error: updateError } = await supabaseAdmin
					.from('calendar_integrations')
					.update(updateData)
					.eq('id', integration.id);

				if (updateError) {
					console.error('Error updating tokens in database:', updateError);
				}
			} catch (refreshError) {
				console.error('Token refresh error:', refreshError.message);
				return new Response(
					JSON.stringify({
						error: 'Failed to refresh token',
						message:
							'Your authorization may have expired. Please reconnect your calendar.',
						details: refreshError.message,
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
		}

		try {
			// Direct fetch call to Google Calendar API
			console.log('Fetching calendar list...');
			const calendarResponse = await fetch(
				'https://www.googleapis.com/calendar/v3/users/me/calendarList',
				{
					method: 'GET',
					headers: {
						Authorization: `Bearer ${accessToken}`,
						'Content-Type': 'application/json',
					},
				},
			);

			if (!calendarResponse.ok) {
				const errorText = await calendarResponse.text();
				throw new Error(
					`Google Calendar API error: ${calendarResponse.status} ${errorText}`,
				);
			}

			const calendarData = await calendarResponse.json();
			console.log(`Retrieved ${calendarData.items?.length || 0} calendars`);

			// Format and return the list of calendars
			const calendars =
				calendarData.items?.map((calendar) => ({
					id: calendar.id,
					summary: calendar.summary,
					primary: calendar.primary || false,
					accessRole: calendar.accessRole,
				})) || [];

			return new Response(
				JSON.stringify({
					calendars,
					default_calendar_id: integration.calendar_id,
				}),
				{
					status: 200,
					headers: {
						...corsResult,
						'Content-Type': 'application/json',
					},
				},
			);
		} catch (apiError) {
			console.error('Google API error:', apiError.message);
			return new Response(
				JSON.stringify({
					error: 'Failed to retrieve calendars from Google',
					message:
						'There was an error accessing your Google calendars. Please try again later.',
					details: apiError.message,
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
	} catch (error) {
		console.error('Error fetching calendars:', error.message);
		console.error('Error stack:', error.stack);
		return new Response(
			JSON.stringify({
				error: 'Failed to retrieve calendars',
				message: error.message || 'Unknown error occurred',
			}),
			{
				status: 500,
				headers: { ...corsResult, 'Content-Type': 'application/json' },
			},
		);
	}
});
