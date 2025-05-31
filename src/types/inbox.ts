import { Database } from '../services/database.types';

// Email status and priority enums
export type EmailStatus =
	| 'received'
	| 'sent'
	| 'draft'
	| 'archived'
	| 'deleted'
	| 'bounced'
	| 'failed';
export type EmailPriority = 'low' | 'normal' | 'high' | 'urgent';

// Base types from database
export type EmailAddress =
	Database['public']['Tables']['email_addresses']['Row'];
export type InsertEmailAddress =
	Database['public']['Tables']['email_addresses']['Insert'];
export type UpdateEmailAddress =
	Database['public']['Tables']['email_addresses']['Update'];

export type EmailThread = Database['public']['Tables']['email_threads']['Row'];
export type InsertEmailThread =
	Database['public']['Tables']['email_threads']['Insert'];
export type UpdateEmailThread =
	Database['public']['Tables']['email_threads']['Update'];

export type EmailMessage =
	Database['public']['Tables']['email_messages']['Row'];
export type InsertEmailMessage =
	Database['public']['Tables']['email_messages']['Insert'];
export type UpdateEmailMessage =
	Database['public']['Tables']['email_messages']['Update'];

export type EmailAttachment =
	Database['public']['Tables']['email_attachments']['Row'];
export type InsertEmailAttachment =
	Database['public']['Tables']['email_attachments']['Insert'];
export type UpdateEmailAttachment =
	Database['public']['Tables']['email_attachments']['Update'];

export type EmailAISuggestion =
	Database['public']['Tables']['email_ai_suggestions']['Row'];
export type InsertEmailAISuggestion =
	Database['public']['Tables']['email_ai_suggestions']['Insert'];
export type UpdateEmailAISuggestion =
	Database['public']['Tables']['email_ai_suggestions']['Update'];

export type EmailDeliveryLog =
	Database['public']['Tables']['email_delivery_logs']['Row'];
export type InsertEmailDeliveryLog =
	Database['public']['Tables']['email_delivery_logs']['Insert'];
export type UpdateEmailDeliveryLog =
	Database['public']['Tables']['email_delivery_logs']['Update'];

// Extended types with relations
export interface EmailAddressWithRelations extends EmailAddress {
	user?: {
		id: string;
		first_name: string;
		last_name: string;
		email: string;
	};
	team?: {
		id: string;
		name: string;
	};
}

export interface EmailThreadWithRelations extends EmailThread {
	messages?: EmailMessageWithRelations[];
	property?: {
		id: string;
		address: string;
		property_type: string;
	};
	tenant?: {
		id: string;
		first_name: string;
		last_name: string;
		email: string;
	};
	application?: {
		id: string;
		status: string;
		property_id: string;
		tenant_id: string;
	};
	appointment?: {
		id: string;
		date: string;
		start_time: string;
		end_time: string | null;
		status: string;
	};
	last_message?: EmailMessageWithRelations;
}

export interface EmailMessageWithRelations extends EmailMessage {
	attachments?: EmailAttachment[];
	ai_suggestions?: EmailAISuggestion[];
	delivery_logs?: EmailDeliveryLog[];
	thread?: EmailThread;
}

// UI-specific types
export interface InboxEmail {
	id: string;
	sender: string;
	email: string;
	subject: string;
	preview: string;
	time: string;
	isUnread: boolean;
	hasAttachment: boolean;
	avatar: string;
	leadSource?: string;
	needsFollowUp?: boolean;
	priority?: 'low' | 'normal' | 'high' | 'urgent';
	status?:
		| 'received'
		| 'sent'
		| 'draft'
		| 'archived'
		| 'deleted'
		| 'bounced'
		| 'failed';
}

// Filter types
export interface InboxFilters {
	status?: EmailThread['status'];
	priority?: EmailThread['priority'];
	needsFollowUp?: boolean;
	leadSource?: string;
	propertyId?: string;
	tenantId?: string;
	search?: string;
	dateRange?: {
		start: Date;
		end: Date;
	};
}

// Response types
export interface InboxResponse {
	threads: EmailThreadWithRelations[];
	total: number;
	unread: number;
	needsFollowUp: number;
}

export interface AISuggestionResponse {
	suggestion: string;
	type: 'follow_up' | 'response' | 'classification';
	confidence: number;
	metadata: Record<string, unknown>;
}

// Email composition types
export interface EmailDraft {
	to: string[];
	cc?: string[];
	bcc?: string[];
	subject: string;
	body: string;
	htmlBody?: string;
	attachments?: File[];
	threadId?: string;
	inReplyTo?: string;
}

// Email validation types
export interface EmailValidationResult {
	isValid: boolean;
	errors: {
		to?: string;
		subject?: string;
		body?: string;
		attachments?: string;
	};
}

// Email action types
export type EmailAction =
	| 'reply'
	| 'forward'
	| 'archive'
	| 'delete'
	| 'mark_read'
	| 'mark_unread'
	| 'flag_follow_up'
	| 'unflag_follow_up'
	| 'change_priority';

// Email notification types
export interface EmailNotification {
	type: 'new_email' | 'reply' | 'ai_suggestion' | 'delivery_status';
	message: string;
	data: {
		threadId?: string;
		messageId?: string;
		sender?: string;
		subject?: string;
	};
	timestamp: string;
}
