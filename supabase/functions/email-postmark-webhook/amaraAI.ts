/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

import type { ParsedEmailContent, SupabaseClient } from './types.ts';

/**
 * Calls the Amara AI agent to generate an email response for a given parsed email and agent context.
 * Fetches agent properties by team_id or user_id as appropriate.
 */
const CREWAI_API_URL =
	Deno.env.get('CREWAI_API_URL') ??
	'https://renewed-cockatoo-liked.ngrok-free.app/api/v1';

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
	// Get agent/team details for context
	let agentName = 'Agent Amara';
	let agentContact = '';

	try {
		if (emailAddress.team_id) {
			const { data: team } = await supabaseClient
				.from('teams')
				.select('name, contact_email')
				.eq('id', emailAddress.team_id)
				.single();
			if (team) {
				agentName =
					team.name && team.name !== 'None' ? team.name : 'Agent Amara';
				agentContact = team.contact_email || '';
			}
		} else if (emailAddress.user_id) {
			const { data: user } = await supabaseClient
				.from('users')
				.select('first_name, phone, email, company_name') // Added company_name instead of company
				.eq('id', emailAddress.user_id)
				.single();
			if (user) {
				// Compose agentName and contact details from available fields
				agentName = user.first_name || user.email || 'Agent Amara';
				const contactParts = [];
				if (user.phone) contactParts.push(user.phone);
				if (user.email) contactParts.push(user.email);
				if (user.company_name) contactParts.push(user.company_name); // Use company_name
				agentContact = contactParts.join(' | ');
			}
		}
	} catch (error) {
		console.warn('Failed to fetch agent details:', error);
	}

	// Fetch agent properties
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
		agent_name: agentName,
		agent_contact: agentContact,
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

	const response = await fetch(`${CREWAI_API_URL}/process-email`, {
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
