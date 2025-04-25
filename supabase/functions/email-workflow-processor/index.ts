/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// Deno-specific imports that won't be resolved by the TS compiler in VS Code
// but will work in the Supabase Edge Function environment
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

// Types definition
interface EmailWorkflow {
	id: string;
	agent_id: string;
	name: string;
	active: boolean;
	email_filter: {
		subject_contains?: string[];
		body_contains?: string[];
	};
	actions: {
		send_application_link: boolean;
		custom_message?: string;
	};
}

interface WorkflowLog {
	workflow_id: string;
	tenant_id?: string;
	application_id?: string;
	status: string;
	error_message?: string;
	email_subject?: string;
	email_from?: string;
	action_taken?: string;
}

interface EmailMessage {
	id: string;
	subject: string;
	body: string;
	from: string;
	from_name?: string;
	timestamp: string;
}

interface Property {
	id: string;
	address: string;
	city: string;
	suburb: string;
	property_type: string;
	web_reference: string;
	bedrooms: number;
	bathrooms: number;
	monthly_rent: number;
	application_link: string;
	[key: string]: any;
}

interface AgentProfile {
	id: string;
	first_name: string;
	last_name: string;
	email: string;
	phone?: string;
}

// Function to fetch workflows for an agent
async function getAgentWorkflows(
	supabase,
	agentId: string,
): Promise<EmailWorkflow[]> {
	const { data, error } = await supabase
		.from('email_workflows')
		.select('*')
		.eq('agent_id', agentId)
		.eq('active', true);

	if (error) {
		console.error('Error fetching workflows:', error.message);
		return [];
	}

	return data || [];
}

// Function to fetch properties for an agent
async function getAgentProperties(
	supabase,
	agentId: string,
): Promise<Property[]> {
	const { data, error } = await supabase
		.from('properties')
		.select('*')
		.eq('agent_id', agentId);

	if (error) {
		console.error('Error fetching properties:', error.message);
		return [];
	}

	return data || [];
}

// Function to fetch agent details
async function getAgentDetails(
	supabase,
	agentId: string,
): Promise<AgentProfile | null> {
	const { data, error } = await supabase
		.from('users')
		.select('*')
		.eq('id', agentId)
		.single();

	if (error) {
		console.error('Error fetching agent details:', error.message);
		return null;
	}

	return data;
}

// Function to log workflow execution
async function logWorkflowExecution(
	supabase,
	workflowId: string,
	emailData: Partial<EmailMessage>,
	status: string,
	actionTaken?: string,
	errorMessage?: string,
): Promise<string | null> {
	const logEntry: WorkflowLog = {
		workflow_id: workflowId,
		status,
		email_subject: emailData.subject,
		email_from: emailData.from,
		action_taken: actionTaken,
		error_message: errorMessage,
	};

	const { data, error } = await supabase
		.from('workflow_logs')
		.insert(logEntry)
		.select()
		.single();

	if (error) {
		console.error('Error logging workflow execution:', error.message);
		return null;
	}

	return data.id;
}

// Function to check if an email matches workflow filters
function emailMatchesWorkflow(
	email: EmailMessage,
	workflow: EmailWorkflow,
): boolean {
	const emailSubject = email.subject?.toLowerCase() || '';
	const emailBody = email.body?.toLowerCase() || '';

	const subjectFilters =
		workflow.email_filter?.subject_contains?.map((f) => f.toLowerCase()) || [];
	const bodyFilters =
		workflow.email_filter?.body_contains?.map((f) => f.toLowerCase()) || [];

	// Check subject matches
	const subjectMatch =
		subjectFilters.length > 0
			? subjectFilters.some((filter) => emailSubject.includes(filter))
			: false;

	// Check body matches
	const bodyMatch =
		bodyFilters.length > 0
			? bodyFilters.some((filter) => emailBody.includes(filter))
			: false;

	return subjectMatch || bodyMatch;
}

// Function to get emails from connected provider
async function getNewEmails(
	supabase,
	agentId: string,
	provider: string,
	sinceTimestamp: string,
): Promise<EmailMessage[]> {
	// In a real implementation, we would:
	// 1. Get the provider connection details from calendar_integrations table
	// 2. Use the refresh_token to get a new access_token if needed
	// 3. Call the provider's API to get new emails

	// For development purposes, return mock data
	console.log(
		`Getting emails for agent ${agentId} from ${provider} since ${sinceTimestamp}`,
	);

	// This is where you'd integrate with Gmail or Outlook APIs
	// For now, we'll return mock data
	return [
		{
			id: `email_${Date.now()}_1`,
			subject: 'Property Inquiry for Apartment in Cloverdene',
			body: "Hi, I saw your listing for the 2 Bed Apartment in Cloverdene and I'm very interested. Is it still available? Thanks, John",
			from: 'john.tenant@example.com',
			from_name: 'John Tenant',
			timestamp: new Date().toISOString(),
		},
		{
			id: `email_${Date.now()}_2`,
			subject: 'Available property?',
			body: "Hello, I'm looking for a 3 bedroom house. Do you have anything available? Best regards, Mary",
			from: 'mary.renter@example.com',
			from_name: 'Mary Renter',
			timestamp: new Date().toISOString(),
		},
	];
}

// Function to process emails and generate responses using Amara AI
async function processEmailWithAmaraAI(
	emailSubject: string,
	emailContent: string,
	properties: Property[],
	workflowActions: EmailWorkflow['actions'],
	agentName: string,
): Promise<string> {
	// In a real implementation, this would call the Amara AI service
	// For now, generate a simple response

	try {
		// This is where we would call the Amara AI service
		// Example API call (commented out):
		/*
    const response = await fetch('https://your-amara-ai-service.com/api/process-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_subject: emailSubject,
        email_content: emailContent,
        agent_properties: properties,
        workflow_actions: workflowActions,
        agent_name: agentName
      })
    });
    
    if (!response.ok) {
      throw new Error(`Error calling Amara AI: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result.response_text;
    */

		// For development, return a template response
		const propertyList = properties
			.slice(0, 3)
			.map(
				(p) =>
					`- ${p.address} (${p.bedrooms} bed, ${p.bathrooms} bath, R${p.monthly_rent})`,
			)
			.join('\n');

		const applicationLink =
			properties.length > 0 ? properties[0].application_link : '#';

		let message = workflowActions.custom_message || '';
		if (!message) {
			message = `Thank you for your interest in our properties.

Based on your inquiry, I think the following properties might be suitable for you:

${propertyList}

To apply for any of these properties, please use this link:
${applicationLink}

Please let me know if you have any questions or would like to schedule a viewing.`;
		}

		return `${message}

Best regards,
${agentName}`;
	} catch (error) {
		console.error('Error processing email with Amara AI:', error.message);
		return `Thank you for your inquiry. We will get back to you shortly.

Best regards,
${agentName}`;
	}
}

// Function to send email response
async function sendEmailResponse(
	supabase,
	agentId: string,
	provider: string,
	toEmail: string,
	subject: string,
	body: string,
): Promise<{ success: boolean; error?: string }> {
	// In a real implementation, this would:
	// 1. Get the provider connection details
	// 2. Use the refresh_token to get a new access_token if needed
	// 3. Call the provider's API to send an email

	console.log(`Would send email to ${toEmail} via ${provider}:`);
	console.log(`Subject: ${subject}`);
	console.log(`Body: ${body.substring(0, 100)}...`);

	// This is where you'd integrate with Gmail or Outlook APIs
	// For now, just return success
	return { success: true };
}

// Main processing function for all agents
async function processAllAgentsWorkflows(
	supabase,
): Promise<{ processed: number; errors: number }> {
	// Get all agents with active workflows
	const { data: agents, error } = await supabase
		.from('email_workflows')
		.select('agent_id')
		.eq('active', true)
		.is('email_filter', 'not.null');

	if (error) {
		console.error('Error fetching agents with workflows:', error.message);
		return { processed: 0, errors: 1 };
	}

	// Extract unique agent IDs
	const agentIds = [...new Set(agents.map((w) => w.agent_id))];
	console.log(`Found ${agentIds.length} agents with active workflows`);

	let processed = 0;
	let errors = 0;

	// Process each agent's inbox
	for (const agentId of agentIds) {
		try {
			// Process this agent's inbox
			const result = await processAgentInbox(supabase, agentId);
			processed += result.processed;
			errors += result.errors;
		} catch (e) {
			console.error(`Error processing agent ${agentId}:`, e.message);
			errors++;
		}
	}

	return { processed, errors };
}

// Process a single agent's inbox
async function processAgentInbox(
	supabase,
	agentId: string,
	provider: string = 'gmail',
): Promise<{ processed: number; errors: number }> {
	console.log(`Processing inbox for agent ${agentId}`);

	// Get agent details
	const agent = await getAgentDetails(supabase, agentId);
	if (!agent) {
		console.error(`Agent ${agentId} not found`);
		return { processed: 0, errors: 1 };
	}

	// Format agent name
	const agentName = `${agent.first_name} ${agent.last_name}`;

	// Get agent's workflows
	const workflows = await getAgentWorkflows(supabase, agentId);
	if (workflows.length === 0) {
		console.log(`No active workflows found for agent ${agentId}`);
		return { processed: 0, errors: 0 };
	}

	// Get agent's properties
	const properties = await getAgentProperties(supabase, agentId);

	// Get timestamp for emails (24 hours ago)
	const sinceTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

	// Get new emails
	const emails = await getNewEmails(supabase, agentId, provider, sinceTime);
	console.log(`Found ${emails.length} new emails for processing`);

	let processed = 0;
	let errors = 0;

	// Process each email
	for (const email of emails) {
		// Find matching workflow
		for (const workflow of workflows) {
			if (emailMatchesWorkflow(email, workflow)) {
				console.log(`Email ${email.id} matches workflow ${workflow.id}`);

				try {
					// Process email with Amara AI
					const responseText = await processEmailWithAmaraAI(
						email.subject,
						email.body,
						properties,
						workflow.actions,
						agentName,
					);

					// Log success
					await logWorkflowExecution(
						supabase,
						workflow.id,
						email,
						'success',
						'Generated response with Amara AI',
					);

					// Send response
					const sendResult = await sendEmailResponse(
						supabase,
						agentId,
						provider,
						email.from,
						`Re: ${email.subject}`,
						responseText,
					);

					if (sendResult.success) {
						console.log(`Successfully sent response to ${email.from}`);
						processed++;
					} else {
						console.error(`Failed to send response: ${sendResult.error}`);
						errors++;
					}
				} catch (e) {
					console.error(`Error processing email ${email.id}:`, e.message);

					// Log error
					await logWorkflowExecution(
						supabase,
						workflow.id,
						email,
						'error',
						undefined,
						e.message,
					);

					errors++;
				}

				// Only process the first matching workflow
				break;
			}
		}
	}

	return { processed, errors };
}

serve(async (req) => {
	// Handle CORS
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	try {
		// Create a Supabase client with the Auth context of the function
		const supabaseClient = createClient(
			Deno.env.get('SUPABASE_URL') ?? '',
			Deno.env.get('SUPABASE_ANON_KEY') ?? '',
			{
				global: {
					headers: { Authorization: req.headers.get('Authorization')! },
				},
			},
		);

		// Check if this is an HTTP request with an agent_id parameter
		if (req.method === 'POST') {
			const body = await req.json();
			const agentId = body.agent_id;
			const provider = body.provider || 'gmail';

			if (agentId) {
				// Process a single agent
				const result = await processAgentInbox(
					supabaseClient,
					agentId,
					provider,
				);
				return new Response(JSON.stringify({ success: true, ...result }), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					status: 200,
				});
			} else {
				// Process all agents
				const result = await processAllAgentsWorkflows(supabaseClient);
				return new Response(JSON.stringify({ success: true, ...result }), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					status: 200,
				});
			}
		}

		// Default response for other HTTP methods
		return new Response(JSON.stringify({ error: 'Method not allowed' }), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			status: 405,
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: error.message }), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			status: 500,
		});
	}
});
