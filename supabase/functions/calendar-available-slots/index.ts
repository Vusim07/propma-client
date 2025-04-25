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

// Helper function to format time as HH:MM
function formatTime(date: Date): string {
	return date.toISOString().split('T')[1].substring(0, 5);
}

/**
 * Generate time slots for a day, checking against busy times
 */
function generateTimeSlots(
	date: string,
	workHours: { start: string; end: string },
	slotDuration: number,
	busySlots: { start: Date; end: Date }[],
): { start: string; end: string }[] {
	const slots: { start: string; end: string }[] = [];
	const day = new Date(date);

	// Parse work hours
	const [startHour, startMinute] = workHours.start.split(':').map(Number);
	const [endHour, endMinute] = workHours.end.split(':').map(Number);

	// Set start and end times
	const startTime = new Date(day);
	startTime.setHours(startHour, startMinute, 0, 0);

	const endTime = new Date(day);
	endTime.setHours(endHour, endMinute, 0, 0);

	// Generate slots
	let currentSlotStart = new Date(startTime);

	while (currentSlotStart < endTime) {
		const currentSlotEnd = new Date(currentSlotStart);
		currentSlotEnd.setMinutes(currentSlotEnd.getMinutes() + slotDuration);

		// Don't create slots that extend beyond end of work hours
		if (currentSlotEnd > endTime) {
			break;
		}

		// Check if the slot overlaps with any busy slot
		const isSlotBusy = busySlots.some(
			(busySlot) =>
				(currentSlotStart >= busySlot.start &&
					currentSlotStart < busySlot.end) ||
				(currentSlotEnd > busySlot.start && currentSlotEnd <= busySlot.end) ||
				(currentSlotStart <= busySlot.start && currentSlotEnd >= busySlot.end),
		);

		if (!isSlotBusy) {
			slots.push({
				start: formatTime(currentSlotStart),
				end: formatTime(currentSlotEnd),
			});
		}

		// Move to next slot
		currentSlotStart = new Date(currentSlotEnd);
	}

	return slots;
}

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
		let requestData;
		try {
			requestData = await req.json();
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

		const { date, agentId, slotDuration = 30 } = requestData;

		// Validate required parameters
		if (!date || !agentId) {
			return new Response(
				JSON.stringify({
					error: 'Missing required parameters',
					required: ['date', 'agentId'],
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

		// Get calendar integration for the agent (not the authenticated user)
		const { data: integration, error: integrationError } = await supabaseAdmin
			.from('calendar_integrations')
			.select('*')
			.eq('user_id', agentId)
			.eq('provider', 'google')
			.single();

		if (integrationError || !integration) {
			console.error('No calendar integration found for agent:', agentId);
			return new Response(
				JSON.stringify({
					error: 'No calendar integration found',
					details:
						integrationError?.message || 'Agent has no calendar integration',
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

		// Get user settings for work hours
		const { data: settings, error: settingsError } = await supabaseAdmin
			.from('user_settings')
			.select('availability_hours')
			.eq('user_id', agentId)
			.single();

		if (settingsError) {
			console.error('Error fetching user settings:', settingsError);
			// Continue with default hours
		}

		// Default work hours if not found in settings
		const workHours = settings?.availability_hours || {
			start: '09:00',
			end: '17:00',
		};

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

		// Set up time boundaries for the query
		const dateObj = new Date(date);
		const timeMin = new Date(dateObj);
		timeMin.setHours(0, 0, 0, 0);

		const timeMax = new Date(dateObj);
		timeMax.setHours(23, 59, 59, 999);

		// Get calendar ID (use primary or specified)
		const calendarId = integration.calendar_id || 'primary';

		// Use direct API call instead of googleapis
		console.log('Fetching freebusy information for calendar:', calendarId);
		const freeBusyResponse = await fetch(
			'https://www.googleapis.com/calendar/v3/freeBusy',
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					timeMin: timeMin.toISOString(),
					timeMax: timeMax.toISOString(),
					items: [{ id: calendarId }],
				}),
			},
		);

		if (!freeBusyResponse.ok) {
			const errorBody = await freeBusyResponse.text();
			throw new Error(
				`Google Calendar API error: ${freeBusyResponse.status} ${errorBody}`,
			);
		}

		const freeBusyData = await freeBusyResponse.json();

		// Extract busy slots
		const busySlots =
			freeBusyData.calendars?.[calendarId]?.busy?.map((slot) => ({
				start: new Date(slot.start || ''),
				end: new Date(slot.end || ''),
			})) || [];

		// Generate available time slots
		const availableSlots = generateTimeSlots(
			date,
			workHours,
			slotDuration,
			busySlots,
		);

		// Transform to simplified format for the frontend
		const simplifiedSlots = availableSlots.map((slot) => slot.start);

		return new Response(
			JSON.stringify({
				slots: simplifiedSlots,
				date,
				workHours,
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
		console.error('Error getting available slots:', error);
		return new Response(
			JSON.stringify({
				error: 'Failed to retrieve available slots',
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
