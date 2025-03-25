/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// Deno-specific imports that won't be resolved by the TS compiler in VS Code
// but will work in the Supabase Edge Function environment
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

// Define CORS headers
const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers':
		'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
	// Handle CORS preflight request
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	try {
		// Only accept POST requests
		if (req.method !== 'POST') {
			return new Response(JSON.stringify({ error: 'Method not allowed' }), {
				status: 405,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// Create a Supabase client with the service role key which bypasses RLS
		const supabaseAdmin = createClient(
			Deno.env.get('SUPABASE_URL') ?? '',
			Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
			{
				auth: {
					autoRefreshToken: false,
					persistSession: false,
				},
			},
		);

		// Get the request body and log it for debugging
		let requestData;
		try {
			requestData = await req.json();
			console.log('Received request data:', JSON.stringify(requestData));
		} catch (parseError) {
			console.error('Failed to parse request JSON:', parseError);
			return new Response(
				JSON.stringify({
					error: 'Invalid JSON in request body',
					details: parseError.message,
				}),
				{
					status: 400,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				},
			);
		}

		// Handle different action types
		if (requestData.action === 'cleanup') {
			// Delete a temporary profile
			const { tempId } = requestData;
			if (!tempId) {
				return new Response(
					JSON.stringify({ error: 'Missing tempId for cleanup' }),
					{
						status: 400,
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					},
				);
			}

			const { error } = await supabaseAdmin
				.from('profiles')
				.delete()
				.eq('id', tempId);

			if (error) {
				console.error('Error cleaning up profile:', error);
			}

			return new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		if (requestData.action === 'update-id') {
			// Update profile ID (after auth signup)
			const { oldId, newId, email } = requestData;
			if (!oldId || !newId || !email) {
				return new Response(
					JSON.stringify({ error: 'Missing required fields for ID update' }),
					{
						status: 400,
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					},
				);
			}

			// First check if newId already has a profile
			const { data: existingProfile } = await supabaseAdmin
				.from('profiles')
				.select('id')
				.eq('id', newId)
				.maybeSingle();

			if (existingProfile) {
				// No need to update, already has a profile
				return new Response(
					JSON.stringify({ success: true, message: 'Profile already exists' }),
					{
						status: 200,
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					},
				);
			}

			// Update the ID of the temporary profile
			const { data, error } = await supabaseAdmin
				.from('profiles')
				.update({ id: newId })
				.eq('id', oldId)
				.eq('email', email) // Make sure email matches as a safety check
				.select()
				.single();

			if (error) {
				console.error('Error updating profile ID:', error);
				return new Response(JSON.stringify({ error: error.message }), {
					status: 500,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			}

			return new Response(JSON.stringify(data), {
				status: 200,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// Simplified profile update logic
		const { id, email, first_name, last_name, role, phone, company_name } =
			requestData;

		// Check for required fields
		if (!id) {
			console.error('Missing user ID in request');
			return new Response(
				JSON.stringify({
					error: 'Missing user ID',
					received: requestData,
				}),
				{
					status: 400,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				},
			);
		}

		// Validate and normalize email
		if (!email || typeof email !== 'string' || !email.includes('@')) {
			console.error('Invalid email in request:', email);
			return new Response(
				JSON.stringify({
					error: 'Valid email is required',
					details: `Received: ${
						email === null ? 'null' : typeof email
					} - ${email}`,
					data: requestData,
				}),
				{
					status: 400,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				},
			);
		}

		const normalizedEmail = email.trim().toLowerCase();
		console.log(
			`Processing profile update for user ${id} with email ${normalizedEmail}`,
		);

		// Update the profile (it should already exist from the auth trigger)
		const { data, error } = await supabaseAdmin
			.from('profiles')
			.update({
				email: normalizedEmail,
				first_name: first_name || '',
				last_name: last_name || '',
				role: role || 'tenant',
				phone: phone || null,
				company_name: company_name || null,
			})
			.eq('id', id)
			.select()
			.single();

		if (error) {
			console.error('Error updating profile:', error);
			return new Response(
				JSON.stringify({ error: error.message, details: error }),
				{
					status: 500,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				},
			);
		}

		console.log('Profile updated successfully');
		return new Response(JSON.stringify(data), {
			status: 200,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	} catch (error) {
		console.error('Server error:', error);
		return new Response(
			JSON.stringify({
				error: 'Internal server error',
				details: error.message || 'Unknown error',
			}),
			{
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			},
		);
	}
});
