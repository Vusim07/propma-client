/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.5.0';

// Create a Supabase client with the Auth context of the function
const supabaseAdmin = createClient(
	Deno.env.get('SUPABASE_URL') ?? '',
	Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

Deno.serve(async (req) => {
	// Check for cron job or manual trigger
	const { method } = req;
	if (method === 'POST') {
		const { data, error } = await supabaseAdmin
			.from('subscriptions')
			.update({ current_usage: 0 })
			.eq('status', 'active')
			.is('end_date', null);

		if (error) {
			console.error('Error resetting usage:', error);
			return new Response(JSON.stringify({ error: error.message }), {
				headers: { 'Content-Type': 'application/json' },
				status: 500,
			});
		}

		return new Response(
			JSON.stringify({ success: true, updated: data?.length || 0 }),
			{ headers: { 'Content-Type': 'application/json' } },
		);
	}

	return new Response(JSON.stringify({ error: 'Method not allowed' }), {
		headers: { 'Content-Type': 'application/json' },
		status: 405,
	});
});
