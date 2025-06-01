/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

import type { ParsedEmailContent, SupabaseClient } from './types.ts';

const CREWAI_API_URL =
	Deno.env.get('CREWAI_API_URL') ||
	'http://localhost:8000/api/v1/process-email';

/**
 * Calls the Amara AI agent to generate an email response for a given parsed email and agent context.
 * Fetches agent properties by team_id or user_id as appropriate.
 */
export async function amaraAI({
	parsedEmail,
	thread,
	emailAddress,
	supabaseClient,
}: {
	parsedEmail: ParsedEmailContent;
	thread: Record<string, unknown>;
	emailAddress: { team_id?: string; user_id?: string };
	supabaseClient: SupabaseClient;
}) {
	// Fetch agent properties for this team/user
	let properties, propError;
	if (emailAddress.team_id) {
		({ data: properties, error: propError } = await supabaseClient
			.from('properties')
			.select('*')
			.eq('team_id', emailAddress.team_id)
			.limit(50));
	} else if (emailAddress.user_id) {
		({ data: properties, error: propError } = await supabaseClient
			.from('properties')
			.select('*')
			.eq('user_id', emailAddress.user_id)
			.limit(50));
	} else {
		throw new Error('No team_id or user_id found for agent');
	}
	if (propError) throw propError;

	const workflowActions = {
		agent_name: 'Agent Amara',
		agent_contact: '', // TODO: fetch from agent/team profile
	};

	const payload = {
		agent_id: emailAddress.team_id || emailAddress.user_id,
		workflow_id: 'default',
		email_content: parsedEmail.body,
		email_subject: thread.subject,
		email_from: parsedEmail.headers['from'] || '',
		email_date: new Date().toISOString(),
		agent_properties: properties || [],
		workflow_actions: workflowActions,
	};

	const response = await fetch(`${CREWAI_API_URL}/process-email`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`CrewAI API error: ${errorText}`);
	}
	return await response.json();
}
