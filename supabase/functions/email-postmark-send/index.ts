/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface SendEmailRequest {
	messageId: string; // Supabase message ID to lookup the context
	to: string;
	subject: string;
	body: string;
	htmlBody?: string;
	replyTo?: string;
	attachments?: Array<{
		name: string;
		content: string; // Base64 encoded
		contentType: string;
	}>;
	tag?: string;
	metadata?: Record<string, string>;
}

serve(async (req) => {
	// Handle CORS preflight requests
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	try {
		// Create Supabase client
		const supabaseClient = createClient(
			Deno.env.get('SUPABASE_URL') ?? '',
			Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
		);

		// Parse the request body
		const payload: SendEmailRequest = await req.json();
		console.log('Received payload:', JSON.stringify(payload, null, 2));
		// Validate required fields
		if (
			!payload.messageId ||
			!payload.to ||
			!payload.subject ||
			!payload.body
		) {
			return new Response(
				JSON.stringify({
					error: 'Missing required fields',
					received: payload,
				}),
				{
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					status: 400,
				},
			);
		}

		// Get the message details from the database
		const { data: message, error: messageError } = await supabaseClient
			.from('email_messages')
			.select('*, thread:email_threads(*)')
			.eq('id', payload.messageId)
			.single();

		if (messageError || !message) {
			throw new Error(`Message not found: ${messageError?.message}`);
		}
		// Get the sender's email address based on thread ownership
		let emailAddress;
		if (message.thread.team_id) {
			// If thread belongs to a team, get team's primary email
			const { data: teamEmail, error: teamEmailError } = await supabaseClient
				.from('email_addresses')
				.select('email_address')
				.eq('is_primary', true)
				.eq('team_id', message.thread.team_id)
				.single();

			if (!teamEmailError && teamEmail) {
				emailAddress = teamEmail.email_address;
			}
		}

		if (!emailAddress && message.thread.user_id) {
			// If thread belongs to an individual user, get user's primary email
			const { data: userEmail, error: userEmailError } = await supabaseClient
				.from('email_addresses')
				.select('email_address')
				.eq('is_primary', true)
				.eq('user_id', message.thread.user_id)
				.single();

			if (!userEmailError && userEmail) {
				emailAddress = userEmail.email_address;
			}
		}

		// If no email address found, use the replyTo from payload or default system email
		if (!emailAddress) {
			emailAddress = payload.replyTo || 'noreply@agentamara.com';
			console.log('Using fallback email address:', emailAddress);
		}

		// Prepare the email payload for Postmark
		const emailPayload = {
			From: emailAddress,
			To: payload.to,
			Subject: payload.subject,
			TextBody: payload.body,
			HtmlBody: payload.htmlBody,
			ReplyTo: emailAddress,
			Tag: payload.tag,
			Metadata: {
				...payload.metadata,
				messageId: payload.messageId,
				threadId: message.thread_id,
			},
			Attachments: payload.attachments?.map((attachment) => ({
				Name: attachment.name,
				Content: attachment.content,
				ContentType: attachment.contentType,
			})),
		};

		// Send the email using Postmark API
		const response = await fetch('https://api.postmarkapp.com/email', {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				'X-Postmark-Server-Token': Deno.env.get('POSTMARK_SERVER_TOKEN') ?? '',
			},
			body: JSON.stringify(emailPayload),
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(`Postmark API error: ${JSON.stringify(error)}`);
		}

		const result = await response.json();

		// Update the message in the database
		const { error: updateError } = await supabaseClient
			.from('email_messages')
			.update({
				message_id: result.MessageID,
				status: 'sent',
				sent_at: new Date().toISOString(),
			})
			.eq('id', payload.messageId);

		if (updateError) {
			console.error('Error updating message:', updateError);
			throw updateError;
		}

		// Log the delivery event
		const { error: logError } = await supabaseClient
			.from('email_delivery_logs')
			.insert({
				message_id: payload.messageId,
				event_type: 'send',
				recipient: payload.to,
				status: 'sent',
				raw_data: result,
			});

		if (logError) {
			console.error('Error logging delivery:', logError);
			// Don't throw here, as the email was sent successfully
		}

		return new Response(
			JSON.stringify({ success: true, messageId: result.MessageID }),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				status: 200,
			},
		);
	} catch (error) {
		console.error('Error sending email:', error);
		return new Response(JSON.stringify({ error: error.message }), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			status: 500,
		});
	}
});
