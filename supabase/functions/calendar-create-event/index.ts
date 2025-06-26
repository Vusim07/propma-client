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

		const {
			title,
			description,
			start,
			end,
			attendees = [],
			agentId,
			tenantId,
			propertyId,
		} = body;

		// Validate required fields
		if (!title || !start || !end || !agentId || !tenantId || !propertyId) {
			return new Response(
				JSON.stringify({
					error:
						'Missing required fields: title, start, end, agentId, tenantId, propertyId',
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
		const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

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

		// Verify the JWT token directly (for tenant authentication)
		const {
			data: { user },
			error: jwtError,
		} = await supabaseAdmin.auth.getUser(token);

		if (jwtError || !user) {
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

		// Look up the agent's calendar integration
		const { data: agentIntegration, error: agentIntegrationError } =
			await supabaseAdmin
				.from('calendar_integrations')
				.select('*')
				.eq('user_id', agentId)
				.eq('provider', 'google')
				.single();

		let googleEvent = null;
		let meetLink = null;
		if (agentIntegration && !agentIntegrationError) {
			// Check if token is expired and refresh if needed
			let accessToken = agentIntegration.access_token;
			if (new Date(agentIntegration.token_expiry) < new Date()) {
				try {
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
								refresh_token: agentIntegration.refresh_token,
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
					accessToken = tokens.access_token;

					const updateData = {
						access_token: tokens.access_token,
						token_expiry: new Date(
							Date.now() + (tokens.expires_in || 3600) * 1000,
						).toISOString(),
					};
					if (tokens.refresh_token) {
						updateData.refresh_token = tokens.refresh_token;
					}
					await supabaseAdmin
						.from('calendar_integrations')
						.update(updateData)
						.eq('id', agentIntegration.id);
				} catch (refreshError) {
					// If refresh fails, skip Google event creation
					console.error('Token refresh error:', refreshError.message);
					accessToken = null;
				}
			}

			if (accessToken) {
				const calendarId = agentIntegration.calendar_id || 'primary';
				const eventAttendees = attendees.map((email) => ({ email }));
				const event = {
					summary: title,
					description: description || '',
					start: {
						dateTime: new Date(start).toISOString(),
						timeZone: 'Africa/Johannesburg',
					},
					end: {
						dateTime: new Date(end).toISOString(),
						timeZone: 'Africa/Johannesburg',
					},
					attendees: eventAttendees,
				};
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
				if (eventResponse.ok) {
					googleEvent = await eventResponse.json();
					meetLink = googleEvent.hangoutLink || null;
				}
			}
		}

		// Always create the appointment in Supabase
		const appointmentInsert = {
			tenant_id: tenantId,
			agent_id: agentId,
			property_id: propertyId,
			date: start.split('T')[0],
			start_time: start.split('T')[1]?.slice(0, 5),
			end_time: end.split('T')[1]?.slice(0, 5),
			notes: description || null,

			status: 'scheduled',
		};

		const { data: appointment, error: appointmentError } = await supabaseAdmin
			.from('appointments')
			.insert(appointmentInsert)
			.select()
			.single();
		if (appointmentError) {
			console.error('Supabase appointment insert error:', {
				error: appointmentError,
				payload: appointmentInsert,
			});
			return new Response(
				JSON.stringify({
					error: 'Failed to create appointment',
					details: appointmentError.message,
					supabaseError: appointmentError,
					payload: appointmentInsert,
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

		// Notify agent of new appointment
		await notifyAgentOfNewAppointment({
			agentId,
			tenantId,
			propertyId,
			appointment,
			supabaseAdmin,
		});

		return new Response(
			JSON.stringify({
				success: true,
				appointment,
				event: googleEvent,
				meetLink,
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

// Utility to notify agent of new appointment via Postmark
async function notifyAgentOfNewAppointment({
	agentId,
	tenantId,
	propertyId,
	appointment,
	supabaseAdmin,
}) {
	// Fetch agent email
	const { data: agent, error: agentError } = await supabaseAdmin
		.from('users')
		.select('email, first_name, last_name')
		.eq('id', agentId)
		.single();
	if (agentError || !agent?.email) return;

	// Fetch tenant info
	const { data: tenant } = await supabaseAdmin
		.from('users')
		.select('first_name, last_name, email, phone')
		.eq('id', tenantId)
		.single();

	// Fetch property info
	const { data: property } = await supabaseAdmin
		.from('properties')
		.select('address, suburb, city, province, postal_code')
		.eq('id', propertyId)
		.single();

	// Compose notification
	const subject = `Amara: New Viewing Appointment Scheduled at ${
		property?.address || 'Property'
	}`;
	const appointmentDate = appointment.date;
	const appointmentTime =
		appointment.start_time +
		(appointment.end_time ? ` - ${appointment.end_time}` : '');
	const propertyAddress = property
		? `${property.address}, ${property.suburb}, ${property.city}, ${property.province}, ${property.postal_code}`
		: 'N/A';
	const tenantName = tenant
		? `${tenant.first_name} ${tenant.last_name}`
		: 'N/A';
	const tenantEmail = tenant?.email || 'N/A';
	const tenantPhone = tenant?.phone || 'N/A';

	const body =
		`Dear ${agent.first_name || 'Agent'},\n\n` +
		`A new viewing appointment has been scheduled in your calendar.\n\n` +
		`Date: ${appointmentDate}\n` +
		`Time: ${appointmentTime}\n` +
		`Property: ${propertyAddress}\n` +
		`Tenant: ${tenantName}\n` +
		`Tenant Email: ${tenantEmail}\n` +
		`Tenant Phone: ${tenantPhone}\n` +
		`\nPlease log in to Amara to view more details about the prospect.\n\n` +
		`Regards,\nAgent Amara`;

	// Send email via Postmark Edge Function
	await fetch(
		`${Deno.env.get('SUPABASE_URL')}/functions/v1/email-postmark-send`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
			},
			body: JSON.stringify({
				to: agent.email,
				subject,
				body,
			}),
		},
	);
}
