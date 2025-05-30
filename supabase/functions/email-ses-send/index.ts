/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
	createClient,
	SupabaseClient,
} from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
	SESClient,
	SendEmailCommand,
	SendRawEmailCommand,
	MessageRejected,
	SendEmailCommandInput,
} from 'https://esm.sh/@aws-sdk/client-ses@3.0.0';

// Initialize AWS SES client
const sesClient = new SESClient({
	region: Deno.env.get('AWS_REGION') ?? 'eu-west-1',
	credentials: {
		accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID') ?? '',
		secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY') ?? '',
	},
});

// Maximum number of retry attempts
const MAX_RETRIES = 3;
// Base delay between retries (in milliseconds)
const BASE_RETRY_DELAY = 1000;

// Helper function to delay execution
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper function to calculate exponential backoff delay
const getRetryDelay = (attempt: number): number => {
	return Math.min(BASE_RETRY_DELAY * Math.pow(2, attempt), 30000); // Max 30 seconds
};

interface DeliveryLogData {
	Destination?: {
		ToAddresses?: string[];
	};
	MessageId?: string;
	[key: string]: unknown;
}

// Helper function to log email delivery status
async function logDeliveryStatus(
	supabase: SupabaseClient,
	messageId: string,
	status: 'success' | 'failed' | 'retrying',
	error?: string,
	rawData?: DeliveryLogData,
) {
	try {
		await supabase.from('email_delivery_logs').insert({
			message_id: messageId,
			event_type: 'send',
			recipient: rawData?.Destination?.ToAddresses?.[0] || 'unknown',
			status,
			error_message: error,
			raw_data: rawData,
		});
	} catch (logError) {
		console.error('Failed to log delivery status:', logError);
	}
}

// Helper function to update message status
async function updateMessageStatus(
	supabase: SupabaseClient,
	messageId: string,
	status: 'sent' | 'failed' | 'retrying',
) {
	try {
		await supabase
			.from('email_messages')
			.update({ status })
			.eq('id', messageId);
	} catch (updateError) {
		console.error('Failed to update message status:', updateError);
	}
}

// Helper function to send email with retry logic
async function sendEmailWithRetry(
	supabase: SupabaseClient,
	messageId: string,
	sendCommand: SendEmailCommand | SendRawEmailCommand,
	attempt: number = 0,
): Promise<{ success: boolean; error?: string }> {
	try {
		// Update status to retrying if this is a retry attempt
		if (attempt > 0) {
			await updateMessageStatus(supabase, messageId, 'retrying');
			await logDeliveryStatus(
				supabase,
				messageId,
				'retrying',
				undefined,
				sendCommand.input as DeliveryLogData,
			);
		}

		const response = await sesClient.send(sendCommand);

		// Log success
		await logDeliveryStatus(supabase, messageId, 'success', undefined, {
			...sendCommand.input,
			MessageId: response.MessageId,
		} as DeliveryLogData);

		// Update message status
		await updateMessageStatus(supabase, messageId, 'sent');

		return { success: true };
	} catch (error) {
		const isRetryable =
			error instanceof MessageRejected ||
			(error as Error)?.name === 'ThrottlingException' ||
			(error as Error)?.name === 'ServiceUnavailable';

		// Log the error
		await logDeliveryStatus(
			supabase,
			messageId,
			'failed',
			(error as Error).message,
			sendCommand.input as DeliveryLogData,
		);

		// If we haven't exceeded max retries and the error is retryable, retry
		if (attempt < MAX_RETRIES && isRetryable) {
			const delayMs = getRetryDelay(attempt);
			await delay(delayMs);
			return sendEmailWithRetry(supabase, messageId, sendCommand, attempt + 1);
		}

		// If we've exhausted retries or the error is not retryable, update status to failed
		await updateMessageStatus(supabase, messageId, 'failed');
		return { success: false, error: (error as Error).message };
	}
}

interface EmailRequest {
	messageId: string;
	to: string | string[];
	subject: string;
	body?: string;
	htmlBody?: string;
	replyTo?: string;
}

serve(async (req) => {
	// Handle CORS
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	try {
		// Verify authentication
		const authHeader = req.headers.get('Authorization');
		if (!authHeader) {
			throw new Error('Missing authorization header');
		}

		// Initialize Supabase client
		const supabaseClient = createClient(
			Deno.env.get('SUPABASE_URL') ?? '',
			Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
			{
				global: {
					headers: { Authorization: authHeader },
				},
			},
		);

		// Parse request body
		const { messageId, to, subject, body, htmlBody, replyTo } =
			(await req.json()) as EmailRequest;

		// Validate required fields
		if (!messageId || !to || !subject || (!body && !htmlBody)) {
			throw new Error('Missing required fields');
		}

		// Get the sender's email address from the message
		const { data: message, error: messageError } = await supabaseClient
			.from('email_messages')
			.select('from_address')
			.eq('id', messageId)
			.single();

		if (messageError || !message) {
			throw new Error('Failed to fetch sender information');
		}

		// Prepare email content
		const emailParams: SendEmailCommandInput = {
			Source: message.from_address,
			Destination: {
				ToAddresses: Array.isArray(to) ? to : [to],
			},
			Message: {
				Subject: {
					Data: subject,
					Charset: 'UTF-8',
				},
				Body: {
					...(body && {
						Text: {
							Data: body,
							Charset: 'UTF-8',
						},
					}),
					...(htmlBody && {
						Html: {
							Data: htmlBody,
							Charset: 'UTF-8',
						},
					}),
				},
			},
			...(replyTo && { ReplyToAddresses: [replyTo] }),
		};

		// Create and send the email command
		const sendCommand = new SendEmailCommand(emailParams);
		const result = await sendEmailWithRetry(
			supabaseClient,
			messageId,
			sendCommand,
		);

		if (!result.success) {
			throw new Error(result.error || 'Failed to send email');
		}

		return new Response(JSON.stringify({ success: true }), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			status: 200,
		});
	} catch (error) {
		console.error('Error sending email:', error);
		return new Response(
			JSON.stringify({
				success: false,
				error: (error as Error).message,
				details: (error as Error).stack,
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				status: 400,
			},
		);
	}
});
