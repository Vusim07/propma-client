/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { ProcessedEmail } from '../types.ts';
import { amaraAI } from '../amaraAI.ts';
import { retryOperation, sanitizeEmailBody } from '../utils.ts';

export async function handleAIResponse(
	processedEmail: ProcessedEmail,
	supabaseClient: any,
) {
	const { payload, thread, leadInfo } = processedEmail;

	try {
		const aiResult = await amaraAI({
			parsedEmail: {
				body: payload.TextBody,
				htmlBody: payload.HtmlBody,
				hasAttachments: payload.Attachments.length > 0,
				attachments: payload.Attachments.map((a) => ({
					filename: a.Name,
					contentType: a.ContentType,
				})),
				headers: payload.Headers.reduce(
					(acc, h) => ({ ...acc, [h.Name.toLowerCase()]: h.Value }),
					{},
				),
				leadInfo,
			},
			thread,
			emailAddress: {
				id: thread.team_id || thread.user_id,
				team_id: thread.team_id,
				user_id: thread.user_id,
			},
			supabaseClient,
		});

		if (!aiResult?.response) return;

		const outgoingMessageId = await storeAIResponse(
			thread.id,
			processedEmail,
			aiResult,
			supabaseClient,
		);

		if (outgoingMessageId) {
			await sendResponseEmail(
				outgoingMessageId,
				processedEmail,
				aiResult,
				supabaseClient,
			);
		}
	} catch (error) {
		console.error('AI processing failed:', error);
	}
}

async function storeAIResponse(
	threadId: string,
	processedEmail: ProcessedEmail,
	aiResult: any,
	supabaseClient: any,
): Promise<string | null> {
	const { payload, replyToEmail } = processedEmail;
	let outgoingMessageId: string | null = null;

	await retryOperation(async () => {
		const { data, error } = await supabaseClient
			.from('email_messages')
			.insert({
				thread_id: threadId,
				from_address: payload.To,
				to_address: replyToEmail,
				subject:
					aiResult.response.subject || `Re: ${processedEmail.thread?.subject}`,
				body: sanitizeEmailBody(
					typeof aiResult.response?.body === 'string'
						? aiResult.response.body
						: JSON.stringify(aiResult.response),
				),
				status: 'queued',
				is_read: false,
				sent_at: null,
				ai_generated: true,
				ai_confidence: aiResult.validation?.confidence ?? null,
				ai_validation: aiResult.validation || null,
				created_at: new Date().toISOString(),
			})
			.select('id')
			.single();

		if (error) throw error;
		outgoingMessageId = data?.id;
	}, 'store AI response message');

	return outgoingMessageId;
}

async function sendResponseEmail(
	messageId: string,
	processedEmail: ProcessedEmail,
	aiResult: any,
) {
	const { payload, thread, replyToEmail } = processedEmail;

	const outgoingPayload = {
		messageId,
		to: replyToEmail,
		subject: aiResult.response.subject || `Re: ${thread?.subject}`,
		body: sanitizeEmailBody(
			typeof aiResult.response?.body === 'string'
				? aiResult.response.body
				: JSON.stringify(aiResult.response),
		),
		replyTo: payload.To,
		userId: thread?.user_id || undefined,
		teamId: thread?.team_id || undefined,
	};

	const sendRes = await fetch(
		`${Deno.env.get('SUPABASE_URL')}/functions/v1/email-postmark-send`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
			},
			body: JSON.stringify(outgoingPayload),
		},
	);

	if (!sendRes.ok) {
		const errText = await sendRes.text();
		throw new Error(`Failed to send email: ${errText}`);
	}
}
