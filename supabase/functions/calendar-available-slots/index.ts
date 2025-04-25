/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// Deno-specific imports that won't be resolved by the TS compiler in VS Code
// but will work in the Supabase Edge Function environment
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { google } from 'https://esm.sh/googleapis@128.0.0';
import { corsHeaders } from '../_shared/cors.ts';

// Get OAuth credentials directly from environment variables
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI') || '';

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
	// Handle CORS
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	try {
		const { date, slotDuration = 30 } = await req.json();

		// Validate required parameters
		if (!date) {
			return new Response(
				JSON.stringify({
					error: 'Missing required parameters',
					required: ['date'],
				}),
				{
					status: 400,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				},
			);
		}

		// Get user ID from the JWT
		const supabaseClient = createClient(
			Deno.env.get('SUPABASE_URL') || '',
			Deno.env.get('SUPABASE_ANON_KEY') || '',
			{
				global: {
					headers: { Authorization: req.headers.get('Authorization') || '' },
				},
			},
		);

		const supabaseAdmin = createClient(
			Deno.env.get('SUPABASE_URL') || '',
			Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
			{
				auth: {
					autoRefreshToken: false,
					persistSession: false,
				},
			},
		);

		// Get the authenticated user
		const {
			data: { user },
			error: userError,
		} = await supabaseClient.auth.getUser();
		if (userError || !user) {
			return new Response(
				JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
				{
					status: 401,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				},
			);
		}

		// Get calendar integration for the user
		const { data: integration, error: integrationError } = await supabaseAdmin
			.from('calendar_integrations')
			.select('*')
			.eq('user_id', user.id)
			.eq('provider', 'google')
			.single();

		if (integrationError || !integration) {
			return new Response(
				JSON.stringify({ error: 'No calendar integration found' }),
				{
					status: 404,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				},
			);
		}

		// Get user settings for work hours
		const { data: settings, error: settingsError } = await supabaseAdmin
			.from('user_settings')
			.select('availability_hours')
			.eq('user_id', user.id)
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

		// Initialize Google Calendar client
		const oauth2Client = new google.auth.OAuth2(
			GOOGLE_CLIENT_ID,
			GOOGLE_CLIENT_SECRET,
			GOOGLE_REDIRECT_URI,
		);

		// Set credentials and refresh if needed
		oauth2Client.setCredentials({
			refresh_token: integration.refresh_token,
		});

		// Refresh the token if it's expired
		if (new Date(integration.token_expiry) < new Date()) {
			const { tokens } = await oauth2Client.refreshAccessToken();

			// Update the tokens in the database
			if (tokens.refresh_token) {
				await supabaseAdmin
					.from('calendar_integrations')
					.update({
						access_token: tokens.access_token,
						refresh_token: tokens.refresh_token,
						token_expiry: new Date(
							Date.now() + (tokens.expires_in || 3600) * 1000,
						).toISOString(),
					})
					.eq('id', integration.id);
			} else {
				await supabaseAdmin
					.from('calendar_integrations')
					.update({
						access_token: tokens.access_token,
						token_expiry: new Date(
							Date.now() + (tokens.expires_in || 3600) * 1000,
						).toISOString(),
					})
					.eq('id', integration.id);
			}
		}

		// Create calendar client
		const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

		// Set up time boundaries for the query
		const dateObj = new Date(date);
		const timeMin = new Date(dateObj);
		timeMin.setHours(0, 0, 0, 0);

		const timeMax = new Date(dateObj);
		timeMax.setHours(23, 59, 59, 999);

		// Get calendar ID (use primary or specified)
		const calendarId = integration.calendar_id || 'primary';

		// Query for busy times
		const freeBusy = await calendar.freebusy.query({
			requestBody: {
				timeMin: timeMin.toISOString(),
				timeMax: timeMax.toISOString(),
				items: [{ id: calendarId }],
			},
		});

		// Extract busy slots
		const busySlots =
			freeBusy.data.calendars?.[calendarId]?.busy?.map((slot) => ({
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

		return new Response(
			JSON.stringify({
				date,
				work_hours: workHours,
				slot_duration: slotDuration,
				slots: availableSlots,
			}),
			{
				status: 200,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			},
		);
	} catch (error) {
		console.error('Error getting available slots:', error);
		return new Response(
			JSON.stringify({
				error: 'Failed to retrieve available slots',
				message: error.message,
			}),
			{
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			},
		);
	}
});
