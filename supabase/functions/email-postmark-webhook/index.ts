/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { retryOperation } from '../email-ses-webhook/utils.ts';
import { amaraAI } from '../email-ses-webhook/amaraAI.ts';

interface PostmarkInboundEmail {
	FromName: string;
	From: string;
	FromFull: {
		Email: string;
		Name: string;
		MailboxHash: string;
	};
	To: string;
	ToFull: Array<{
		Email: string;
		Name: string;
		MailboxHash: string;
	}>;
	Cc: string;
	CcFull: Array<{
		Email: string;
		Name: string;
		MailboxHash: string;
	}>;
	Bcc: string;
	BccFull: Array<{
		Email: string;
		Name: string;
		MailboxHash: string;
	}>;
	OriginalRecipient: string;
	Subject: string;
	MessageID: string;
	ReplyTo: string;
	MailboxHash: string;
	Date: string;
	TextBody: string;
	HtmlBody: string;
	StrippedTextReply: string;
	Tag: string;
	Headers: Array<{
		Name: string;
		Value: string;
	}>;
	Attachments: Array<{
		Name: string;
		Content: string;
		ContentType: string;
		ContentLength: number;
	}>;
}

// Helper function to extract clean email address
function extractEmailAddress(formattedEmail: string): string {
	// Try to extract email from "Display Name <email@example.com>" format
	const matchAngleBrackets = formattedEmail.match(/<([^>]+)>/);
	if (matchAngleBrackets) {
		return matchAngleBrackets[1];
	}

	// Try to extract from quoted format "email@example.com"
	const matchQuotes = formattedEmail.match(/"([^"]+)"/);
	if (matchQuotes) {
		return matchQuotes[1];
	}

	// If no special formatting, return as is
	return formattedEmail.trim();
}

serve(async (req) => {
	// Handle CORS preflight requests
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	try {
		console.log('Received request method:', req.method);
		console.log('Request headers:', Object.fromEntries(req.headers.entries()));
		console.log('Request URL:', req.url);

		// Check for webhook secret in query parameter
		const url = new URL(req.url);
		const authToken = url.searchParams.get('auth');
		const webhookSecret = Deno.env.get('WEBHOOK_SECRET');

		console.log('Received authToken:', authToken);
		console.log('Expected webhookSecret:', webhookSecret);

		if (!authToken || !webhookSecret || authToken !== webhookSecret) {
			console.error('Invalid or missing authentication token');
			return new Response(
				JSON.stringify({
					error: 'Unauthorized',
					message: 'Invalid or missing authentication token',
					receivedToken: authToken ? 'present' : 'missing',
					expectedToken: webhookSecret ? 'configured' : 'not configured',
				}),
				{
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					status: 401,
				},
			);
		}

		console.log('Authentication successful');

		// Create Supabase client
		const supabaseClient = createClient(
			Deno.env.get('SUPABASE_URL') ?? '',
			Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
		);

		// Parse the incoming webhook payload
		const payload: PostmarkInboundEmail = await req.json();
		console.log('Received Postmark payload:', JSON.stringify(payload, null, 2));

		// Extract email data
		const {
			From,
			FromName,
			To,
			Subject,
			TextBody,
			HtmlBody,
			MessageID,
			Date: receivedDate,
			Attachments,
			Headers,
		} = payload;

		// Clean the To address
		const cleanToAddress = extractEmailAddress(To);
		console.log('Cleaned To address:', cleanToAddress);

		// Find the email address in our system
		const emailAddress = await retryOperation(async () => {
			const { data, error } = await supabaseClient
				.from('email_addresses')
				.select('id, team_id, user_id')
				.eq('email_address', cleanToAddress)
				.single();

			if (error) {
				console.error('Error finding email address:', error);
				throw error;
			}
			if (!data) {
				const err = `Email address not found: ${cleanToAddress}`;
				console.error(err);
				throw new Error(err);
			}
			return data;
		}, 'find email address');

		// Create thread
		const threadInsert = {
			subject: Subject || '(No Subject)',
			last_message_at: new Date(receivedDate).toISOString(),
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
			const err = 'Email address is not associated with a user or team';
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

			// Store the email message
			const { error: messageError } = await supabaseClient
				.from('email_messages')
				.insert({
					thread_id: thread.id,
					message_id: MessageID,
					from_address: From,
					from_name: FromName,
					to_address: To,
					subject: Subject || '(No Subject)',
					body: TextBody,
					body_html: HtmlBody,
					status: 'received',
					is_read: false,
					has_attachments: Attachments.length > 0,
					received_at: new Date(receivedDate).toISOString(),
				});

			if (messageError) {
				console.error('Error storing email message:', messageError);
				throw messageError;
			}

			// Store attachments if any
			if (Attachments.length > 0) {
				for (const attachment of Attachments) {
					const { error: attachmentError } = await supabaseClient
						.from('email_attachments')
						.insert({
							message_id: MessageID,
							file_name: attachment.Name,
							file_type: attachment.ContentType,
							file_size: attachment.ContentLength,
							storage_path: `attachments/${MessageID}/${attachment.Name}`,
						});

					if (attachmentError) {
						console.error('Error storing attachment:', attachmentError);
						throw attachmentError;
					}
				}
			}

			// Store raw message
			const { error: rawError } = await supabaseClient
				.from('email_raw_messages')
				.insert({
					message_id: MessageID,
					raw_content: JSON.stringify(payload),
					created_at: new Date().toISOString(),
				});

			if (rawError) {
				console.error('Error storing raw message:', rawError);
				throw rawError;
			}

			// Process with Amara AI
			try {
				const aiResult = await amaraAI({
					parsedEmail: {
						body: TextBody,
						htmlBody: HtmlBody,
						hasAttachments: Attachments.length > 0,
						attachments: Attachments.map((a) => ({
							filename: a.Name,
							contentType: a.ContentType,
						})),
						headers: Headers.reduce(
							(acc, h) => ({ ...acc, [h.Name.toLowerCase()]: h.Value }),
							{},
						),
					},
					thread,
					emailAddress,
					supabaseClient,
				});

				if (aiResult && aiResult.response) {
					let outgoingMessageId;
					await retryOperation(async () => {
						const { data, error: aiMsgError } = await supabaseClient
							.from('email_messages')
							.insert({
								thread_id: thread.id,
								from_address: To,
								to_address: From,
								subject: aiResult.response.subject || `Re: ${thread.subject}`,
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
								'http://localhost:54321/functions/v1/email-postmark-send',
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
									to: From,
									subject: aiResult.response.subject || `Re: ${thread.subject}`,
									body: aiResult.response.body || aiResult.response,
									replyTo: To,
								}),
							},
						);
						if (!sendRes.ok) {
							const errText = await sendRes.text();
							console.error('email-postmark-send failed:', errText);
						}
					}
				}
			} catch (aiError) {
				console.error('CrewAI agent failed:', aiError);
			}

			// Log delivery
			try {
				await supabaseClient.from('email_delivery_logs').insert({
					message_id: MessageID,
					event_type: 'received',
					recipient: To,
					status: 'success',
					raw_data: payload,
				});
			} catch (logError) {
				console.error('Error logging delivery:', logError);
			}

			console.log(`Successfully processed message ${MessageID}`);
			return new Response(
				JSON.stringify({
					success: true,
					message: 'Email processed successfully',
				}),
				{
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					status: 200,
				},
			);
		} catch (error) {
			console.error('Error storing email:', {
				error: error.message,
				stack: error.stack,
				messageId: MessageID,
				destination: To,
				threadInsert,
			});
			throw error;
		}
	} catch (error) {
		console.error('Error processing webhook:', error);
		return new Response(
			JSON.stringify({
				error: 'Internal server error',
				message: error.message,
				stack: error.stack,
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				status: 500,
			},
		);
	}
});
