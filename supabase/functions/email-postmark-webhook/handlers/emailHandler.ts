/* eslint-disable @typescript-eslint/no-explicit-any */
import { PostmarkInboundEmail, ProcessedEmail } from '../types.ts';
import { extractLeadInfo } from '../extractLeadInfo.ts';
import { extractEmailAddress } from '../utils.ts';
import { handleThreadCreation } from './threadHandler.ts';
import { handleAIResponse } from './aiHandler.ts';

export async function processIncomingEmail(
	req: Request,
	supabaseClient: any,
): Promise<ProcessedEmail> {
	const payload: PostmarkInboundEmail = await req.json();

	// Extract lead information
	const leadInfo = extractLeadInfo(payload.TextBody);
	const replyToEmail = leadInfo.email || payload.From;
	const replyToName = leadInfo.name || payload.FromName;

	// Process the email
	const cleanToAddress = extractEmailAddress(payload.To);
	const processedEmail: ProcessedEmail = {
		payload,
		leadInfo,
		replyToEmail,
		replyToName,
	};

	// Handle thread creation and message processing
	processedEmail.thread = await handleThreadCreation(
		processedEmail,
		cleanToAddress,
		supabaseClient,
	);

	// Generate and send AI response if applicable
	await handleAIResponse(processedEmail, supabaseClient);

	return processedEmail;
}
