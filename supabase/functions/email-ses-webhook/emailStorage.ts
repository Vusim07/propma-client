import { retryOperation } from './utils.ts';
import { ParsedEmailContent, EmailData, SupabaseClient } from './types.ts';

export async function storeEmailWithRetry(
	supabaseClient: SupabaseClient,
	messageId: string,
	threadId: string,
	parsedEmail: ParsedEmailContent,
	emailData: EmailData,
	s3Bucket?: string,
	s3Key?: string,
) {
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
