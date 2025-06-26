/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { authenticateRequest } from './auth.ts';
import { processIncomingEmail } from './handlers/emailHandler.ts';

serve(async (req) => {
	// Handle authentication
	const authResponse = await authenticateRequest(req);
	if (authResponse) return authResponse;

	try {
		// Create Supabase client
		const supabaseClient = createClient(
			Deno.env.get('SUPABASE_URL') ?? '',
			Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
		);

		// Process the email
		const result = await processIncomingEmail(req, supabaseClient);

		return new Response(
			JSON.stringify({
				success: true,
				message: 'Email processed successfully',
				...result,
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				status: 200,
			},
		);
	} catch (error) {
		console.error('Error processing webhook:', error);
		return new Response(
			JSON.stringify({
				error: 'Internal server error',
				message: error.message,
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				status: 500,
			},
		);
	}
});
