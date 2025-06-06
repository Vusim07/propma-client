/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface SendEmailRequest {
	to: string;
	subject: string;
	textBody?: string;
	htmlBody?: string;
	from?: string;
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

		// Validate required fields
		if (
			!payload.to ||
			!payload.subject ||
			(!payload.textBody && !payload.htmlBody)
		) {
			return new Response(
				JSON.stringify({ error: 'Missing required fields' }),
				{
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					status: 400,
				},
			);
		}

		// Prepare the email payload for Postmark
		const emailPayload = {
			From: payload.from || Deno.env.get('POSTMARK_FROM_EMAIL'),
			To: payload.to,
			Subject: payload.subject,
			TextBody: payload.textBody,
			HtmlBody: payload.htmlBody,
			ReplyTo: payload.replyTo,
			Tag: payload.tag,
			Metadata: payload.metadata,
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

		// Store the sent email in the database
		const { error: emailError } = await supabaseClient.from('emails').insert({
			from_email: emailPayload.From,
			to_email: emailPayload.To,
			subject: emailPayload.Subject,
			text_content: emailPayload.TextBody,
			html_content: emailPayload.HtmlBody,
			message_id: result.MessageID,
			sent_at: new Date().toISOString(),
			status: 'sent',
			tag: emailPayload.Tag,
			metadata: emailPayload.Metadata,
		});

		if (emailError) {
			console.error('Error storing sent email:', emailError);
			throw emailError;
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
		return new Response(JSON.stringify({ error: 'Internal server error' }), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			status: 500,
		});
	}
});
