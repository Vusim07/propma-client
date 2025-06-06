/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { verifySNSSignature, retryOperation } from './utils.ts';
import { parseEmailContent } from './emailParser.ts';
import { storeEmailWithRetry } from './emailStorage.ts';
import { SNSMessage } from './types.ts';
import { amaraAI } from './amaraAI.ts';

serve(async (req) => {
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	try {
		console.log('Received request method:', req.method);
		console.log('Request headers:', Object.fromEntries(req.headers.entries()));
		console.log('Request URL:', req.url);

		const url = new URL(req.url);
		const authToken =
			url.searchParams.get('auth') || req.headers.get('x-webhook-secret');
		const webhookSecret = Deno.env.get('WEBHOOK_SECRET');

		console.log('Received authToken:', authToken);
		console.log('Expected webhookSecret:', webhookSecret);

		if (!authToken || !webhookSecret || authToken !== webhookSecret) {
			console.error('Invalid or missing authentication token');
			return new Response(
				JSON.stringify({
					error: 'Unauthorized',
					message: 'Invalid or missing authentication token',
				}),
				{
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					status: 401,
				},
			);
		}

		console.log('Authentication successful');

		const requestBody = await req.text();
		console.log('Raw request body:', requestBody);

		let parsedBody;
		try {
			parsedBody = JSON.parse(requestBody);
		} catch (parseError) {
			console.error('Failed to parse request body as JSON:', parseError);
			throw new Error('Invalid JSON in request body');
		}

		const isSNS =
			parsedBody.Type === 'SubscriptionConfirmation' ||
			parsedBody.Type === 'Notification' ||
			parsedBody.Type === 'UnsubscribeConfirmation';
		const isRawSES =
			parsedBody.notificationType === 'Received' && parsedBody.mail;

		let sesNotification;
		let supabaseClient;

		if (isSNS) {
			const snsMessage: SNSMessage = parsedBody;
			console.log('Parsed SNS message:', JSON.stringify(snsMessage, null, 2));

			switch (snsMessage.Type) {
				case 'SubscriptionConfirmation': {
					console.log('Processing subscription confirmation...');

					if (!snsMessage.SubscribeURL) {
						throw new Error(
							'Missing SubscribeURL in subscription confirmation',
						);
					}

					try {
						const confirmResponse = await fetch(snsMessage.SubscribeURL);
						if (!confirmResponse.ok) {
							throw new Error(
								`Failed to confirm subscription: ${confirmResponse.statusText}`,
							);
						}
						const data = await confirmResponse.text();
						console.log('SNS subscription confirmed:', data);

						return new Response(
							JSON.stringify({
								success: true,
								message: 'SNS subscription confirmed successfully',
							}),
							{
								headers: { ...corsHeaders, 'Content-Type': 'application/json' },
								status: 200,
							},
						);
					} catch (error) {
						console.error('Error confirming subscription:', error);
						throw new Error('Failed to confirm SNS subscription');
					}
				}

				case 'Notification': {
					console.log('Starting SNS signature verification...');
					const isValid = await verifySNSSignature(snsMessage);
					console.log('SNS signature valid:', isValid);

					if (!isValid) {
						console.error('Invalid SNS signature');
						return new Response(
							JSON.stringify({ error: 'Invalid SNS signature' }),
							{
								headers: { ...corsHeaders, 'Content-Type': 'application/json' },
								status: 403,
							},
						);
					}

					console.log('Processing SES notification...');
					sesNotification = JSON.parse(snsMessage.Message);
					console.log(
						'SES Notification:',
						JSON.stringify(sesNotification, null, 2),
					);

					supabaseClient = createClient(
						Deno.env.get('SUPABASE_URL') ?? '',
						Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
					);

					for (const record of sesNotification.Records) {
						try {
							const { mail, receipt } = record.ses;
							const { messageId, source, destination, commonHeaders } = mail;
							const { timestamp, spamVerdict, virusVerdict, action } = receipt;

							console.log(
								`Processing message ${messageId} from ${source} to ${destination}`,
							);

							if (
								spamVerdict.status === 'FAILED' ||
								virusVerdict.status === 'FAILED'
							) {
								console.log(
									`Skipping message ${messageId} due to spam/virus detection`,
								);
								continue;
							}

							if (!action.bucketName || !action.objectKey) {
								console.error(
									'Missing S3 bucket or key for message:',
									messageId,
								);
								continue;
							}

							const parsedEmail = await parseEmailContent(
								action.bucketName,
								action.objectKey,
							);

							const emailAddress = await retryOperation(async () => {
								const { data, error } = await supabaseClient
									.from('email_addresses')
									.select('id, team_id, user_id')
									.eq('email_address', destination[0])
									.single();

								if (error) {
									console.error('Error finding email address:', error);
									throw error;
								}
								if (!data) {
									const err = `Email address not found: ${destination[0]}`;
									console.error(err);
									throw new Error(err);
								}
								return data;
							}, 'find email address');

							const threadInsert = {
								subject: commonHeaders.subject || '(No Subject)',
								last_message_at: timestamp,
								status: 'received',
								priority: 'normal',
								needs_follow_up: false,
							};
							if (emailAddress.team_id) {
								threadInsert.team_id = emailAddress.team_id;
								threadInsert.user_id = null;
							} else if (emailAddress.user_id) {
								threadInsert.user_id = emailAddress.user_id;
								threadInsert.team_id = null;
							} else {
								const err =
									'Email address is not associated with a user or team';
								console.error(err);
								throw new Error(err);
							}

							try {
								const thread = await retryOperation(async () => {
									const { data, error } = await supabaseClient
										.from('email_threads')
										.insert(threadInsert)
										.select()
										.single();

									if (error) {
										console.error('Error creating thread:', error);
										throw error;
									}
									return data;
								}, 'create email thread');

								await storeEmailWithRetry(
									supabaseClient,
									messageId,
									thread.id,
									parsedEmail,
									{
										source,
										destination,
										commonHeaders,
										timestamp,
									},
									action.bucketName,
									action.objectKey,
								);

								console.log(`Successfully processed message ${messageId}`);
							} catch (error) {
								console.error('Error storing email:', {
									error: error.message,
									stack: error.stack,
									messageId,
									destination: destination[0],
									threadInsert,
								});
								throw error;
							}

							// --- Amara AI Integration: Generate and store AI response ---
							try {
								const aiResult = await amaraAI({
									parsedEmail,
									thread,
									emailAddress,
									supabaseClient,
								});
								console.log('Amara AI agent response:', aiResult);
								if (aiResult && aiResult.response) {
									let outgoingMessageId;
									await retryOperation(async () => {
										const { data, error: aiMsgError } = await supabaseClient
											.from('email_messages')
											.insert({
												thread_id: thread.id,
												from_address: destination[0],
												to_address: source,
												subject:
													aiResult.response.subject || `Re: ${thread.subject}`,
												body: aiResult.response.body || aiResult.response,
												status: 'outgoing',
												is_read: false,
												sent_at: null,
												ai_generated: true,
												ai_confidence: aiResult.validation?.confidence || null,
												ai_validation: aiResult.validation || null,
												created_at: new Date().toISOString(),
											})
											.select('id')
											.single();
										if (aiMsgError) throw aiMsgError;
										outgoingMessageId = data?.id;
									}, 'store AI response message');

									if (outgoingMessageId) {
										const sendRes = await fetch(
											Deno.env.get('EMAIL_SEND_FUNCTION_URL') ||
												'http://localhost:54321/functions/v1/email-ses-send',
											{
												method: 'POST',
												headers: {
													'Content-Type': 'application/json',
													Authorization: `Bearer ${Deno.env.get(
														'SUPABASE_SERVICE_ROLE_KEY',
													)}`,
												},
												body: JSON.stringify({
													messageId: outgoingMessageId,
													to: source,
													subject:
														aiResult.response.subject ||
														`Re: ${thread.subject}`,
													body: aiResult.response.body || aiResult.response,
													replyTo: destination[0],
												}),
											},
										);
										if (!sendRes.ok) {
											const errText = await sendRes.text();
											console.error('email-ses-send failed:', errText);
										}
									}
								}
							} catch (aiError) {
								console.error('CrewAI agent failed:', aiError);
							}

							try {
								await supabaseClient.from('email_delivery_logs').insert({
									message_id: messageId,
									event_type: 'received',
									recipient: destination[0],
									status: 'success',
									raw_data: record,
								});
							} catch (logError) {
								console.error('Error logging delivery:', logError);
							}

							console.log(`Successfully processed message ${messageId}`);
						} catch (recordError) {
							console.error(
								`Error processing record for message ${record.ses.mail.messageId}:`,
								recordError,
							);
							continue;
						}
					}

					return new Response(JSON.stringify({ success: true }), {
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						status: 200,
					});
				}

				case 'UnsubscribeConfirmation': {
					console.log('Received unsubscribe confirmation:', snsMessage);
					return new Response(
						JSON.stringify({
							success: true,
							message: 'Unsubscribe confirmation received',
						}),
						{
							headers: { ...corsHeaders, 'Content-Type': 'application/json' },
							status: 200,
						},
					);
				}

				default:
					throw new Error(`Unsupported SNS message type: ${snsMessage.Type}`);
			}
		} else if (isRawSES) {
			console.log('Processing raw SES notification...');
			sesNotification = parsedBody;
			supabaseClient = createClient(
				Deno.env.get('SUPABASE_URL') ?? '',
				Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
			);
			const record = {
				ses: { mail: sesNotification.mail, receipt: sesNotification.receipt },
			};
			try {
				const { mail, receipt } = record.ses;
				const { messageId, source, destination, commonHeaders } = mail;
				const { timestamp, spamVerdict, virusVerdict, action } = receipt;

				console.log(
					`Processing message ${messageId} from ${source} to ${destination}`,
				);

				if (
					spamVerdict.status === 'FAILED' ||
					virusVerdict.status === 'FAILED'
				) {
					console.log(
						`Skipping message ${messageId} due to spam/virus detection`,
					);
				} else {
					let rawMessage = '';
					if (
						typeof sesNotification.content === 'string' &&
						sesNotification.content.length > 0
					) {
						rawMessage =
							typeof atob !== 'undefined'
								? atob(sesNotification.content)
								: Buffer.from(sesNotification.content, 'base64').toString(
										'utf-8',
								  );
						console.log('Decoded raw email content from notification payload.');
					} else if (action && action.bucketName && action.objectKey) {
						console.log('No content in notification, fetching from S3...');
						rawMessage = await parseEmailContent(
							action.bucketName,
							action.objectKey,
						).then((e) => e.rawMessage);
					} else {
						console.error(
							'Missing content and S3 bucket or key for message:',
							messageId,
						);
						return new Response(
							JSON.stringify({ error: 'Missing content and S3 bucket/key' }),
							{
								headers: { ...corsHeaders, 'Content-Type': 'application/json' },
								status: 400,
							},
						);
					}

					const headerSection = rawMessage.split('\r\n\r\n')[0];
					const headers: Record<string, string> = {};
					const headerLines = headerSection.split('\r\n');
					let currentHeader = '';
					for (const line of headerLines) {
						if (line.startsWith(' ') || line.startsWith('\t')) {
							headers[currentHeader] += ' ' + line.trim();
						} else {
							const [name, ...valueParts] = line.split(':');
							if (name && valueParts.length > 0) {
								currentHeader = name.toLowerCase();
								headers[currentHeader] = valueParts.join(':').trim();
							}
						}
					}
					const references = headers['references']?.split(/\s+/) || [];
					const inReplyTo = headers['in-reply-to'];

					const boundaryMatch = headerSection.match(
						/boundary="?([^";\r\n]+)"?/i,
					);
					const boundary = boundaryMatch ? boundaryMatch[1] : null;
					let body = '';
					let htmlBody = null;
					const attachments: Array<{
						filename: string;
						contentType: string;
						content: Uint8Array;
					}> = [];
					if (boundary) {
						const parts = rawMessage.split(`--${boundary}`);
						for (const part of parts) {
							const partHeaders = part.split('\r\n\r\n')[0];
							const partContent = part.split('\r\n\r\n')[1];
							if (!partContent) continue;
							const contentType =
								partHeaders
									.match(/Content-Type:\s*([^;\r\n]+)/i)?.[1]
									?.toLowerCase() || '';
							const contentDisposition =
								partHeaders
									.match(/Content-Disposition:\s*([^;\r\n]+)/i)?.[1]
									?.toLowerCase() || '';
							const filename = partHeaders.match(
								/filename="?([^";\r\n]+)"?/i,
							)?.[1];
							if (contentDisposition.includes('attachment') && filename) {
								const content = new TextEncoder().encode(partContent);
								attachments.push({ filename, contentType, content });
							} else if (contentType.includes('text/plain')) {
								body = partContent.trim();
							} else if (contentType.includes('text/html')) {
								htmlBody = partContent.trim();
							}
						}
					} else {
						const bodyMatch = rawMessage.match(/\r?\n\r?\n([\s\S]*)$/);
						body = bodyMatch ? bodyMatch[1].trim() : '';
					}

					const emailAddress = await retryOperation(async () => {
						const { data, error } = await supabaseClient
							.from('email_addresses')
							.select('id, team_id, user_id')
							.eq('email_address', destination[0])
							.single();
						if (error) throw error;
						if (!data)
							throw new Error(`Email address not found: ${destination[0]}`);
						return data;
					}, 'find email address');

					const threadInsert: Record<string, unknown> = {
						subject: commonHeaders.subject || '(No Subject)',
						last_message_at: timestamp,
						status: 'received',
						priority: 'normal',
						needs_follow_up: false,
					};
					if (emailAddress.team_id) {
						threadInsert.team_id = emailAddress.team_id;
						threadInsert.user_id = null;
					} else if (emailAddress.user_id) {
						threadInsert.user_id = emailAddress.user_id;
						threadInsert.team_id = null;
					} else {
						throw new Error(
							'Email address is not associated with a user or team',
						);
					}
					const thread = await retryOperation(async () => {
						const { data, error } = await supabaseClient
							.from('email_threads')
							.upsert(threadInsert)
							.select()
							.single();
						if (error) throw error;
						return data;
					}, 'create/update thread');

					await storeEmailWithRetry(
						supabaseClient,
						messageId,
						thread.id,
						{
							body,
							htmlBody,
							hasAttachments: attachments.length > 0,
							rawMessage,
							attachments,
							headers,
							references,
							inReplyTo,
						},
						{ source, destination, commonHeaders, timestamp },
						action?.bucketName,
						action?.objectKey,
					);

					// Process email with Amara AI
					console.log(`Processing message ${messageId} with Amara AI`);
					try {
						const aiResponse = await amaraAI({
							parsedEmail: {
								body,
								headers,
								attachments: attachments.map((a) => ({
									filename: a.filename,
									contentType: a.contentType,
								})),
							},
							thread: {
								id: thread.id,
								subject: commonHeaders.subject || '(No Subject)',
								status: 'received',
							},
							emailAddress,
							supabaseClient,
						});
						console.log(
							`AI Response generated for message ${messageId}:`,
							aiResponse,
						);
					} catch (aiError) {
						console.error(
							`Error processing message ${messageId} with AI:`,
							aiError,
						);
						// Don't throw here - we still want to log the delivery
					}

					try {
						await supabaseClient.from('email_delivery_logs').insert({
							message_id: messageId,
							event_type: 'received',
							recipient: destination[0],
							status: 'success',
							raw_data: record,
						});
					} catch (logError) {
						console.error('Error logging delivery:', logError);
					}

					console.log(`Successfully processed message ${messageId}`);
				}
				return new Response(JSON.stringify({ success: true }), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					status: 200,
				});
			} catch (recordError) {
				console.error(
					`Error processing record for message ${record.ses.mail.messageId}:`,
					recordError,
				);
				return new Response(JSON.stringify({ error: recordError.message }), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					status: 500,
				});
			}
		} else {
			console.error('Request does not appear to be from AWS SNS or SES');
			throw new Error('Invalid request: Not an AWS SNS or SES message');
		}
	} catch (error) {
		console.error('Error processing SNS/SES webhook:', error);
		return new Response(
			JSON.stringify({
				error: error.message,
				details: error.stack,
				timestamp: new Date().toISOString(),
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				status: 500,
			},
		);
	}
});
