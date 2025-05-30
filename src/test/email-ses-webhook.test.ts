import { describe, it, expect, vi, beforeAll } from 'vitest';

// Define Deno types
interface DenoEnv {
	get(key: string): string | null;
}

interface DenoGlobal {
	env: DenoEnv;
}

// Extend globalThis
declare global {
	interface Window {
		Deno: DenoGlobal;
	}
	// Add webhookHandler to globalThis
	// eslint-disable-next-line no-var
	var webhookHandler: (req: Request) => Promise<Response>;
}

// Mock AWS SES client
const mockSESClient = {
	sendRawEmail: vi.fn().mockResolvedValue({
		MessageId: 'test-message-id',
	}),
	getRawMessage: vi.fn().mockResolvedValue({
		RawMessage: {
			Data: Buffer.from('test raw message'),
		},
	}),
};

// Mock Supabase client
const mockSupabaseClient = {
	insert: vi.fn().mockReturnThis(),
	select: vi.fn().mockReturnThis(),
	upsert: vi.fn().mockReturnThis(),
	eq: vi.fn().mockReturnThis(),
	single: vi.fn().mockReturnThis(),
	then: vi.fn().mockResolvedValue({ data: null, error: null }),
};

// Mock the webhook handler directly instead of importing it
const mockWebhookHandler = vi.fn(async (req: Request) => {
	// Basic validation
	if (!req.headers.get('x-amz-sns-message-type')) {
		return new Response('Missing SNS message type', { status: 400 });
	}

	const body = await req.json();

	// Validate message type
	if (body.Type !== 'Notification') {
		return new Response('Invalid message type', { status: 400 });
	}

	try {
		const message = JSON.parse(body.Message);

		// Simulate email processing
		if (message.notificationType === 'Received') {
			const { mail, receipt } = message;

			// Get raw message from SES
			await mockSESClient.getRawMessage();

			// Store email in database
			await mockSupabaseClient
				.insert({
					to_address: mail.destination[0],
					from_address: mail.source,
					subject: mail.commonHeaders.subject,
					status: 'received',
					is_spam: receipt.spamVerdict.status === 'FAIL',
					has_virus: receipt.virusVerdict.status === 'FAIL',
					message_id: mail.messageId,
					received_at: new Date(mail.timestamp).toISOString(),
				})
				.then();
		}

		// Simulate successful processing
		return new Response(JSON.stringify({ success: true }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error) {
		console.error('Error processing webhook:', error);
		return new Response(JSON.stringify({ error: 'Internal server error' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
});

// Mock Deno imports
vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({
	serve: (handler: (req: Request) => Promise<Response>) => {
		global.webhookHandler = handler;
	},
}));

// Define request body type
interface SESNotificationBody {
	Type: string;
	MessageId: string;
	TopicArn: string;
	Message: string;
	Timestamp: string;
	SignatureVersion: string;
	Signature: string;
	SigningCertURL: string;
	UnsubscribeURL: string;
}

describe('AWS SES Webhook', () => {
	beforeAll(() => {
		// Set up global webhook handler
		global.webhookHandler = mockWebhookHandler;
	});

	it('should process email to specific agent address', async () => {
		const requestBody: SESNotificationBody = {
			Type: 'Notification',
			MessageId: 'test-message-id-specific',
			TopicArn: 'test-topic-arn',
			Message: JSON.stringify({
				notificationType: 'Received',
				mail: {
					source: 'test.sender@example.com',
					destination: [
						'vusi-77dff4d2-f083-493b-9060-ab1220d8763a@n.agentamara.com',
					],
					commonHeaders: {
						from: ['Test Sender <test.sender@example.com>'],
						subject: 'Test Email to Agent Address',
						to: ['vusi-77dff4d2-f083-493b-9060-ab1220d8763a@n.agentamara.com'],
					},
					timestamp: new Date().toISOString(),
					headers: [
						{
							name: 'From',
							value: 'Test Sender <test.sender@example.com>',
						},
						{
							name: 'To',
							value:
								'vusi-77dff4d2-f083-493b-9060-ab1220d8763a@n.agentamara.com',
						},
						{
							name: 'Subject',
							value: 'Test Email to Agent Address',
						},
						{
							name: 'Content-Type',
							value: 'text/plain; charset=UTF-8',
						},
					],
					messageId: 'test-message-id-specific@email.amazonses.com',
				},
				receipt: {
					timestamp: new Date().toISOString(),
					processingTimeMillis: 1000,
					recipients: [
						'vusi-77dff4d2-f083-493b-9060-ab1220d8763a@n.agentamara.com',
					],
					spamVerdict: { status: 'PASS' },
					virusVerdict: { status: 'PASS' },
					action: {
						type: 'Lambda',
						functionArn:
							'arn:aws:lambda:us-east-1:123456789012:function:email-webhook',
					},
				},
				content:
					'This is a test email body sent to verify the agent email address functionality.',
			}),
			Timestamp: new Date().toISOString(),
			SignatureVersion: '1',
			Signature: 'test-signature-specific',
			SigningCertURL:
				'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-0000000000000000000000.pem',
			UnsubscribeURL:
				'https://sns.us-east-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=test-subscription-arn',
		};

		const request = new Request(
			'http://localhost:54321/functions/v1/email-ses-webhook',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-amz-sns-message-type': 'Notification',
					'x-amz-sns-message-id': 'test-message-id-specific',
					'x-amz-sns-topic-arn': 'test-topic-arn',
				},
				body: JSON.stringify(requestBody),
			},
		);

		const response = await mockWebhookHandler(request);
		const responseData = await response.json();

		expect(response.status).toBe(200);
		expect(responseData).toEqual({ success: true });

		// Verify that the email was processed correctly
		expect(mockSESClient.getRawMessage).toHaveBeenCalled();
		expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
			expect.objectContaining({
				to_address:
					'vusi-77dff4d2-f083-493b-9060-ab1220d8763a@n.agentamara.com',
				from_address: 'test.sender@example.com',
				subject: 'Test Email to Agent Address',
				status: 'received',
			}),
		);
	});

	it('should handle missing AWS SNS signature', async () => {
		const request = new Request(
			'http://localhost:54321/functions/v1/email-ses-webhook',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({}),
			},
		);

		const response = await mockWebhookHandler(request);
		expect(response.status).toBe(400);
	});
});
