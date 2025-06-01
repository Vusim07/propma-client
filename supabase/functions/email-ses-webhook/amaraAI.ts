/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

import type { ParsedEmailContent, SupabaseClient } from './types.ts';

const CREWAI_API_URL =
	'https://renewed-cockatoo-liked.ngrok-free.app/api/v1/process-email';

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
			.eq('active_team_id', emailAddress.team_id)
			.limit(50));
	} else if (emailAddress.user_id) {
		({ data: properties, error: propError } = await supabaseClient
			.from('properties')
			.select('*')
			.eq('agent_id', emailAddress.user_id)
			.limit(50));
	} else {
		throw new Error('No team_id or agent_id found for agent');
	}
	if (propError) throw propError;

	// Only send minimal property fields to CrewAI
	const minimalProperties = (properties || []).map((p) => ({
		id: p.id,
		web_reference: p.web_reference,
		address: p.address,
		status: p.status,
		application_link: p.application_link,
		agent_id: p.agent_id,
	}));

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
		agent_properties: minimalProperties,
		workflow_actions: workflowActions,
	};

	const response = await fetch(CREWAI_API_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error('CrewAI API error:', errorText);

		// Parse error response if possible
		try {
			const errorJson = JSON.parse(errorText);
			if (errorJson.detail) {
				throw new Error(errorJson.detail);
			}
		} catch (parseError) {
			// If can't parse JSON, use raw error text
			console.error('CrewAI API error (raw):', parseError);
		}

		throw new Error(`CrewAI API error: ${errorText}`);
	}

	const result = await response.json();

	// Validate result structure
	if (!result.success) {
		throw new Error(`CrewAI processing failed: ${JSON.stringify(result)}`);
	}

	return result;
}
