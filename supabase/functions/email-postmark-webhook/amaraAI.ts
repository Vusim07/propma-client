/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import type { ParsedEmailContent, SupabaseClient } from './types.ts';

interface AmaraAIConfig {
	parsedEmail: ParsedEmailContent;
	thread: { subject: string; [key: string]: unknown };
	emailAddress: { team_id?: string; user_id?: string };
	supabaseClient: SupabaseClient;
}

interface MinimalProperty {
	id: string;
	web_reference: string;
	address: string;
	status: string;
	application_link?: string;
	agent_id?: string;
}

interface WorkflowActions {
	agent_name: string;
	agent_contact: string;
}

interface CrewAIPayload {
	agent_id: string;
	workflow_id: string;
	email_content: string;
	email_subject: string;
	email_from: string;
	email_date: string;
	agent_properties: MinimalProperty[];
	workflow_actions: WorkflowActions;
}

interface CrewAIResponse {
	success: boolean;
	response: {
		subject: string;
		body: string;
	};
	validation?: {
		confidence: number;
		[key: string]: unknown;
	};
}

const CREWAI_API_URL =
	Deno.env.get('CREWAI_API_URL') ??
	'https://renewed-cockatoo-liked.ngrok-free.app/api/v1';

export async function amaraAI(config: AmaraAIConfig): Promise<CrewAIResponse> {
	const { agentName, agentContact } = await fetchAgentDetails(config);
	const minimalProperties = await fetchAgentProperties(config);

	const payload = createCrewAIPayload({
		...config,
		agentName,
		agentContact,
		minimalProperties,
	});

	return callCrewAIAPI(payload);
}

async function fetchAgentDetails({
	emailAddress,
	supabaseClient,
}: AmaraAIConfig) {
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
				.select('first_name, phone, email, company_name')
				.eq('id', emailAddress.user_id)
				.single();

			if (user) {
				agentName = user.first_name || user.email || 'Agent Amara';
				agentContact = [user.phone, user.email, user.company_name]
					.filter(Boolean)
					.join(' | ');
			}
		}
	} catch (error) {
		console.warn('Failed to fetch agent details:', error);
	}

	return { agentName, agentContact };
}

async function fetchAgentProperties({
	emailAddress,
	supabaseClient,
}: AmaraAIConfig): Promise<MinimalProperty[]> {
	if (!emailAddress.team_id && !emailAddress.user_id) {
		throw new Error('No team_id or user_id found for agent');
	}

	const { data: properties, error } = await supabaseClient
		.from('properties')
		.select('id, web_reference, address, status, application_link, agent_id')
		.eq(
			emailAddress.team_id ? 'active_team_id' : 'agent_id',
			emailAddress.team_id || emailAddress.user_id,
		)
		.limit(50);

	if (error) throw error;

	return properties || [];
}

function createCrewAIPayload({
	parsedEmail,
	thread,
	emailAddress,
	agentName,
	agentContact,
	minimalProperties,
}: AmaraAIConfig & {
	agentName: string;
	agentContact: string;
	minimalProperties: MinimalProperty[];
}): CrewAIPayload {
	return {
		agent_id: emailAddress.team_id || emailAddress.user_id || '',
		workflow_id: 'default',
		email_content: parsedEmail.body,
		email_subject: thread.subject,
		email_from: parsedEmail.headers['from'] || '',
		email_date: new Date().toISOString(),
		agent_properties: minimalProperties,
		workflow_actions: {
			agent_name: agentName,
			agent_contact: agentContact,
		},
	};
}

async function callCrewAIAPI(payload: CrewAIPayload): Promise<CrewAIResponse> {
	const response = await fetch(`${CREWAI_API_URL}/process-email`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error('CrewAI API error:', errorText);
		throw new Error(parseCrewAIError(errorText));
	}

	const result = await response.json();

	if (!result.success) {
		throw new Error(`CrewAI processing failed: ${JSON.stringify(result)}`);
	}

	return result;
}

function parseCrewAIError(errorText: string): string {
	try {
		const errorJson = JSON.parse(errorText);
		return errorJson.detail || errorText;
	} catch {
		return errorText;
	}
}
