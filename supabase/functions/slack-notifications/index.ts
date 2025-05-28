/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Define types for our payloads
interface UserPayload {
	first_name: string;
	last_name: string;
	email: string;
	company_name: string | null;
	role: string;
	phone: string | null;
	type: 'user_created' | 'user_updated';
}

interface SubscriptionPayload {
	id: string;
	user_id: string;
	plan_name: string;
	plan_price: number;
	team_id: string | null;
	plan_type: string | null;
	is_team: boolean;
	usage_limit: number;
	current_usage: number;
	status: string;
	paystack_subscription_id: string;
	start_date: string;
	end_date: string | null;
	type: 'subscription_created';
}

type NotificationPayload = UserPayload | SubscriptionPayload;

// Helper function to format currency
const formatCurrency = (amount: number): string => {
	return new Intl.NumberFormat('en-ZA', {
		style: 'currency',
		currency: 'ZAR',
	}).format(amount);
};

// Helper function to format date
const formatDate = (dateString: string): string => {
	return new Date(dateString).toLocaleDateString('en-ZA', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
};

// Function to create user notification message
const createUserMessage = (payload: UserPayload): string => {
	const emoji = payload.type === 'user_created' ? '🎉' : '🎉';
	const action = payload.type === 'user_created' ? 'created' : 'updated';

	const message = [
		`${emoji} A user has been ${action}!`,
		'',
		`*Name:* ${payload.first_name} ${payload.last_name}`,
		`*Email:* ${payload.email}`,
		`*Role:* ${payload.role}`,
		payload.company_name ? `*Company:* ${payload.company_name}` : null,
		payload.phone ? `*Phone:* ${payload.phone}` : null,
	]
		.filter(Boolean)
		.join('\n');

	return message;
};

// Function to create subscription notification message
const createSubscriptionMessage = (payload: SubscriptionPayload): string => {
	const message = [
		'💳 New subscription created! 🎉',
		'',
		`*Plan:* ${payload.plan_name}`,
		`*Price:* ${formatCurrency(payload.plan_price)}`,
		`*Type:* ${payload.is_team ? 'Team' : 'Individual'} plan`,
		`*Usage Limit:* ${payload.usage_limit} screenings`,
		`*Status:* ${payload.status}`,
		`*Start Date:* ${formatDate(payload.start_date)}`,
		payload.end_date ? `*End Date:* ${formatDate(payload.end_date)}` : null,
		payload.team_id ? `*Team ID:* ${payload.team_id}` : null,
	]
		.filter(Boolean)
		.join('\n');

	return message;
};

serve(async (req) => {
	try {
		const payload = (await req.json()) as NotificationPayload;
		const slackWebhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');

		if (!slackWebhookUrl) {
			throw new Error('SLACK_WEBHOOK_URL environment variable is not set');
		}

		// Validate payload type
		if (!payload.type) {
			throw new Error('Payload must include a type field');
		}

		// Create appropriate message based on payload type
		let slackMessage: { text: string };

		if (payload.type === 'user_created' || payload.type === 'user_updated') {
			slackMessage = { text: createUserMessage(payload as UserPayload) };
		} else if (payload.type === 'subscription_created') {
			slackMessage = {
				text: createSubscriptionMessage(payload as SubscriptionPayload),
			};
		} else {
			throw new Error(`Unknown notification type: ${payload.type}`);
		}

		// Send to Slack
		const slackResponse = await fetch(slackWebhookUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(slackMessage),
		});

		if (!slackResponse.ok) {
			const errorText = await slackResponse.text();
			console.error('Slack webhook failed:', errorText);
			return new Response('Slack notification failed', { status: 500 });
		}

		return new Response('Notification sent to Slack!', { status: 200 });
	} catch (error) {
		console.error('Error processing notification:', error);
		return new Response(
			JSON.stringify({ error: error.message || 'Internal server error' }),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			},
		);
	}
});
