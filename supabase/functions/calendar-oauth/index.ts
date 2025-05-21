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
const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI') || '';

serve(async (req) => {
	// Process CORS first, before any other logic
	const corsResult = handleCors(req);

	// If this was an OPTIONS request, handleCors already returned a Response
	if (req.method === 'OPTIONS') {
		return corsResult;
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

	// Create a Supabase client with admin privileges
	const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	});

	const url = new URL(req.url);
	const params = url.searchParams;

	// Handle OAuth callback
	if (params.get('code')) {
		const code = params.get('code');
		const state = params.get('state');

		try {
			// Exchange code for tokens
			const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams({
					code: code || '',
					client_id: GOOGLE_CLIENT_ID,
					client_secret: GOOGLE_CLIENT_SECRET,
					redirect_uri: GOOGLE_REDIRECT_URI,
					grant_type: 'authorization_code',
				}),
			});

			const tokenData = await tokenResponse.json();

			if (!tokenData.refresh_token) {
				throw new Error('No refresh token received');
			}

			// Get user ID from state parameter
			const userId = state || '';

			// Save tokens to database
			const { error } = await supabaseAdmin
				.from('calendar_integrations')
				.upsert({
					user_id: userId,
					provider: 'google',
					refresh_token: tokenData.refresh_token,
					access_token: tokenData.access_token,
					token_expiry: new Date(
						Date.now() + tokenData.expires_in * 1000,
					).toISOString(),
				});

			if (error) throw error;

			// Redirect to calendar settings page
			return Response.redirect(
				`${Deno.env.get(
					'FRONTEND_URL',
				)}/agent/calendar-settings?connected=true`,
				302,
			);
		} catch (error) {
			console.error('OAuth error:', error);
			return Response.redirect(
				`${Deno.env.get('FRONTEND_URL')}/agent/calendar-settings?error=true`,
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

		// Verify the JWT token directly
		const {
			data: { user },
			error: jwtError,
		} = await supabaseAdmin.auth.getUser(token);

		if (!jwtError && user) {
			// Make sure user ID in the URL matches the authenticated user
			if (user.id !== userId) {
				return new Response(
					JSON.stringify({
						error: 'Unauthorized',
						details: 'User ID does not match authenticated user',
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
		}
	}

	// Generate state (includes user ID)
	const state = userId;

	// Create authorization URL
	const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams(
		{
			client_id: GOOGLE_CLIENT_ID,
			redirect_uri: GOOGLE_REDIRECT_URI,
			response_type: 'code',
			scope: 'https://www.googleapis.com/auth/calendar',
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
