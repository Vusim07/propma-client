import { create } from 'zustand';
import { supabase } from '../services/supabase';
import {
	EmailThread,
	EmailThreadWithRelations,
	EmailMessageWithRelations,
	InboxFilters,
	InboxResponse,
	EmailDraft,
	EmailAction,
	EmailNotification,
	EmailValidationResult,
} from '../types/inbox';

interface InboxState {
	// State
	threads: EmailThreadWithRelations[];
	selectedThread: EmailThreadWithRelations | null;
	selectedMessage: EmailMessageWithRelations | null;
	filters: InboxFilters;
	isLoading: boolean;
	error: string | null;
	notifications: EmailNotification[];
	draft: EmailDraft | null;
	userEmailAddress: string | null;

	// Actions
	fetchThreads: (filters?: Partial<InboxFilters>) => Promise<InboxResponse>;
	selectThread: (threadId: string) => Promise<void>;
	selectMessage: (messageId: string) => Promise<void>;
	sendEmail: (draft: EmailDraft) => Promise<boolean>;
	saveDraft: (draft: EmailDraft) => Promise<void>;
	deleteDraft: () => Promise<void>;
	performAction: (action: EmailAction, threadId: string) => Promise<void>;
	updateFilters: (filters: Partial<InboxFilters>) => void;
	clearFilters: () => void;
	markAsRead: (threadId: string) => Promise<void>;
	markAsUnread: (threadId: string) => Promise<void>;
	archiveThread: (threadId: string) => Promise<void>;
	deleteThread: (threadId: string) => Promise<void>;
	flagFollowUp: (threadId: string) => Promise<void>;
	unflagFollowUp: (threadId: string) => Promise<void>;
	changePriority: (
		threadId: string,
		priority: EmailThread['priority'],
	) => Promise<void>;
	validateDraft: (draft: EmailDraft) => EmailValidationResult;
	addNotification: (notification: EmailNotification) => void;
	removeNotification: (notificationId: string) => void;
	fetchUserEmailAddress: () => Promise<void>;
}

export const useInboxStore = create<InboxState>((set, get) => ({
	// Initial state
	threads: [],
	selectedThread: null,
	selectedMessage: null,
	filters: {},
	isLoading: false,
	error: null,
	notifications: [],
	draft: null,
	userEmailAddress: null,

	// Fetch email threads with optional filters
	fetchThreads: async (filters = {}) => {
		set({ isLoading: true, error: null });
		try {
			let query = supabase
				.from('email_threads')
				.select(
					`
          *,
          messages:email_messages(
            *,
            attachments:email_attachments(*),
            ai_suggestions:email_ai_suggestions(*),
            delivery_logs:email_delivery_logs(*)
          ),
          property:properties(id, address, property_type),
          tenant:tenant_profiles(id, first_name, last_name, email)
        `,
				)
				.order('last_message_at', { ascending: false });

			// Apply filters
			if (filters.status) query = query.eq('status', filters.status);
			if (filters.priority) query = query.eq('priority', filters.priority);
			if (filters.needsFollowUp) query = query.eq('needs_follow_up', true);
			if (filters.leadSource)
				query = query.eq('lead_source', filters.leadSource);
			if (filters.propertyId)
				query = query.eq('property_id', filters.propertyId);
			if (filters.tenantId) query = query.eq('tenant_id', filters.tenantId);
			if (filters.search) {
				query = query.or(
					`subject.ilike.%${filters.search}%,messages.body.ilike.%${filters.search}%`,
				);
			}
			if (filters.dateRange) {
				query = query
					.gte('last_message_at', filters.dateRange.start.toISOString())
					.lte('last_message_at', filters.dateRange.end.toISOString());
			}

			const { data: threads, error } = await query;

			if (error) throw error;

			// Get counts for unread and follow-up
			const { data: counts } = await supabase
				.from('email_threads')
				.select('status, needs_follow_up', { count: 'exact' })
				.in('status', ['active'])
				.eq('needs_follow_up', true);

			const response: InboxResponse = {
				threads: threads || [],
				total: threads?.length || 0,
				unread:
					threads?.filter((t) =>
						t.messages?.some((m: EmailMessageWithRelations) => !m.is_read),
					)?.length || 0,
				needsFollowUp: counts?.length || 0,
			};

			set({ threads: response.threads, isLoading: false });
			return response;
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
			throw error;
		}
	},

	// Select a thread and its latest message
	selectThread: async (threadId: string) => {
		set({ isLoading: true, error: null });
		try {
			const { data: thread, error } = await supabase
				.from('email_threads')
				.select(
					`
          *,
          messages:email_messages(
            *,
            attachments:email_attachments(*),
            ai_suggestions:email_ai_suggestions(*),
            delivery_logs:email_delivery_logs(*)
          ),
          property:properties(id, address, property_type),
          tenant:tenant_profiles(id, first_name, last_name, email)
        `,
				)
				.eq('id', threadId)
				.single();

			if (error) throw error;

			// Sort messages by date and get the latest
			const sortedMessages = thread.messages?.sort(
				(a: EmailMessageWithRelations, b: EmailMessageWithRelations) =>
					new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
			);

			set({
				selectedThread: thread,
				selectedMessage: sortedMessages?.[0] || null,
				isLoading: false,
			});
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
		}
	},

	// Select a specific message within a thread
	selectMessage: async (messageId: string) => {
		set({ isLoading: true, error: null });
		try {
			const { data: message, error } = await supabase
				.from('email_messages')
				.select(
					`
          *,
          attachments:email_attachments(*),
          ai_suggestions:email_ai_suggestions(*),
          delivery_logs:email_delivery_logs(*),
          thread:email_threads(*)
        `,
				)
				.eq('id', messageId)
				.single();

			if (error) throw error;

			set({
				selectedMessage: message,
				selectedThread: message.thread,
				isLoading: false,
			});

			// Mark message as read if it's not already
			if (!message.is_read) {
				await supabase
					.from('email_messages')
					.update({ is_read: true })
					.eq('id', messageId);
			}
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
		}
	},

	// Send an email
	sendEmail: async (draft: EmailDraft) => {
		set({ isLoading: true, error: null });
		try {
			// Validate draft first
			const validation = get().validateDraft(draft);
			if (!validation.isValid) {
				throw new Error(
					'Invalid email draft: ' + Object.values(validation.errors).join(', '),
				);
			}

			// Create or update thread
			let threadId = draft.threadId;
			if (!threadId) {
				const { data: thread, error: threadError } = await supabase
					.from('email_threads')
					.insert({
						subject: draft.subject,
						status: 'active',
						priority: 'normal',
						needs_follow_up: false,
					})
					.select()
					.single();

				if (threadError) throw threadError;
				threadId = thread.id;
			}

			// Create message
			const { data: message, error: messageError } = await supabase
				.from('email_messages')
				.insert({
					thread_id: threadId,
					from_address: draft.to[0], // TODO: Get from authenticated user
					to_address: draft.to.join(','),
					subject: draft.subject,
					body: draft.body,
					body_html: draft.htmlBody,
					status: 'sent',
					is_read: true,
					sent_at: new Date().toISOString(),
				})
				.select()
				.single();

			if (messageError) throw messageError;

			// Handle attachments if any
			if (draft.attachments?.length) {
				const attachmentPromises = draft.attachments.map(async (file) => {
					const { data: uploadData, error: uploadError } =
						await supabase.storage
							.from('email-attachments')
							.upload(`${message.id}/${file.name}`, file);

					if (uploadError) throw uploadError;

					return supabase.from('email_attachments').insert({
						message_id: message.id,
						file_name: file.name,
						file_type: file.type,
						file_size: file.size,
						storage_path: uploadData.path,
					});
				});

				await Promise.all(attachmentPromises);
			}

			// Update thread's last_message_at
			await supabase
				.from('email_threads')
				.update({ last_message_at: new Date().toISOString() })
				.eq('id', threadId);

			set({ draft: null, isLoading: false });
			return true;
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
			return false;
		}
	},

	// Save email draft
	saveDraft: async (draft: EmailDraft) => {
		set({ draft });
	},

	// Delete email draft
	deleteDraft: async () => {
		set({ draft: null });
	},

	// Perform various email actions
	performAction: async (action: EmailAction, threadId: string) => {
		set({ isLoading: true, error: null });
		try {
			switch (action) {
				case 'mark_read':
					await get().markAsRead(threadId);
					break;
				case 'mark_unread':
					await get().markAsUnread(threadId);
					break;
				case 'archive':
					await get().archiveThread(threadId);
					break;
				case 'delete':
					await get().deleteThread(threadId);
					break;
				case 'flag_follow_up':
					await get().flagFollowUp(threadId);
					break;
				case 'unflag_follow_up':
					await get().unflagFollowUp(threadId);
					break;
				default:
					throw new Error(`Unsupported action: ${action}`);
			}
			set({ isLoading: false });
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
		}
	},

	// Update filters
	updateFilters: (filters: Partial<InboxFilters>) => {
		set((state) => ({
			filters: { ...state.filters, ...filters },
		}));
	},

	// Clear all filters
	clearFilters: () => {
		set({ filters: {} });
	},

	// Mark thread as read
	markAsRead: async (threadId: string) => {
		const { error } = await supabase
			.from('email_messages')
			.update({ is_read: true })
			.eq('thread_id', threadId);

		if (error) throw error;

		set((state) => ({
			threads: state.threads.map((thread) =>
				thread.id === threadId
					? {
							...thread,
							messages: thread.messages?.map((msg) => ({
								...msg,
								is_read: true,
							})),
					  }
					: thread,
			),
		}));
	},

	// Mark thread as unread
	markAsUnread: async (threadId: string) => {
		const { error } = await supabase
			.from('email_messages')
			.update({ is_read: false })
			.eq('thread_id', threadId);

		if (error) throw error;

		set((state) => ({
			threads: state.threads.map((thread) =>
				thread.id === threadId
					? {
							...thread,
							messages: thread.messages?.map((msg) => ({
								...msg,
								is_read: false,
							})),
					  }
					: thread,
			),
		}));
	},

	// Archive thread
	archiveThread: async (threadId: string) => {
		const { error } = await supabase
			.from('email_threads')
			.update({ status: 'archived' })
			.eq('id', threadId);

		if (error) throw error;

		set((state) => ({
			threads: state.threads.filter((thread) => thread.id !== threadId),
		}));
	},

	// Delete thread
	deleteThread: async (threadId: string) => {
		const { error } = await supabase
			.from('email_threads')
			.update({ status: 'deleted' })
			.eq('id', threadId);

		if (error) throw error;

		set((state) => ({
			threads: state.threads.filter((thread) => thread.id !== threadId),
		}));
	},

	// Flag thread for follow-up
	flagFollowUp: async (threadId: string) => {
		const { error } = await supabase
			.from('email_threads')
			.update({ needs_follow_up: true })
			.eq('id', threadId);

		if (error) throw error;

		set((state) => ({
			threads: state.threads.map((thread) =>
				thread.id === threadId ? { ...thread, needs_follow_up: true } : thread,
			),
		}));
	},

	// Unflag thread from follow-up
	unflagFollowUp: async (threadId: string) => {
		const { error } = await supabase
			.from('email_threads')
			.update({ needs_follow_up: false })
			.eq('id', threadId);

		if (error) throw error;

		set((state) => ({
			threads: state.threads.map((thread) =>
				thread.id === threadId ? { ...thread, needs_follow_up: false } : thread,
			),
		}));
	},

	// Change thread priority
	changePriority: async (
		threadId: string,
		priority: EmailThread['priority'],
	) => {
		const { error } = await supabase
			.from('email_threads')
			.update({ priority })
			.eq('id', threadId);

		if (error) throw error;

		set((state) => ({
			threads: state.threads.map((thread) =>
				thread.id === threadId ? { ...thread, priority } : thread,
			),
		}));
	},

	// Validate email draft
	validateDraft: (draft: EmailDraft): EmailValidationResult => {
		const errors: EmailValidationResult['errors'] = {};

		if (!draft.to?.length) {
			errors.to = 'Recipient is required';
		}
		if (!draft.subject?.trim()) {
			errors.subject = 'Subject is required';
		}
		if (!draft.body?.trim()) {
			errors.body = 'Message body is required';
		}
		if (draft.attachments?.some((file) => file.size > 5 * 1024 * 1024)) {
			errors.attachments = 'Attachments must be less than 5MB';
		}

		return {
			isValid: Object.keys(errors).length === 0,
			errors,
		};
	},

	// Add notification
	addNotification: (notification: EmailNotification) => {
		set((state) => ({
			notifications: [...state.notifications, notification],
		}));
	},

	// Remove notification
	removeNotification: (notificationId: string) => {
		set((state) => ({
			notifications: state.notifications.filter(
				(n) => n.data.messageId !== notificationId,
			),
		}));
	},

	// Fetch user email address
	fetchUserEmailAddress: async () => {
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) return;

			const { data, error } = await supabase
				.from('email_addresses')
				.select('email_address')
				.eq('user_id', user.id)
				.eq('is_active', true)
				.eq('is_primary', true)
				.single();

			if (error) throw error;

			set({ userEmailAddress: data?.email_address || null });
		} catch (error) {
			console.error('Error fetching user email address:', error);
			set({ error: (error as Error).message });
		}
	},
}));
