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
	const CREW_API_URL = Deno.env.get('CREW_API_URL'); // e.g. https://amara-ai.yourdomain.com/api/process-email

	const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

	// Fetch all users with active Gmail integrations
	const { data: integrations, error: integrationsError } = await supabase
		.from('email_integrations')
		.select('*')
		.eq('provider', 'gmail');

	if (integrationsError) {
		return new Response(JSON.stringify({ error: integrationsError.message }), {
			status: 500,
			headers: { ...corsResult, 'Content-Type': 'application/json' },
		});
	}

	const results = [];
	for (const integration of integrations) {
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

		// Fetch workflows for this agent
		const { data: workflows, error: workflowsError } = await supabase
			.from('email_workflows')
			.select('*')
			.eq('agent_id', integration.user_id)
			.eq('active', true);
		if (workflowsError) continue;

		// Fetch agent properties
		const { data: properties, error: propertiesError } = await supabase
			.from('properties')
			.select('*')
			.eq('agent_id', integration.user_id);
		if (propertiesError) continue;

		// Fetch recent emails
		const gmailRes = await fetch(
			'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10',
			{
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		);
		const gmailData = await gmailRes.json();
		if (!gmailData.messages) continue;

		for (const msg of gmailData.messages) {
			const msgRes = await fetch(
				`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
				{
					headers: { Authorization: `Bearer ${accessToken}` },
				},
			);
			const msgData = await msgRes.json();
			const headers = msgData.payload.headers;
			const subject =
				headers.find((h) => h.name.toLowerCase() === 'subject')?.value ||
				'No Subject';
			const from =
				headers.find((h) => h.name.toLowerCase() === 'from')?.value || '';
			const date =
				headers.find((h) => h.name.toLowerCase() === 'date')?.value || '';

			let body = '';
			if (msgData.payload.parts) {
				const part = msgData.payload.parts.find(
					(p) => p.mimeType === 'text/plain',
				);
				if (part && part.body && part.body.data) {
					body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
				} else {
					// Try to find an HTML part if plain text is not available
					const htmlPart = msgData.payload.parts.find(
						(p) => p.mimeType === 'text/html',
					);
					if (htmlPart && htmlPart.body && htmlPart.body.data) {
						body = atob(
							htmlPart.body.data.replace(/-/g, '+').replace(/_/g, '/'),
						);
						// Strip HTML tags for plain text
						body = body.replace(/<[^>]+>/g, '');
					}
				}
			} else if (msgData.payload.body && msgData.payload.body.data) {
				body = atob(
					msgData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'),
				);
			}

			// For each workflow, check if this email matches
			for (const workflow of workflows) {
				const subjectMatch = workflow.email_filter?.subject_contains?.some(
					(s) => subject.toLowerCase().includes(s.toLowerCase()),
				);
				const bodyMatch = workflow.email_filter?.body_contains?.some((b) =>
					body.toLowerCase().includes(b.toLowerCase()),
				);
				if (subjectMatch || bodyMatch) {
					// Call Amara AI /api/process-email endpoint
					await fetch(`${CREW_API_URL}/process-email`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							agent_id: integration.user_id,
							workflow_id: workflow.id,
							email_content: body,
							email_subject: subject,
							email_from: from,
							email_date: date,
							agent_properties: properties,
							workflow_actions: workflow.actions,
						}),
					});
					results.push({
						user_id: integration.user_id,
						email_id: msg.id,
						workflow_id: workflow.id,
						matched: true,
					});
				}
			}
		}
	}

	return new Response(JSON.stringify({ processed: results.length, results }), {
		status: 200,
		headers: { ...corsResult, 'Content-Type': 'application/json' },
	});
});
