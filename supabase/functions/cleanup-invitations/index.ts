/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

// CORS handler
const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers':
		'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
	// Handle CORS
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	try {
		// Get environment variables
		const supabaseUrl = Deno.env.get('SUPABASE_URL');
		const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

		if (!supabaseUrl || !supabaseServiceKey) {
			throw new Error('Missing required environment variables');
		}

		// Initialize Supabase client with service role key
		const supabase = createClient(supabaseUrl, supabaseServiceKey);

		// Get all expired invitations
		const { data: expiredInvitations, error: fetchError } = await supabase
			.from('team_invitations')
			.select('id, team_id, email, expires_at')
			.lt('expires_at', new Date().toISOString())
			.eq('status', 'pending');

		if (fetchError) {
			throw fetchError;
		}

		if (!expiredInvitations?.length) {
			return new Response(
				JSON.stringify({
					message: 'No expired invitations found',
					processed: 0,
				}),
				{
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					status: 200,
				},
			);
		}

		// Update expired invitations to 'expired' status
		const { error: updateError } = await supabase
			.from('team_invitations')
			.update({ status: 'expired' })
			.in(
				'id',
				expiredInvitations.map((inv) => inv.id),
			);

		if (updateError) {
			throw updateError;
		}

		// Log cleanup activity
		const { error: logError } = await supabase
			.from('team_activity_logs')
			.insert(
				expiredInvitations.map((inv) => ({
					team_id: inv.team_id,
					action: 'invitation_expired',
					details: {
						email: inv.email,
						expires_at: inv.expires_at,
					},
				})),
			);

		if (logError) {
			console.error('Failed to log cleanup activity:', logError);
		}

		return new Response(
			JSON.stringify({
				success: true,
				message: `Processed ${expiredInvitations.length} expired invitations`,
				processed: expiredInvitations.length,
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				status: 200,
			},
		);
	} catch (error) {
		console.error('Error in cleanup-invitations:', error);

		return new Response(
			JSON.stringify({
				error: error.message,
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				status: 500,
			},
		);
	}
});
