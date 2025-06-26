/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { ProcessedEmail, EmailThread } from '../types.ts';
import { retryOperation, sanitizeEmailBody } from '../utils.ts';

export async function handleThreadCreation(
	processedEmail: ProcessedEmail,
	cleanToAddress: string,
	supabaseClient: any,
): Promise<EmailThread> {
	const { payload, leadInfo } = processedEmail;

	// Find email address in our system
	const emailAddress = await retryOperation(async () => {
		const { data, error } = await supabaseClient
			.from('email_addresses')
			.select('id, team_id, user_id')
			.eq('email_address', cleanToAddress)
			.single();

		if (error) throw error;
		if (!data) throw new Error(`Email address not found: ${cleanToAddress}`);
		return data;
	}, 'find email address');

	// Check usage limits
	await checkUsageLimits(emailAddress, supabaseClient);

	// Create thread
	const threadInsert = {
		subject: payload.Subject || '(No Subject)',
		last_message_at: new Date(payload.Date).toISOString(),
		status: 'received',
		priority: 'normal',
		needs_follow_up: false,
		lead_email: leadInfo.email,
		lead_name: leadInfo.name,
		lead_phone: leadInfo.phone,
		...(emailAddress.team_id ? { team_id: emailAddress.team_id } : {}),
		...(emailAddress.user_id ? { user_id: emailAddress.user_id } : {}),
	};

	const thread = await retryOperation(async () => {
		const { data, error } = await supabaseClient
			.from('email_threads')
			.insert(threadInsert)
			.select()
			.single();
		if (error) throw error;
		return data;
	}, 'create email thread');

	// Store the message
	await storeMessage(thread.id, processedEmail, supabaseClient);

	return thread;
}

async function checkUsageLimits(emailAddress: any, supabaseClient: any) {
	const usageCheck = await supabaseClient.rpc('increment_inbox_usage', {
		p_user_id: emailAddress.user_id || null,
		p_team_id: emailAddress.team_id || null,
		check_only: true,
	});

	if (usageCheck.error) throw usageCheck.error;
	if (usageCheck.data?.limit_reached) {
		await notifyLimitReached(emailAddress, supabaseClient);
		throw new Error('Inbox/conversation limit reached');
	}
}

async function notifyLimitReached(emailAddress: any, supabaseClient: any) {
	// Notify affected user(s) by email
	let notificationEmails = [];

	if (emailAddress.user_id) {
		// Fetch the user's email
		const { data: user, error: userError } = await supabaseClient
			.from('users')
			.select('email')
			.eq('id', emailAddress.user_id)
			.single();

		if (!userError && user?.email) {
			notificationEmails.push(user.email);
		}
	} else if (emailAddress.team_id) {
		// Fetch all users in the team
		const { data: teamMembers, error: teamError } = await supabaseClient
			.from('team_members')
			.select('user_id')
			.eq('team_id', emailAddress.team_id);

		if (!teamError && Array.isArray(teamMembers) && teamMembers.length > 0) {
			const userIds = teamMembers.map((m) => m.user_id);
			const { data: users, error: usersError } = await supabaseClient
				.from('users')
				.select('email')
				.in('id', userIds);

			if (!usersError && Array.isArray(users)) {
				notificationEmails = users.map((u) => u.email).filter(Boolean);
			}
		}
	}

	// Send notification email(s) if any
	if (notificationEmails.length > 0) {
		const notificationSubject = 'Amara: Inbox/Conversation Limit Reached';
		const notificationBody =
			'Your Amara subscription plan inbox/conversation limit has been reached.\n\n' +
			'You will not be able to start new conversations until you upgrade your plan.\n\n' +
			'If you have questions, please contact support.';

		for (const email of notificationEmails) {
			await fetch(
				`${Deno.env.get('SUPABASE_URL')}/functions/v1/email-postmark-send`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${Deno.env.get(
							'SUPABASE_SERVICE_ROLE_KEY',
						)}`,
					},
					body: JSON.stringify({
						to: email,
						subject: notificationSubject,
						body: notificationBody,
					}),
				},
			);
		}
	}
}

async function storeMessage(
	threadId: string,
	processedEmail: ProcessedEmail,
	supabaseClient: any,
) {
	const { payload, leadInfo } = processedEmail;

	const { error } = await supabaseClient.from('email_messages').insert({
		thread_id: threadId,
		message_id: payload.MessageID,
		from_address: payload.From,
		from_name: payload.FromName,
		to_address: payload.To,
		subject: payload.Subject || '(No Subject)',
		body: sanitizeEmailBody(payload.TextBody),
		body_html: payload.HtmlBody,
		status: 'received',
		is_read: false,
		has_attachments: payload.Attachments.length > 0,
		received_at: new Date(payload.Date).toISOString(),
		lead_email: leadInfo.email,
		lead_name: leadInfo.name,
		lead_phone: leadInfo.phone,
		is_contact_form: !!leadInfo.email,
	});

	if (error) throw error;

	// Store attachments if any
	if (payload.Attachments.length > 0) {
		for (const attachment of payload.Attachments) {
			const { error: attachmentError } = await supabaseClient
				.from('email_attachments')
				.insert({
					message_id: payload.MessageID,
					file_name: attachment.Name,
					file_type: attachment.ContentType,
					file_size: attachment.ContentLength,
					storage_path: `attachments/${payload.MessageID}/${attachment.Name}`,
				});
			if (attachmentError) throw attachmentError;
		}
	}

	// Store raw message
	const { error: rawError } = await supabaseClient
		.from('email_raw_messages')
		.insert({
			message_id: payload.MessageID,
			raw_content: JSON.stringify(payload),
			created_at: new Date().toISOString(),
		});
	if (rawError) throw rawError;
}
