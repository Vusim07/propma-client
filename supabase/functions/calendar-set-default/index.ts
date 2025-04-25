/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// Deno-specific imports that won't be resolved by the TS compiler in VS Code
// but will work in the Supabase Edge Function environment
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
	// Handle CORS
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	try {
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

		// Get the calendar integration for the user
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

		// Update the default calendar ID
		const { error: updateError } = await supabaseAdmin
			.from('calendar_integrations')
			.update({ calendar_id })
			.eq('id', integration.id);

		if (updateError) {
			throw updateError;
		}

		return new Response(
			JSON.stringify({
				success: true,
				message: 'Default calendar updated successfully',
				calendar_id,
			}),
			{
				status: 200,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			},
		);
	}
});
