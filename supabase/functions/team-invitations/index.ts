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

			// Get team info with subscription details
			const { data: team, error: teamError } = await supabase
				.from('teams')
				.select(
					`
          name,
          max_members,
          subscription:subscriptions (
            plan_name,
            status
          )
        `,
				)
				.eq('id', teamId)
				.single();

			if (teamError || !team) {
				throw new Error('Team not found');
			}

			// Verify subscription status
			if (!team.subscription || team.subscription.status !== 'active') {
				throw new Error('Team does not have an active subscription');
			}

			// Get current member count including pending invitations
			const [membersResult, invitationsResult] = await Promise.all([
				supabase
					.from('team_members')
					.select('*', { count: 'exact' })
					.eq('team_id', teamId),
				supabase
					.from('team_invitations')
					.select('*', { count: 'exact' })
					.eq('team_id', teamId)
					.eq('status', 'pending'),
			]);

			const totalMembers =
				(membersResult.count || 0) + (invitationsResult.count || 0);

			if (totalMembers >= team.max_members) {
				throw new Error(
					`Team member limit reached (${team.max_members} members). Upgrade your plan to add more members.`,
				);
			}

			// Check if email already has a pending invitation
			const { data: existingInvite } = await supabase
				.from('team_invitations')
				.select('*')
				.eq('team_id', teamId)
				.eq('email', email.toLowerCase())
				.eq('status', 'pending')
				.single();

			if (existingInvite) {
				throw new Error('An invitation has already been sent to this email');
			}

			// Check if user is already a team member
			const { data: existingMember } = await supabase
				.from('team_members')
				.select('*')
				.eq('team_id', teamId)
				.eq('user_id', (await supabase.auth.getUser(email)).data.user?.id || '')
				.single();

			if (existingMember) {
				throw new Error('User is already a member of this team');
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
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Team Invitation</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.4; margin: 0; padding: 0; color: #374151;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <img src="${frontendUrl}/assets/amara-logo-black.svg" alt="Amara Logo" style="width: 120px; margin-bottom: 24px;">
                
                <h1 style="margin: 0 0 16px; color: #1F2937; font-size: 24px;">
                  You've been invited to join a team on Amara
                </h1>
                
                <p style="margin: 0 0 24px; color: #4B5563;">
                  ${user.email} has invited you to join <strong>${team.name}</strong> on Amara, the AI-powered tenant screening platform for South African real estate professionals.
                </p>

                <div style="background-color: #F3F4F6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                  <p style="margin: 0; font-size: 14px; color: #4B5563;">
                    As a team member, you'll get access to:
                    <ul style="margin: 8px 0 0; padding-left: 20px;">
                      <li>Shared tenant screening reports</li>
                      <li>Team analytics dashboard</li>
                      <li>Collaborative document management</li>
                      <li>Team workflow automation</li>
                    </ul>
                  </p>
                </div>

                <a href="${inviteUrl}" style="display: inline-block; background-color: #2563EB; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
                  Join ${team.name}
                </a>

                <p style="margin: 24px 0 0; font-size: 14px; color: #6B7280;">
                  This invitation will expire in 7 days. If you don't have an Amara account yet, you'll be able to create one after clicking the button above.
                </p>

                <hr style="margin: 24px 0; border: 0; border-top: 1px solid #E5E7EB;">

                <p style="margin: 0; font-size: 12px; color: #9CA3AF;">
                  If you weren't expecting this invitation, you can safely ignore this email.
                </p>
              </div>
            </body>
          </html>
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

			// Get and validate invitation with team details
			const { data: invitation, error: inviteError } = await supabase
				.from('team_invitations')
				.select(
					`
          *,
          team:teams (
            id,
            name,
            max_members,
            subscription:subscriptions (
              plan_name,
              status
            )
          )
        `,
				)
				.eq('token', token)
				.eq('status', 'pending')
				.single();

			if (inviteError || !invitation) {
				throw new Error('Invalid or expired invitation');
			}

			// Verify team subscription and member limits
			if (!invitation.team.subscription?.status === 'active') {
				throw new Error('Team does not have an active subscription');
			}

			const { count: memberCount } = await supabase
				.from('team_members')
				.select('*', { count: 'exact' })
				.eq('team_id', invitation.team_id);

			if (memberCount >= invitation.team.max_members) {
				throw new Error(
					'Team has reached maximum member limit. Please contact the team admin.',
				);
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
