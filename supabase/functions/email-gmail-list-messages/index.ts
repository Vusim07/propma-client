/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { decodeBase64 } from 'https://deno.land/std@0.207.0/encoding/base64.ts';

// Configure allowed origins from environment
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

serve(async (req) => {
	const corsResult = handleCors(req);
	if (req.method === 'OPTIONS') return corsResult;

	try {
		const {
			SUPABASE_URL,
			SUPABASE_SERVICE_ROLE_KEY,
			GOOGLE_CLIENT_ID,
			GOOGLE_CLIENT_SECRET,
			CREW_API_URL,
		} = Deno.env.toObject();

		const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
			auth: { persistSession: false },
		});

		// Fetch active Gmail integrations with error handling
		const { data: integrations, error: integrationsError } = await supabase
			.from('email_integrations')
			.select('*')
			.eq('provider', 'gmail')
			.eq('active', true);

		if (integrationsError)
			throw new Error(`Integrations error: ${integrationsError.message}`);

		const processingQueue = [];

		for (const integration of integrations) {
			try {
				// Token refresh logic
				let accessToken = integration.access_token;
				if (
					integration.token_expiry &&
					new Date(integration.token_expiry) < new Date()
				) {
					const refreshRes = await fetch(
						'https://oauth2.googleapis.com/token',
						{
							method: 'POST',
							headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
							body: new URLSearchParams({
								client_id: GOOGLE_CLIENT_ID,
								client_secret: GOOGLE_CLIENT_SECRET,
								refresh_token: integration.refresh_token,
								grant_type: 'refresh_token',
							}),
						},
					);

					if (!refreshRes.ok) {
						console.error('Token refresh failed:', await refreshRes.text());
						continue;
					}

					const tokens = await refreshRes.json();
					accessToken = tokens.access_token;

					const { error: updateError } = await supabase
						.from('email_integrations')
						.update({
							access_token: tokens.access_token,
							token_expiry: new Date(
								Date.now() + (tokens.expires_in || 3600) * 1000,
							),
						})
						.eq('id', integration.id);

					if (updateError)
						throw new Error(`Token update failed: ${updateError.message}`);
				}

				// Parallel processing setup
				const userQueue = {
					integration,
					accessToken,
					workflows: [],
					properties: [],
					messages: [],
				};

				// Fetch workflows and properties in parallel
				await Promise.all([
					supabase
						.from('email_workflows')
						.select('*')
						.eq('agent_id', integration.user_id)
						.eq('active', true)
						.then(({ data, error }) => {
							if (error) console.error('Workflow error:', error);
							else userQueue.workflows = data;
						}),

					supabase
						.from('properties')
						.select('*')
						.eq('agent_id', integration.user_id)
						.then(({ data, error }) => {
							if (error) console.error('Properties error:', error);
							else userQueue.properties = data;
						}),
				]);

				// Fetch recent emails with pagination
				const gmailRes = await fetch(
					'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20',
					{ headers: { Authorization: `Bearer ${accessToken}` } },
				);

				if (!gmailRes.ok) {
					console.error('Gmail fetch failed:', await gmailRes.text());
					continue;
				}

				const gmailData = await gmailRes.json();
				userQueue.messages = gmailData.messages?.slice(0, 20) || [];
				processingQueue.push(userQueue);
			} catch (err) {
				console.error(`Integration ${integration.id} failed:`, err);
			}
		}

		// Process all queues in parallel
		const results = await Promise.all(
			processingQueue.map(async (queue) => {
				const userResults = [];

				await Promise.all(
					queue.messages.map(async (msg) => {
						try {
							// Check for existing processing
							const { data: existing } = await supabase
								.from('processed_emails')
								.select('id')
								.eq('email_id', msg.id)
								.limit(1);

							if (existing?.length) return;

							// Fetch full message
							const msgRes = await fetch(
								`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
								{
									headers: {
										Authorization: `Bearer ${queue.accessToken}`,
										// 'X-Request-Id': corsResult.headers['X-Request-Id'],
									},
								},
							);

							if (!msgRes.ok) {
								console.error('Message fetch failed:', await msgRes.text());
								return;
							}

							const msgData = await msgRes.json();
							const headers = msgData.payload.headers || [];

							const getHeader = (name) =>
								headers.find((h) => h.name.toLowerCase() === name.toLowerCase())
									?.value || '';

							const subject = getHeader('subject');
							const from = getHeader('from');
							const date = getHeader('date');

							// Improved base64 decoding
							let body = '';
							const decodePart = (part) => {
								try {
									return new TextDecoder().decode(decodeBase64(part.body.data));
								} catch {
									return atob(
										part.body.data.replace(/-/g, '+').replace(/_/g, '/'),
									);
								}
							};

							if (msgData.payload.parts) {
								const textPart = msgData.payload.parts.find(
									(p) => p.mimeType === 'text/plain',
								);
								const htmlPart = msgData.payload.parts.find(
									(p) => p.mimeType === 'text/html',
								);

								if (textPart?.body?.data) {
									body = decodePart(textPart);
								} else if (htmlPart?.body?.data) {
									body = decodePart(htmlPart).replace(/<[^>]+>/g, '');
								}
							} else if (msgData.payload.body?.data) {
								body = decodePart(msgData.payload);
							}

							// Workflow matching
							for (const workflow of queue.workflows) {
								const subjectMatch =
									workflow.email_filter?.subject_contains?.some((s) =>
										subject.toLowerCase().includes(s.toLowerCase()),
									);

								const bodyMatch = workflow.email_filter?.body_contains?.some(
									(b) => body.toLowerCase().includes(b.toLowerCase()),
								);

								if (subjectMatch || bodyMatch) {
									const controller = new AbortController();
									const timeout = setTimeout(() => controller.abort(), 10000);

									try {
										const crewRes = await fetch(
											`${CREW_API_URL}/process-email`,
											{
												method: 'POST',
												headers: {
													'Content-Type': 'application/json',
												},
												body: JSON.stringify({
													agent_id: queue.integration.user_id,
													workflow_id: workflow.id,
													email_content: body.substring(0, 5000),
													email_subject: subject,
													email_from: from,
													email_date: date,
													agent_properties: queue.properties,
													workflow_actions: workflow.actions,
												}),
												signal: controller.signal,
											},
										);

										if (!crewRes.ok) {
											console.error('Crew API failed:', await crewRes.text());
											continue;
										}

										await supabase.from('processed_emails').insert({
											email_id: msg.id,
											workflow_id: workflow.id,
											processed_at: new Date().toISOString(),
										});

										userResults.push({
											user_id: queue.integration.user_id,
											email_id: msg.id,
											workflow_id: workflow.id,
											success: true,
										});
									} catch (err) {
										console.error('Processing failed:', err);
										userResults.push({
											user_id: queue.integration.user_id,
											email_id: msg.id,
											error: err.message,
										});
									} finally {
										clearTimeout(timeout);
									}
								}
							}
						} catch (err) {
							console.error('Message processing failed:', err);
						}
					}),
				);

				return userResults;
			}),
		);

		return new Response(
			JSON.stringify({
				processed: results.flat().length,
				results: results.flat(),
				// request_id: corsResult.headers['X-Request-Id'],
			}),
			{
				status: 200,
				headers: {
					...corsResult,
					'Content-Type': 'application/json',
					// 'X-Request-Id': corsResult.headers['X-Request-Id'],
				},
			},
		);
	} catch (err) {
		console.error('Fatal error:', err);
		return new Response(
			JSON.stringify({
				error: 'Internal server error',
				// request_id: corsResult.headers['X-Request-Id'],
			}),
			{
				status: 500,
				headers: { ...corsResult, 'Content-Type': 'application/json' },
			},
		);
	}
});
