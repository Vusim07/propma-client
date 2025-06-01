export interface ParsedEmailContent {
	body: string;
	htmlBody: string | null;
	hasAttachments: boolean;
	rawMessage: string;
	attachments?: Array<{
		filename: string;
		contentType: string;
		content: Uint8Array;
	}>;
	headers: Record<string, string>;
	references?: string[];
	inReplyTo?: string;
}

export interface EmailHeaders {
	from: string[];
	subject?: string;
	date?: string;
	to?: string[];
	cc?: string[];
	bcc?: string[];
}

export interface EmailData {
	source: string;
	destination: string[];
	commonHeaders: EmailHeaders;
	timestamp: string;
}

export interface SupabaseClient {
	from: (table: string) => {
		insert: (
			data: Record<string, unknown>,
		) => Promise<{ error: Error | null; data?: unknown }>;
		select: (columns?: string) => {
			eq: (
				column: string,
				value: unknown,
			) => {
				single: () => Promise<{ error: Error | null; data?: unknown }>;
			};
		};
		upsert: (data: Record<string, unknown>) => {
			select: () => {
				single: () => Promise<{ error: Error | null; data?: unknown }>;
			};
		};
	};
}

export interface SNSMessage {
	Type: 'Notification' | 'SubscriptionConfirmation' | 'UnsubscribeConfirmation';
	MessageId: string;
	TopicArn: string;
	Message: string;
	Timestamp: string;
	SignatureVersion: string;
	Signature: string;
	SigningCertURL: string;
	SubscribeURL?: string;
	UnsubscribeURL?: string;
}

export interface SESNotification {
	Records: Array<{
		eventSource: string;
		eventVersion: string;
		ses: {
			mail: {
				timestamp: string;
				source: string;
				messageId: string;
				destination: string[];
				headersTruncated: boolean;
				headers: Array<{
					name: string;
					value: string;
				}>;
				commonHeaders: {
					from: string[];
					to: string[];
					messageId: string;
					subject: string;
				};
			};
			receipt: {
				timestamp: string;
				processingTimeMillis: number;
				recipients: string[];
				spamVerdict: { status: string };
				virusVerdict: { status: string };
				spfVerdict: { status: string };
				dkimVerdict: { status: string };
				dmarcVerdict: { status: string };
				action: {
					type: string;
					bucketName?: string;
					objectKey?: string;
				};
			};
		};
	}>;
}
