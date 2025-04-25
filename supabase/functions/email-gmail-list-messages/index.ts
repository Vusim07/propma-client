/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const handleCors = (req) => {
	const origin = req.headers.get('Origin') || 'http://localhost:5173';
	const headers = {
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

	// Fetch messages
	const gmailRes = await fetch(
		'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10',
		{
			headers: { Authorization: `Bearer ${accessToken}` },
		},
	);
	const gmailData = await gmailRes.json();
	if (!gmailData.messages) {
		return new Response(JSON.stringify({ emails: [] }), {
			status: 200,
			headers: { ...corsResult, 'Content-Type': 'application/json' },
		});
	}

	// Fetch message details
	const emails = [];
	for (const msg of gmailData.messages) {
		const msgRes = await fetch(
			`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
			{
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		);
		const msgData = await msgRes.json();
		const headers = msgData.payload.headers;
		const subject = headers.find((h) => h.name === 'Subject')?.value || '';
		const from = headers.find((h) => h.name === 'From')?.value || '';
		const date = headers.find((h) => h.name === 'Date')?.value || '';
		let body = '';
		if (msgData.payload.parts) {
			const part = msgData.payload.parts.find(
				(p) => p.mimeType === 'text/plain',
			);
			if (part && part.body && part.body.data) {
				body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
			}
		} else if (msgData.payload.body && msgData.payload.body.data) {
			body = atob(
				msgData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'),
			);
		}
		emails.push({ id: msg.id, subject, from, date, body });
	}

	return new Response(JSON.stringify({ emails }), {
		status: 200,
		headers: { ...corsResult, 'Content-Type': 'application/json' },
	});
});
