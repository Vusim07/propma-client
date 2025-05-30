/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
	S3Client,
	GetObjectCommand,
} from 'https://esm.sh/@aws-sdk/client-s3@3.0.0';
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts';
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';

// Initialize AWS S3 client
const s3Client = new S3Client({
	region: Deno.env.get('AWS_REGION') ?? 'eu-north-1',
	credentials: {
		accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID') ?? '',
		secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY') ?? '',
	},
});

// Add proper type definitions for email parsing
interface ParsedEmailContent {
	body: string;
	htmlBody: string | null;
	hasAttachments: boolean;
	rawMessage: string;
	attachments?: Array<{
		filename: string;
		contentType: string;
		content: Uint8Array;
	}>;
	headers: Record<string, string>;
	references?: string[];
	inReplyTo?: string;
}

// Add type definitions for email data
interface EmailHeaders {
	from: string[];
	subject?: string;
	date?: string;
	to?: string[];
	cc?: string[];
	bcc?: string[];
}

interface EmailData {
	source: string;
	destination: string[];
	commonHeaders: EmailHeaders;
	timestamp: string;
}

// Add type for Supabase client
interface SupabaseClient {
	from: (table: string) => {
		insert: (
			data: Record<string, unknown>,
		) => Promise<{ error: Error | null; data?: unknown }>;
		select: (columns?: string) => {
			eq: (
				column: string,
				value: unknown,
			) => {
				single: () => Promise<{ error: Error | null; data?: unknown }>;
			};
		};
		upsert: (data: Record<string, unknown>) => {
			select: () => {
				single: () => Promise<{ error: Error | null; data?: unknown }>;
			};
		};
	};
}

// Enhanced email parsing function
async function parseEmailContent(
	bucket: string,
	key: string,
): Promise<ParsedEmailContent> {
	function decodeContent(content: string, encoding: string): string {
		if (!encoding) return content;
		encoding = encoding.toLowerCase();
		if (encoding === 'base64') {
			try {
				return atob(content.replace(/\s/g, ''));
			} catch {
				return content;
			}
		} else if (encoding === 'quoted-printable') {
			// Simple quoted-printable decode
			return content
				.replace(/=([A-Fa-f0-9]{2})/g, (_, hex) =>
					String.fromCharCode(parseInt(hex, 16)),
				)
				.replace(/=\r?\n/g, '');
		}
		return content;
	}
	function stripHtml(html: string): string {
		return html
			.replace(/<[^>]+>/g, '')
			.replace(/\s+/g, ' ')
			.trim();
	}
	try {
		const command = new GetObjectCommand({
			Bucket: bucket,
			Key: key,
		});
		const response = await s3Client.send(command);
		if (!response.Body) {
			throw new Error('No email content received from S3');
		}
		const rawMessage = await response.Body.transformToString();
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
		const boundaryMatch = headerSection.match(/boundary="?([^";\r\n]+)"?/i);
		const boundary = boundaryMatch ? boundaryMatch[1] : null;
		let body = '';
		let htmlBody: string | null = null;
		const attachments: Array<{
			filename: string;
			contentType: string;
			content: Uint8Array;
		}> = [];
		let foundPlain = false;
		if (boundary) {
			const parts = rawMessage.split(`--${boundary}`);
			for (const part of parts) {
				const [partHeadersRaw, ...contentArr] = part.split('\r\n\r\n');
				const partContentRaw = contentArr.join('\r\n\r\n');
				if (!partContentRaw) continue;
				const contentType =
					partHeadersRaw
						.match(/Content-Type:\s*([^;\r\n]+)/i)?.[1]
						?.toLowerCase() || '';
				const contentDisposition =
					partHeadersRaw
						.match(/Content-Disposition:\s*([^;\r\n]+)/i)?.[1]
						?.toLowerCase() || '';
				const filename = partHeadersRaw.match(
					/filename="?([^";\r\n]+)"?/i,
				)?.[1];
				const encoding =
					partHeadersRaw
						.match(/Content-Transfer-Encoding:\s*([^;\r\n]+)/i)?.[1]
						?.toLowerCase() || '';
				const partContent = decodeContent(partContentRaw.trim(), encoding);
				if (contentDisposition.includes('attachment') && filename) {
					const content = new TextEncoder().encode(partContentRaw);
					attachments.push({ filename, contentType, content });
				} else if (contentType.includes('text/plain') && !foundPlain) {
					body = partContent;
					foundPlain = true;
				} else if (contentType.includes('text/html') && !htmlBody) {
					htmlBody = partContent;
				}
			}
		} else {
			const bodyMatch = rawMessage.match(/\r?\n\r?\n([\s\S]*)$/);
			body = bodyMatch ? bodyMatch[1].trim() : '';
		}
		if (!body && htmlBody) {
			body = stripHtml(htmlBody);
		}
		return {
			body,
			htmlBody,
			hasAttachments: attachments.length > 0,
			rawMessage,
			attachments,
			headers,
			references,
			inReplyTo,
		};
	} catch (error) {
		console.error('Error fetching email content from S3:', error);
		return {
			body: '',
			htmlBody: null,
			hasAttachments: false,
			rawMessage: '',
			headers: {},
		};
	}
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface SESNotification {
	Records: Array<{
		eventSource: string;
		eventVersion: string;
		ses: {
			mail: {
				timestamp: string;
				source: string;
				messageId: string;
				destination: string[];
				headersTruncated: boolean;
				headers: Array<{
					name: string;
					value: string;
				}>;
				commonHeaders: {
					from: string[];
					to: string[];
					messageId: string;
					subject: string;
				};
			};
			receipt: {
				timestamp: string;
				processingTimeMillis: number;
				recipients: string[];
				spamVerdict: { status: string };
				virusVerdict: { status: string };
				spfVerdict: { status: string };
				dkimVerdict: { status: string };
				dmarcVerdict: { status: string };
				action: {
					type: string;
					bucketName?: string;
					objectKey?: string;
				};
			};
		};
	}>;
}

// Add retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Helper function to delay execution
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper function to retry database operations
async function retryOperation<T>(
	operation: () => Promise<T>,
	operationName: string,
	maxRetries: number = MAX_RETRIES,
): Promise<T> {
	let lastError: Error | null = null;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await operation();
		} catch (error) {
			lastError = error as Error;
			console.warn(
				`Attempt ${attempt}/${maxRetries} failed for ${operationName}:`,
				error,
			);

			if (attempt < maxRetries) {
				const delayMs = RETRY_DELAY_MS * Math.pow(2, attempt - 1); // Exponential backoff
				await delay(delayMs);
			}
		}
	}

	throw new Error(
		`Operation ${operationName} failed after ${maxRetries} attempts. Last error: ${lastError?.message}`,
	);
}

// Update the storeEmailWithRetry function with proper types
async function storeEmailWithRetry(
	supabaseClient: SupabaseClient,
	messageId: string,
	threadId: string,
	parsedEmail: ParsedEmailContent,
	emailData: EmailData,
	s3Bucket?: string,
	s3Key?: string,
) {
	// Store the email message with retries
	await retryOperation(async () => {
		const { error: messageError } = await supabaseClient
			.from('email_messages')
			.insert({
				thread_id: threadId,
				message_id: messageId,
				from_address: emailData.source,
				from_name: emailData.commonHeaders.from[0].split('@')[0],
				to_address: emailData.destination[0],
				subject: emailData.commonHeaders.subject || '(No Subject)',
				body: parsedEmail.body,
				body_html: parsedEmail.htmlBody,
				status: 'received',
				is_read: false,
				has_attachments: parsedEmail.hasAttachments,
				received_at: emailData.timestamp,
				in_reply_to: parsedEmail.inReplyTo,
				s3_bucket: s3Bucket,
				s3_key: s3Key,
			});

		if (messageError) throw messageError;
	}, 'store email message');

	// Store attachments with retries
	if (parsedEmail.attachments?.length) {
		for (const attachment of parsedEmail.attachments) {
			await retryOperation(async () => {
				const { error: attachmentError } = await supabaseClient
					.from('email_attachments')
					.insert({
						message_id: messageId,
						file_name: attachment.filename,
						file_type: attachment.contentType,
						file_size: attachment.content.length,
						storage_path: `attachments/${messageId}/${attachment.filename}`,
					});

				if (attachmentError) throw attachmentError;
			}, `store attachment ${parsedEmail.attachments[0].filename}`);
		}
	}

	// Store raw message with retries
	if (parsedEmail.rawMessage) {
		await retryOperation(async () => {
			const { error: rawError } = await supabaseClient
				.from('email_raw_messages')
				.insert({
					message_id: messageId,
					raw_content: parsedEmail.rawMessage,
					created_at: new Date().toISOString(),
				});

			if (rawError) throw rawError;
		}, 'store raw message');
	}
}

// Add SNS message type interface
interface SNSMessage {
	Type: 'Notification' | 'SubscriptionConfirmation' | 'UnsubscribeConfirmation';
	MessageId: string;
	TopicArn: string;
	Message: string;
	Timestamp: string;
	SignatureVersion: string;
	Signature: string;
	SigningCertURL: string;
	SubscribeURL?: string;
	UnsubscribeURL?: string;
}

// Add function to verify SNS signature
async function verifySNSSignature(message: SNSMessage): Promise<boolean> {
	try {
		// Get the signing certificate
		const certResponse = await fetch(message.SigningCertURL);
		if (!certResponse.ok) {
			throw new Error('Failed to fetch signing certificate');
		}
		const certText = await certResponse.text();

		// Create the string to sign
		let stringToSign = '';
		if (message.Type === 'Notification') {
			stringToSign = [
				'Message',
				'MessageId',
				'Subject',
				'Timestamp',
				'TopicArn',
				'Type',
			]
				.map((key) => `${key}\n${message[key as keyof SNSMessage]}\n`)
				.join('');
		} else if (
			message.Type === 'SubscriptionConfirmation' ||
			message.Type === 'UnsubscribeConfirmation'
		) {
			stringToSign = [
				'Message',
				'MessageId',
				'SubscribeURL',
				'Timestamp',
				'Token',
				'TopicArn',
				'Type',
			]
				.map((key) => `${key}\n${message[key as keyof SNSMessage]}\n`)
				.join('');
		}

		// For subscription confirmation, we'll do a basic URL validation
		if (message.Type === 'SubscriptionConfirmation') {
			const certUrl = new URL(message.SigningCertURL);
			return (
				certUrl.hostname === 'sns.amazonaws.com' ||
				certUrl.hostname.endsWith('.sns.amazonaws.com')
			);
		}

		// For notifications, we'll verify the signature
		if (message.Type === 'Notification') {
			// Convert the certificate to the correct format
			const certPem = certText
				.replace('-----BEGIN CERTIFICATE-----', '')
				.replace('-----END CERTIFICATE-----', '')
				.replace(/\s/g, '');

			const certBuffer = base64Encode(new TextEncoder().encode(certPem));

			// Import the certificate
			const certKey = await crypto.subtle.importKey(
				'spki',
				certBuffer,
				{
					name: 'RSASSA-PKCS1-v1_5',
					hash: 'SHA-1',
				},
				false,
				['verify'],
			);

			// Verify the signature
			const signature = base64Encode(
				await crypto.subtle.sign(
					{ name: 'RSASSA-PKCS1-v1_5' },
					certKey,
					new TextEncoder().encode(stringToSign),
				),
			);

			return signature === message.Signature;
		}

		return false;
	} catch (error) {
		console.error('Error verifying SNS signature:', error);
		return false;
	}
}

serve(async (req) => {
	// Handle CORS preflight
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	try {
		console.log('Received request method:', req.method);
		console.log('Request headers:', Object.fromEntries(req.headers.entries()));
		console.log('Request URL:', req.url);

		// Extract URL and check for auth parameter
		const url = new URL(req.url);
		const authToken =
			url.searchParams.get('auth') || req.headers.get('x-webhook-secret');
		const webhookSecret = Deno.env.get('WEBHOOK_SECRET');

		console.log('Received authToken:', authToken);
		console.log('Expected webhookSecret:', webhookSecret);

		// Check authentication via URL parameter or header
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

		// Parse the request body
		const requestBody = await req.text();
		console.log('Raw request body:', requestBody);

		// Try to parse as JSON
		let parsedBody;
		try {
			parsedBody = JSON.parse(requestBody);
		} catch (parseError) {
			console.error('Failed to parse request body as JSON:', parseError);
			throw new Error('Invalid JSON in request body');
		}

		// Support both SNS envelope and raw SES notification
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

					// For subscription confirmation, we'll directly confirm without signature verification
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
					// For notifications, we'll verify the signature
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

					// Parse the SES notification from the SNS message
					sesNotification = JSON.parse(snsMessage.Message);
					console.log(
						'SES Notification:',
						JSON.stringify(sesNotification, null, 2),
					);

					// Initialize Supabase client with service role key
					supabaseClient = createClient(
						Deno.env.get('SUPABASE_URL') ?? '',
						Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
					);

					// Process each record in the notification
					for (const record of sesNotification.Records) {
						try {
							const { mail, receipt } = record.ses;
							const { messageId, source, destination, commonHeaders } = mail;
							const { timestamp, spamVerdict, virusVerdict, action } = receipt;

							console.log(
								`Processing message ${messageId} from ${source} to ${destination}`,
							);

							// Skip if spam or virus detected
							if (
								spamVerdict.status === 'FAILED' ||
								virusVerdict.status === 'FAILED'
							) {
								console.log(
									`Skipping message ${messageId} due to spam/virus detection`,
								);
								continue;
							}

							// Check if we have S3 bucket and key
							if (!action.bucketName || !action.objectKey) {
								console.error(
									'Missing S3 bucket or key for message:',
									messageId,
								);
								continue;
							}

							// Fetch and parse email content from S3
							const parsedEmail = await parseEmailContent(
								action.bucketName,
								action.objectKey,
							);

							// Find the team/agent email address with retries
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

							// Create or update email thread with retries
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

							// Store email and related data with retries
							await storeEmailWithRetry(
								supabaseClient,
								messageId,
								thread.id,
								parsedEmail,
								{ source, destination, commonHeaders, timestamp },
								action.bucketName,
								action.objectKey,
							);

							// Log the delivery (non-critical operation)
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
								// Continue processing even if logging fails
							}

							console.log(`Successfully processed message ${messageId}`);
						} catch (recordError) {
							console.error(
								`Error processing record for message ${record.ses.mail.messageId}:`,
								recordError,
							);
							// Continue processing other records even if one fails
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
			// Handle raw SES notification (direct POST from SES or via API Gateway unwrapping)
			console.log('Processing raw SES notification...');
			sesNotification = parsedBody;
			// Initialize Supabase client with service role key
			supabaseClient = createClient(
				Deno.env.get('SUPABASE_URL') ?? '',
				Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
			);
			// Simulate a single-record SES notification for compatibility
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

				// Skip if spam or virus detected
				if (
					spamVerdict.status === 'FAILED' ||
					virusVerdict.status === 'FAILED'
				) {
					console.log(
						`Skipping message ${messageId} due to spam/virus detection`,
					);
				} else {
					// Try to use the content field if present
					let rawMessage = '';
					if (
						typeof sesNotification.content === 'string' &&
						sesNotification.content.length > 0
					) {
						// Decode base64 content
						rawMessage =
							typeof atob !== 'undefined'
								? atob(sesNotification.content)
								: Buffer.from(sesNotification.content, 'base64').toString(
										'utf-8',
								  );
						console.log('Decoded raw email content from notification payload.');
					} else if (action && action.bucketName && action.objectKey) {
						// Fallback to S3 fetch if content is missing
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

					// Parse headers and bodies from rawMessage (reuse your parsing logic)
					// You may want to refactor parseEmailContent to accept rawMessage directly
					// For now, let's parse headers and bodies inline (simple version):
					const headerSection = rawMessage.split('\r\n\r\n')[0];
					const headers = {};
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
					// Extract message references for threading
					const references = headers['references']?.split(/\s+/) || [];
					const inReplyTo = headers['in-reply-to'];

					// Parse MIME parts (simple version)
					const boundaryMatch = headerSection.match(
						/boundary="?([^";\r\n]+)"?/i,
					);
					const boundary = boundaryMatch ? boundaryMatch[1] : null;
					let body = '';
					let htmlBody = null;
					const attachments = [];
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
								// Handle attachment
								const content = new TextEncoder().encode(partContent);
								attachments.push({ filename, contentType, content });
							} else if (contentType.includes('text/plain')) {
								body = partContent.trim();
							} else if (contentType.includes('text/html')) {
								htmlBody = partContent.trim();
							}
						}
					} else {
						// Simple message without MIME parts
						const bodyMatch = rawMessage.match(/\r?\n\r?\n([\s\S]*)$/);
						body = bodyMatch ? bodyMatch[1].trim() : '';
					}

					// Store email and related data with retries
					// Find the team/agent email address with retries
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

					// Create or update email thread with retries
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

					// Log the delivery (non-critical operation)
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
						// Continue processing even if logging fails
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
