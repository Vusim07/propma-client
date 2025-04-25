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

serve(async (req) => {
	// Handle CORS
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	try {
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

		// List calendars
		const calendarList = await calendar.calendarList.list();

		// Format and return the list of calendars
		const calendars =
			calendarList.data.items?.map((calendar) => ({
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
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			},
		);
	} catch (error) {
		console.error('Error fetching calendars:', error);
		return new Response(
			JSON.stringify({
				error: 'Failed to retrieve calendars',
				message: error.message,
			}),
			{
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			},
		);
	}
});
