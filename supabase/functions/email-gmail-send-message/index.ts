/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const handleCors = (req) => {
	const origin = req.headers.get('Origin') || 'http://localhost:5173';
	const headers = {
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Access-Control-Allow-Headers':
			'authorization, x-client-info, apikey, content-type',
		'Access-Control-Allow-Credentials': 'true',
	};
	if (req.method === 'OPTIONS')
		return new Response(null, { headers, status: 204 });
	return headers;
};

serve(async (req) => {
	const corsResult = handleCors(req);
	if (req.method === 'OPTIONS') return corsResult;

	if (req.method !== 'POST') {
		return new Response(JSON.stringify({ error: 'Method not allowed' }), {
			status: 405,
			headers: { ...corsResult, 'Content-Type': 'application/json' },
		});
	}

	const supabaseUrl = Deno.env.get('SUPABASE_URL');
	const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
	const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
	const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

	const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

	// JWT validation
	const authHeader = req.headers.get('Authorization');
	if (!authHeader) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { ...corsResult, 'Content-Type': 'application/json' },
		});
	}
	const token = authHeader.replace('Bearer ', '');
	const {
		data: { user },
		error: jwtError,
	} = await supabase.auth.getUser(token);
	if (jwtError || !user) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { ...corsResult, 'Content-Type': 'application/json' },
		});
	}

	// Get integration
	const { data: integration, error: integrationError } = await supabase
		.from('email_integrations')
		.select('*')
		.eq('user_id', user.id)
		.eq('provider', 'gmail')
		.single();

	if (integrationError || !integration) {
		return new Response(
			JSON.stringify({ error: 'No Gmail integration found' }),
			{
				status: 404,
				headers: { ...corsResult, 'Content-Type': 'application/json' },
			},
		);
	}

	// Refresh token if needed
	let accessToken = integration.access_token;
	if (
		integration.token_expiry &&
		new Date(integration.token_expiry) < new Date()
	) {
		const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				client_id: GOOGLE_CLIENT_ID,
				client_secret: GOOGLE_CLIENT_SECRET,
				refresh_token: integration.refresh_token,
				grant_type: 'refresh_token',
			}),
		});
		const tokens = await refreshRes.json();
		if (tokens.access_token) {
			accessToken = tokens.access_token;
			await supabase
				.from('email_integrations')
				.update({
					access_token: tokens.access_token,
					token_expiry: new Date(
						Date.now() + (tokens.expires_in || 3600) * 1000,
					).toISOString(),
				})
				.eq('id', integration.id);
		}
	}

	// Parse request body
	const { to, subject, body } = await req.json();

	// Construct raw email
	const messageParts = [
		'Content-Type: text/plain; charset=utf-8',
		'MIME-Version: 1.0',
		`To: ${to}`,
		`Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=`, // Properly encode subject
		'',
		body,
	];
	const message = messageParts.join('\r\n');

	const encodedMessage = btoa(message)
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');

	// Send email
	const gmailRes = await fetch(
		'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
		{
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ raw: encodedMessage }),
		},
	);

	if (!gmailRes.ok) {
		const errorText = await gmailRes.text();
		return new Response(JSON.stringify({ error: errorText }), {
			status: 500,
			headers: { ...corsResult, 'Content-Type': 'application/json' },
		});
	}

	return new Response(JSON.stringify({ success: true }), {
		status: 200,
		headers: { ...corsResult, 'Content-Type': 'application/json' },
	});
});
