/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

// CORS handler (same as calendar-oauth)
const handleCors = (req) => {
	const origin = req.headers.get('Origin') || 'http://localhost:5173';
	const headers = {
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers':
			'authorization, x-client-info, apikey, content-type',
		'Access-Control-Allow-Credentials': 'true',
	};
	if (req.method === 'OPTIONS') {
		return new Response(null, { headers, status: 204 });
	}
	return headers;
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_GMAIL_REDIRECT_URI') || '';
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || '';

serve(async (req) => {
	const corsResult = handleCors(req);
	if (req.method === 'OPTIONS') return corsResult;

	// Get Supabase admin client
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
				headers: { ...corsResult, 'Content-Type': 'application/json' },
			},
		);
	}
	const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
		auth: { autoRefreshToken: false, persistSession: false },
	});

	const url = new URL(req.url);
	const params = url.searchParams;

	// OAuth callback
	if (params.get('code')) {
		const code = params.get('code');
		const state = params.get('state');
		try {
			// Exchange code for tokens
			const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					code: code || '',
					client_id: GOOGLE_CLIENT_ID,
					client_secret: GOOGLE_CLIENT_SECRET,
					redirect_uri: GOOGLE_REDIRECT_URI,
					grant_type: 'authorization_code',
				}),
			});
			const tokenData = await tokenResponse.json();
			if (!tokenData.refresh_token)
				throw new Error('No refresh token received');
			const userId = state || '';
			// Get user's email address from Gmail profile
			let email_address = null;
			if (tokenData.access_token) {
				const profileRes = await fetch(
					'https://gmail.googleapis.com/gmail/v1/users/me/profile',
					{
						headers: { Authorization: `Bearer ${tokenData.access_token}` },
					},
				);
				if (profileRes.ok) {
					const profile = await profileRes.json();
					email_address = profile.emailAddress || null;
				}
			}
			// Upsert into email_integrations
			const { error } = await supabaseAdmin.from('email_integrations').upsert({
				user_id: userId,
				provider: 'gmail',
				refresh_token: tokenData.refresh_token,
				access_token: tokenData.access_token,
				token_expiry: new Date(
					Date.now() + tokenData.expires_in * 1000,
				).toISOString(),
				email_address,
			});
			if (error) throw error;
			// Redirect to frontend
			return Response.redirect(
				`${FRONTEND_URL}/agent/settings?connected=gmail`,
				302,
			);
		} catch (error) {
			console.error('OAuth error:', error);
			return Response.redirect(
				`${FRONTEND_URL}/agent/settings?error=gmail`,
				302,
			);
		}
	}

	// Generate OAuth URL
	const userId = params.get('user_id');
	if (!userId) {
		return new Response(
			JSON.stringify({ error: 'Missing user_id parameter' }),
			{
				status: 400,
				headers: { ...corsResult, 'Content-Type': 'application/json' },
			},
		);
	}

	// Authenticate the user if we have an Authorization header
	const authHeader = req.headers.get('Authorization');
	if (authHeader) {
		const token = authHeader.replace('Bearer ', '');
		const {
			data: { user },
			error: jwtError,
		} = await supabaseAdmin.auth.getUser(token);
		if (!jwtError && user) {
			if (user.id !== userId) {
				return new Response(
					JSON.stringify({
						error: 'Unauthorized',
						details: 'User ID does not match authenticated user',
					}),
					{
						status: 401,
						headers: { ...corsResult, 'Content-Type': 'application/json' },
					},
				);
			}
		}
	}

	// Generate state (includes user ID)
	const state = userId;
	// Gmail OAuth scopes for read/send
	const scope = [
		'https://www.googleapis.com/auth/gmail.readonly',
		'https://www.googleapis.com/auth/gmail.send',
		'https://www.googleapis.com/auth/userinfo.email',
		'openid',
		'email',
		'profile',
	].join(' ');
	const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams(
		{
			client_id: GOOGLE_CLIENT_ID,
			redirect_uri: GOOGLE_REDIRECT_URI,
			response_type: 'code',
			scope,
			access_type: 'offline',
			prompt: 'consent',
			state,
		},
	)}`;
	return new Response(JSON.stringify({ url: authUrl }), {
		status: 200,
		headers: { ...corsResult, 'Content-Type': 'application/json' },
	});
});
