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

		// Parse request body
		let body;
		try {
			body = await req.json();
		} catch {
			return new Response(
				JSON.stringify({
					error: 'Invalid request',
					details: 'Failed to parse request body as JSON',
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

		const { title, description, start, end, attendees = [] } = body;

		// Validate required fields
		if (!title || !start || !end) {
			return new Response(
				JSON.stringify({
					error: 'Missing required fields: title, start, end',
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

		// Ensure start is before end
		if (new Date(start) >= new Date(end)) {
			return new Response(
				JSON.stringify({
					error: 'Start time must be before end time',
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
					details:
						integrationError?.message ||
						'No calendar integration exists for this user',
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
							'Calendar authorization has expired. Please reconnect the calendar.',
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

		// Use the selected calendar ID from the integration if available, otherwise use primary
		const calendarId = integration.calendar_id || 'primary';

		// Format attendees
		const eventAttendees = attendees.map((email) => ({ email }));

		// Create event using direct API call
		const event = {
			summary: title,
			description: description || '',
			start: {
				dateTime: new Date(start).toISOString(),
				timeZone: 'UTC', // Consider using the user's timezone in the future
			},
			end: {
				dateTime: new Date(end).toISOString(),
				timeZone: 'UTC', // Consider using the user's timezone in the future
			},
			attendees: eventAttendees,
		};

		console.log('Creating calendar event in calendar:', calendarId);
		const eventResponse = await fetch(
			`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
				calendarId,
			)}/events?sendUpdates=all`,
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(event),
			},
		);

		if (!eventResponse.ok) {
			const errorBody = await eventResponse.text();
			throw new Error(
				`Google Calendar API error: ${eventResponse.status} ${errorBody}`,
			);
		}

		const eventData = await eventResponse.json();

		return new Response(JSON.stringify({ success: true, event: eventData }), {
			status: 200,
			headers: {
				...corsResult,
				'Content-Type': 'application/json',
			},
		});
	} catch (error) {
		console.error('Error creating calendar event:', error);
		return new Response(
			JSON.stringify({
				error: 'Failed to create calendar event',
				message: error.message || 'Unknown error occurred',
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
