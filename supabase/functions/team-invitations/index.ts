/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Resend } from 'https://esm.sh/@resend/node@0.16.0';

// CORS handler
const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers':
		'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface InviteRequest {
	teamId: string;
	email: string;
	role: 'admin' | 'member';
}

interface AcceptRequest {
	token: string;
}

serve(async (req) => {
	// Handle CORS
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	try {
		// Get environment variables
		const supabaseUrl = Deno.env.get('SUPABASE_URL');
		const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
		const resendApiKey = Deno.env.get('RESEND_API_KEY');
		const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:5173';

		if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
			throw new Error('Missing required environment variables');
		}

		// Initialize Supabase client
		const supabase = createClient(supabaseUrl, supabaseServiceKey);
		const resend = new Resend(resendApiKey);

		// Verify authentication
		const authHeader = req.headers.get('Authorization');
		if (!authHeader) {
			throw new Error('Missing Authorization header');
		}

		const token = authHeader.replace('Bearer ', '');
		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser(token);

		if (authError || !user) {
			throw new Error('Invalid authentication');
		}

		const { pathname } = new URL(req.url);

		// Handle invite creation
		if (pathname.endsWith('/send')) {
			const { teamId, email, role }: InviteRequest = await req.json();

			// Validate request
			if (!teamId || !email || !role) {
				throw new Error('Missing required fields');
			}

			// Check if user is team admin
			const { data: memberData, error: memberError } = await supabase
				.from('team_members')
				.select('role')
				.eq('team_id', teamId)
				.eq('user_id', user.id)
				.single();

			if (memberError || !memberData || memberData.role !== 'admin') {
				throw new Error('Only team admins can send invitations');
			}

			// Get team info
			const { data: team, error: teamError } = await supabase
				.from('teams')
				.select('name, max_members')
				.eq('id', teamId)
				.single();

			if (teamError || !team) {
				throw new Error('Team not found');
			}

			// Check member limit
			const { count, error: countError } = await supabase
				.from('team_members')
				.select('*', { count: 'exact' })
				.eq('team_id', teamId);

			if (countError || (count && count >= team.max_members)) {
				throw new Error('Team member limit reached');
			}

			// Create invitation
			const inviteToken = crypto.randomUUID();
			const expiresAt = new Date();
			expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

			const { error: inviteError } = await supabase
				.from('team_invitations')
				.insert({
					team_id: teamId,
					email: email.toLowerCase(),
					role,
					token: inviteToken,
					expires_at: expiresAt.toISOString(),
					created_by: user.id,
					status: 'pending',
				});

			if (inviteError) {
				throw new Error('Failed to create invitation');
			}

			// Send invitation email
			const inviteUrl = `${frontendUrl}/join-team?token=${inviteToken}`;
			await resend.emails.send({
				from: 'Amara <noreply@getamara.co.za>',
				to: email,
				subject: `Join ${team.name} on Amara`,
				html: `
          <h2>You've been invited to join ${team.name}</h2>
          <p>Click the link below to join the team:</p>
          <p><a href="${inviteUrl}">${inviteUrl}</a></p>
          <p>This invitation will expire in 7 days.</p>
        `,
			});

			return new Response(JSON.stringify({ success: true }), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// Handle invite acceptance
		if (pathname.endsWith('/accept')) {
			const { token }: AcceptRequest = await req.json();

			if (!token) {
				throw new Error('Missing invitation token');
			}

			// Get and validate invitation
			const { data: invitation, error: inviteError } = await supabase
				.from('team_invitations')
				.select('*')
				.eq('token', token)
				.eq('status', 'pending')
				.single();

			if (inviteError || !invitation) {
				throw new Error('Invalid or expired invitation');
			}

			if (new Date(invitation.expires_at) < new Date()) {
				throw new Error('Invitation has expired');
			}

			if (invitation.email !== user.email.toLowerCase()) {
				throw new Error('Invitation email does not match your account');
			}

			// Add user to team
			const { error: memberError } = await supabase
				.from('team_members')
				.insert({
					team_id: invitation.team_id,
					user_id: user.id,
					role: invitation.role,
				});

			if (memberError) {
				throw new Error('Failed to add user to team');
			}

			// Update invitation status
			await supabase
				.from('team_invitations')
				.update({ status: 'accepted' })
				.eq('id', invitation.id);

			// Set as active team for the user
			await supabase
				.from('users')
				.update({ active_team_id: invitation.team_id })
				.eq('id', user.id);

			return new Response(
				JSON.stringify({
					success: true,
					teamId: invitation.team_id,
				}),
				{
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				},
			);
		}

		throw new Error('Invalid endpoint');
	} catch (error) {
		return new Response(
			JSON.stringify({
				error: error.message,
			}),
			{
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			},
		);
	}
});
