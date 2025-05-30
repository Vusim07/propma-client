/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { formatCurrency, formatDate } from '../utils/formatters';
import {
	Application,
	Property,
	EmailWorkflow,
	WorkflowLog,
	InsertEmailWorkflow,
	AppointmentWithRelations,
	Subscription,
} from '../types';

/**
 * @deprecated The email workflow and Gmail integration system is being deprecated in favor of a new dedicated inbox system.
 * The new system will use custom email addresses (@n.agentamara.com) instead of Gmail integration.
 *
 * Migration Guide:
 * - New Implementation: New Inbox feature with dedicated email addresses
 * - Key Changes:
 *   - No more Gmail integration required
 *   - Users get a dedicated @n.agentamara.com email address
 *   - Simplified email handling for listing site inquiries
 * - Contact: [Your team contact]
 */

// Define CalendarIntegration type
export interface CalendarIntegration {
	id: string;
	user_id: string;
	provider: string;
	refresh_token: string;
	access_token: string | null;
	token_expiry: string | null;
	calendar_id: string | null;
	created_at: string;
	updated_at: string;
}

// EmailIntegration type
export interface EmailIntegration {
	id: string;
	user_id: string;
	provider: string;
	refresh_token: string;
	access_token: string | null;
	token_expiry: string | null;
	email_address: string | null;
	created_at: string;
	updated_at: string;
}

// Gmail message type
export interface GmailMessage {
	id: string;
	subject: string; // Make sure subject is required
	from: string;
	body: string;
	date: string;
	threadId?: string;
}

interface WorkflowUpdateFields {
	name?: string;
	active?: boolean; // This is the database field name, not is_active
	email_filter?: any;
	actions?: any;
	trigger_event?: string;
	email_template?: string;
}

const logTableSchema = async (
	tableName:
		| 'applications'
		| 'properties'
		| 'tenant_profiles'
		| 'users'
		| 'documents'
		| 'screening_reports'
		| 'appointments'
		| 'email_workflows'
		| 'workflow_logs'
		| 'calendar_integrations',
) => {
	try {
		const { error } = await supabase.from(tableName).select('*').limit(1);

		if (error) {
			console.error(`Error querying ${tableName}:`, error);
			return;
		}
	} catch (err) {
		console.error(`Failed to inspect ${tableName} schema:`, err);
	}
};

interface AgentState {
	applications: Application[];
	properties: Property[];
	workflows: EmailWorkflow[];
	workflowLogs: WorkflowLog[];
	appointments: AppointmentWithRelations[];
	subscriptions: Subscription[];
	calendarIntegration: CalendarIntegration | null;
	emailIntegration: EmailIntegration | null;
	isLoading: boolean;
	loadingCount: number;
	error: string | null;
	currentTeamId: string | null;
	setCurrentTeamId: (teamId: string | null) => void;

	fetchApplications: (agentId: string, teamId?: string | null) => Promise<void>;
	updateApplicationStatus: (
		applicationId: string,
		status: Application['status'],
		notes?: string,
	) => Promise<void>;
	fetchProperties: (
		agentId: string,
		teamId?: string | null,
	) => Promise<Property[]>;
	addProperty: (
		property: Omit<Property, 'id' | 'created_at' | 'application_link'>,
	) => Promise<void>;
	updateProperty: (id: string, updates: Partial<Property>) => Promise<void>;
	deleteProperty: (id: string) => Promise<void>;
	generateApplicationLink: (propertyId: string) => Promise<string>;
	/**
	 * @deprecated This function is deprecated. The email workflow system is being replaced with a new inbox system.
	 * Users will receive a dedicated @n.agentamara.com email address instead of connecting their Gmail.
	 */
	fetchWorkflows: (agentId: string) => Promise<void>;
	/**
	 * @deprecated This function is deprecated. The email workflow system is being replaced with a new inbox system.
	 * Users will receive a dedicated @n.agentamara.com email address instead of connecting their Gmail.
	 */
	createWorkflow: (
		workflow: Omit<InsertEmailWorkflow, 'id' | 'created_at' | 'updated_at'>,
	) => Promise<void>;
	/**
	 * @deprecated This function is deprecated. The email workflow system is being replaced with a new inbox system.
	 * Users will receive a dedicated @n.agentamara.com email address instead of connecting their Gmail.
	 */
	updateWorkflow: (
		id: string,
		updates: Partial<EmailWorkflow>,
	) => Promise<void>;
	/**
	 * @deprecated This function is deprecated. The email workflow system is being replaced with a new inbox system.
	 * Users will receive a dedicated @n.agentamara.com email address instead of connecting their Gmail.
	 */
	deleteWorkflow: (id: string) => Promise<void>;
	/**
	 * @deprecated This function is deprecated. The email workflow system is being replaced with a new inbox system.
	 * Users will receive a dedicated @n.agentamara.com email address instead of connecting their Gmail.
	 */
	fetchWorkflowLogs: (workflowId?: string) => Promise<void>;
	fetchAppointments: (agentId: string) => Promise<void>;
	fetchSubscriptions: (userId: string) => Promise<Subscription | null>;
	/**
	 * @deprecated This function is deprecated. The Gmail integration is being replaced with a new inbox system.
	 * Users will receive a dedicated @n.agentamara.com email address instead of connecting their Gmail.
	 */
	fetchEmailIntegration: (userId: string) => Promise<EmailIntegration | null>;
	/**
	 * @deprecated This function is deprecated. The Gmail integration is being replaced with a new inbox system.
	 * Users will receive a dedicated @n.agentamara.com email address instead of connecting their Gmail.
	 */
	connectEmailIntegration: (
		userId: string,
		provider: string,
		tokens: {
			refresh_token: string;
			access_token?: string;
			token_expiry?: string;
			email_address?: string;
		},
	) => Promise<EmailIntegration>;
	/**
	 * @deprecated This function is deprecated. The Gmail integration is being replaced with a new inbox system.
	 * Users will receive a dedicated @n.agentamara.com email address instead of connecting their Gmail.
	 */
	disconnectEmailIntegration: (integrationId: string) => Promise<void>;
	diagnosticCheck: () => Promise<void>;

	// Calendar integration functions
	fetchCalendarIntegration: (
		userId: string,
	) => Promise<CalendarIntegration | null>;
	connectGoogleCalendar: (userId: string) => Promise<{ url: string }>;
	disconnectCalendar: (integrationId: string) => Promise<void>;

	/**
	 * @deprecated This function is deprecated. The Gmail integration is being replaced with a new inbox system.
	 * Users will receive a dedicated @n.agentamara.com email address instead of connecting their Gmail.
	 */
	fetchGmailMessages: () => Promise<GmailMessage[]>;
	/**
	 * @deprecated This function is deprecated. The Gmail integration is being replaced with a new inbox system.
	 * Users will receive a dedicated @n.agentamara.com email address instead of connecting their Gmail.
	 */
	sendGmailMessage: (
		to: string,
		subject: string,
		body: string,
	) => Promise<boolean>;

	// Subscription changes function
	fetchSubscriptionChanges: (subscriptionId: string) => Promise<any[]>;
}

export const useAgentStore = create<AgentState>((set, get) => ({
	applications: [],
	properties: [],
	workflows: [],
	workflowLogs: [],
	appointments: [],
	subscriptions: [],
	calendarIntegration: null,
	emailIntegration: null,
	isLoading: false,
	loadingCount: 0,
	error: null,
	currentTeamId: null,

	setCurrentTeamId: (teamId) => set({ currentTeamId: teamId }),

	fetchApplications: async (agentId, teamId) => {
		set({ isLoading: true, error: null });
		try {
			// Use the currentTeamId from store state if teamId is not provided
			const currentTeamId = teamId ?? get().currentTeamId;

			let query = supabase.from('applications').select(
				`
					*,
					properties(*),
					tenant_profiles:tenant_id(*)
				`,
			);

			if (currentTeamId) {
				// If team context, fetch team applications
				query = query.eq('team_id', currentTeamId);
			} else {
				// Otherwise fetch personal applications
				query = query.eq('agent_id', agentId).is('team_id', null);
			}

			const { data, error } = await query;

			if (error) {
				console.error('Error fetching applications:', error);
				throw error;
			}

			// Format dates for display
			const formattedApplications = data?.map((app) => {
				// Use type assertion to handle properties that might not be in the base type
				const appWithDates = app as any;
				return {
					...app,
					// Map created_at to submitted_at if submitted_at doesn't exist
					submitted_at: formatDate(appWithDates.submitted_at || app.created_at),
					decision_at: app.decision_at ? formatDate(app.decision_at) : null,
				};
			});

			set({ applications: formattedApplications || [] });
		} catch (error) {
			// Enhanced error logging
			console.error('Failed to fetch applications:', {
				error,
				message: (error as Error).message,
				stack: (error as Error).stack,
			});
			set({ error: (error as Error).message });
		} finally {
			set({ isLoading: false });
		}
	},

	updateApplicationStatus: async (applicationId, status, notes) => {
		set({ isLoading: true, error: null });
		try {
			const updateData: any = {
				status,
				notes: notes || null,
				decision_at: status !== 'pending' ? new Date().toISOString() : null,
			};

			const { data, error } = await supabase
				.from('applications')
				.update(updateData)
				.eq('id', applicationId)
				.select()
				.single();

			if (error) throw error;

			// Format dates for display using type assertion for submitted_at property
			const appData = data as any;
			const formattedApplication = {
				...data,
				submitted_at: formatDate(appData.submitted_at || data.created_at),
				decision_at: data.decision_at ? formatDate(data.decision_at) : null,
			};

			set((state) => ({
				applications: state.applications.map((app) =>
					app.id === applicationId ? formattedApplication : app,
				),
				isLoading: false,
			}));
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
		}
	},

	fetchProperties: async (agentId, teamId) => {
		try {
			set({ isLoading: true, error: null });

			// Use the currentTeamId from store state if teamId is not provided
			const currentTeamId = teamId ?? get().currentTeamId;

			let query = supabase.from('properties').select('*');

			if (currentTeamId) {
				// If team context, fetch team properties
				query = query.eq('team_id', currentTeamId);
			} else {
				// Otherwise fetch personal properties
				query = query.eq('agent_id', agentId).is('team_id', null);
			}

			const { data, error } = await query;

			if (error) {
				console.error('Error fetching properties:', error);
				throw error;
			}

			// Map API response to expected Property type
			const propertyData =
				data?.map((item) => ({
					...item,
					// Add any missing fields or conversions needed for the Property type
					rent: item.monthly_rent || 0, // Map monthly_rent to rent
					status: item.status || 'available',
					images: item.images || [],
				})) || [];

			set({ properties: propertyData });
			return propertyData;
		} catch (error: any) {
			set({ error: error.message || 'Failed to fetch properties' });
			return [];
		} finally {
			set({ isLoading: false });
		}
	},

	addProperty: async (property) => {
		set({ isLoading: true, error: null });
		try {
			// Create unique application link token
			const token = `prop_${Date.now()}_${Math.random()
				.toString(36)
				.substring(2, 10)}`;
			const applicationLink = `${window.location.origin}/apply/${token}`;

			// Include team_id in property creation if in team context
			const teamId = get().currentTeamId;

			const { data, error } = await supabase
				.from('properties')
				.insert({
					...property,
					application_link: applicationLink,
					team_id: teamId, // Add team context if exists
				})
				.select()
				.single();

			if (error) throw error;

			// Format currency and dates
			const formattedProperty = {
				...data,
				rent_formatted: formatCurrency(data.monthly_rent), // Change rent to monthly_rent
				available_from: formatDate(data.available_from),
				created_at: data.created_at,
				updated_at: data.updated_at,
			};

			set((state) => ({
				properties: [...state.properties, formattedProperty],
				isLoading: false,
			}));
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
		}
	},

	updateProperty: async (id, updates) => {
		set({ isLoading: true, error: null });
		try {
			const { data, error } = await supabase
				.from('properties')
				.update(updates)
				.eq('id', id)
				.select()
				.single();

			if (error) throw error;

			// Format currency and dates
			const formattedProperty = {
				...data,
				rent_formatted: formatCurrency(data.monthly_rent), // Change rent to monthly_rent
				available_from: formatDate(data.available_from),
				created_at: data.created_at,
				updated_at: data.updated_at,
			};

			set((state) => ({
				properties: state.properties.map((property) =>
					property.id === id ? formattedProperty : property,
				),
				isLoading: false,
			}));
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
		}
	},

	deleteProperty: async (id) => {
		set({ isLoading: true, error: null });
		try {
			const { error } = await supabase.from('properties').delete().eq('id', id);

			if (error) throw error;

			set((state) => ({
				properties: state.properties.filter((property) => property.id !== id),
				isLoading: false,
			}));
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
		}
	},

	generateApplicationLink: async (propertyId) => {
		set({ isLoading: true, error: null });
		try {
			// Create unique token
			const token = `prop_${propertyId}_${Date.now()}_${Math.random()
				.toString(36)
				.substring(2, 10)}`;
			const applicationLink = `${window.location.origin}/apply/${token}`;

			const { data, error } = await supabase
				.from('properties')
				.update({ application_link: applicationLink })
				.eq('id', propertyId)
				.select()
				.single();

			if (error) throw error;

			set((state) => ({
				properties: state.properties.map((property) =>
					property.id === propertyId
						? {
								...property,
								application_link: applicationLink,
								updated_at: data.updated_at,
						  }
						: property,
				),
				isLoading: false,
			}));

			return applicationLink;
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
			return '';
		}
	},

	/**
	 * @deprecated This function is deprecated. The email workflow system is being replaced with a new inbox system.
	 * Users will receive a dedicated @n.agentamara.com email address instead of connecting their Gmail.
	 */
	fetchWorkflows: async (agentId) => {
		console.warn(
			'DEPRECATED: fetchWorkflows is deprecated. The email workflow system is being replaced with a new inbox system using @n.agentamara.com addresses.',
		);
		set((state) => ({
			loadingCount: state.loadingCount + 1,
			isLoading: true,
			error: null,
		}));
		try {
			const { data, error } = await supabase
				.from('email_workflows')
				.select('*')
				.eq('agent_id', agentId);

			if (error) throw error;

			set({ workflows: data || [] });
		} catch (error) {
			set({ error: (error as Error).message });
		} finally {
			set((state) => {
				const newCount = Math.max(state.loadingCount - 1, 0);
				return { loadingCount: newCount, isLoading: newCount > 0 };
			});
		}
	},

	/**
	 * @deprecated This function is deprecated. The email workflow system is being replaced with a new inbox system.
	 * Users will receive a dedicated @n.agentamara.com email address instead of connecting their Gmail.
	 */
	createWorkflow: async (workflow) => {
		console.warn(
			'DEPRECATED: createWorkflow is deprecated. The email workflow system is being replaced with a new inbox system using @n.agentamara.com addresses.',
		);
		set({ isLoading: true, error: null });
		try {
			const { data, error } = await supabase
				.from('email_workflows')
				.insert(workflow)
				.select()
				.single();

			if (error) throw error;

			set((state) => ({
				workflows: [...state.workflows, data],
				isLoading: false,
			}));
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
		}
	},

	/**
	 * @deprecated This function is deprecated. The email workflow system is being replaced with a new inbox system.
	 * Users will receive a dedicated @n.agentamara.com email address instead of connecting their Gmail.
	 */
	updateWorkflow: async (id, updates) => {
		console.warn(
			'DEPRECATED: updateWorkflow is deprecated. The email workflow system is being replaced with a new inbox system using @n.agentamara.com addresses.',
		);
		set({ isLoading: true, error: null });
		try {
			// Transform updates to match database fields
			const dbUpdates: WorkflowUpdateFields = {
				...updates,
				// If is_active is provided, map it to active
				...(updates.active !== undefined && { active: updates.active }),
			};

			// Remove is_active property if it exists
			if ((dbUpdates as any).is_active !== undefined) {
				delete (dbUpdates as any).is_active;
			}

			const { data, error } = await supabase
				.from('email_workflows')
				.update(dbUpdates)
				.eq('id', id)
				.select()
				.single();

			if (error) throw error;

			set((state) => ({
				workflows: state.workflows.map((workflow) =>
					workflow.id === id ? data : workflow,
				),
				isLoading: false,
			}));
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
		}
	},

	/**
	 * @deprecated This function is deprecated. The email workflow system is being replaced with a new inbox system.
	 * Users will receive a dedicated @n.agentamara.com email address instead of connecting their Gmail.
	 */
	deleteWorkflow: async (id) => {
		console.warn(
			'DEPRECATED: deleteWorkflow is deprecated. The email workflow system is being replaced with a new inbox system using @n.agentamara.com addresses.',
		);
		set({ isLoading: true, error: null });
		try {
			const { error } = await supabase
				.from('email_workflows')
				.delete()
				.eq('id', id);

			if (error) throw error;

			set((state) => ({
				workflows: state.workflows.filter((workflow) => workflow.id !== id),
				isLoading: false,
			}));
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
		}
	},

	/**
	 * @deprecated This function is deprecated. The email workflow system is being replaced with a new inbox system.
	 * Users will receive a dedicated @n.agentamara.com email address instead of connecting their Gmail.
	 */
	fetchWorkflowLogs: async (workflowId) => {
		console.warn(
			'DEPRECATED: fetchWorkflowLogs is deprecated. The email workflow system is being replaced with a new inbox system using @n.agentamara.com addresses.',
		);
		set((state) => ({
			loadingCount: state.loadingCount + 1,
			isLoading: true,
			error: null,
		}));
		try {
			let query = supabase.from('workflow_logs').select('*');

			if (workflowId) {
				query = query.eq('workflow_id', workflowId);
			}

			const { data, error } = await query;

			if (error) throw error;

			const formattedLogs = data?.map((log) => ({
				...log,
				triggered_at: formatDate(log.triggered_at),
			}));

			set({ workflowLogs: formattedLogs || [] });
		} catch (error) {
			set({ error: (error as Error).message });
		} finally {
			set((state) => {
				const newCount = Math.max(state.loadingCount - 1, 0);
				return { loadingCount: newCount, isLoading: newCount > 0 };
			});
		}
	},

	// Add fetchAppointments function
	fetchAppointments: async (agentId) => {
		set({ isLoading: true, error: null });
		try {
			const { data, error } = await supabase
				.from('appointments')
				.select(
					`
					*,
					tenant_profiles:tenant_id(id, first_name, last_name, phone),
					properties:property_id(id, address, property_type, monthly_rent)
				`,
				)
				.eq('agent_id', agentId);

			if (error) {
				console.error('Error fetching appointments:', error);
				throw error;
			}

			// Format data similar to ManageAppointments component
			const formattedAppointments = (data || []).map((appointment) => ({
				...appointment,
				tenant_name: appointment.tenant_profiles
					? `${appointment.tenant_profiles.first_name} ${appointment.tenant_profiles.last_name}`
					: 'Unknown Tenant',
				tenant_phone: appointment.tenant_profiles?.phone,
				property_address: appointment.properties?.address || 'Unknown Property',
				property_type: appointment.properties?.property_type || 'Unknown Type',
				monthly_rent: appointment.properties?.monthly_rent,
				// Ensure start_time and end_time are strings if needed by Appointment type
				start_time: String(appointment.start_time),
				end_time: appointment.end_time ? String(appointment.end_time) : null,
			}));

			set({ appointments: formattedAppointments as any, isLoading: false });
		} catch (error) {
			console.error('Failed to fetch appointments:', {
				error,
				message: (error as Error).message,
				stack: (error as Error).stack,
			});
			set({ error: (error as Error).message, isLoading: false });
		}
	},

	// Add fetchSubscriptions function
	fetchSubscriptions: async (userId) => {
		set({ isLoading: true, error: null });
		try {
			// First, check if the table exists and is accessible
			const { error: countError } = await supabase
				.from('subscriptions')
				.select('*', { count: 'exact', head: true });

			if (countError) {
				console.error('Error accessing subscriptions table:', countError);
				throw new Error(`Database error: ${countError.message}`);
			}

			// Then proceed with the actual query
			const { data, error } = await supabase
				.from('subscriptions')
				.select('*')
				.eq('user_id', userId)
				.eq('status', 'active')
				.order('created_at', { ascending: false })
				.limit(1);

			if (error) {
				console.error('Error fetching subscription:', error);
				throw error;
			}

			const subscription = data && data.length > 0 ? data[0] : null;

			set({
				subscriptions: subscription ? [subscription] : [],
				isLoading: false,
			});

			return subscription;
		} catch (error) {
			console.error('Error fetching subscription:', error);
			set({
				error: (error as Error).message,
				isLoading: false,
			});
			return null;
		}
	},

	/**
	 * @deprecated This function is deprecated. The Gmail integration is being replaced with a new inbox system.
	 * Users will receive a dedicated @n.agentamara.com email address instead of connecting their Gmail.
	 */
	fetchEmailIntegration: async (userId) => {
		console.warn(
			'DEPRECATED: fetchEmailIntegration is deprecated. The Gmail integration is being replaced with a new inbox system using @n.agentamara.com addresses.',
		);
		set({ isLoading: true, error: null });
		try {
			const { data, error } = await supabase
				.from('email_integrations')
				.select('*')
				.eq('user_id', userId)
				.maybeSingle();
			if (error) throw error;
			set({ emailIntegration: data, isLoading: false });
			return data;
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
			return null;
		}
	},

	/**
	 * @deprecated This function is deprecated. The Gmail integration is being replaced with a new inbox system.
	 * Users will receive a dedicated @n.agentamara.com email address instead of connecting their Gmail.
	 */
	connectEmailIntegration: async (userId, provider, tokens) => {
		console.warn(
			'DEPRECATED: connectEmailIntegration is deprecated. The Gmail integration is being replaced with a new inbox system using @n.agentamara.com addresses.',
		);
		set({ isLoading: true, error: null });
		try {
			const { data, error } = await supabase
				.from('email_integrations')
				.insert({
					user_id: userId,
					provider,
					refresh_token: tokens.refresh_token,
					access_token: tokens.access_token || null,
					token_expiry: tokens.token_expiry || null,
					email_address: tokens.email_address || null,
				})
				.select()
				.single();
			if (error) throw error;
			set({ emailIntegration: data, isLoading: false });
			return data;
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
			throw error;
		}
	},

	/**
	 * @deprecated This function is deprecated. The Gmail integration is being replaced with a new inbox system.
	 * Users will receive a dedicated @n.agentamara.com email address instead of connecting their Gmail.
	 */
	disconnectEmailIntegration: async (integrationId) => {
		console.warn(
			'DEPRECATED: disconnectEmailIntegration is deprecated. The Gmail integration is being replaced with a new inbox system using @n.agentamara.com addresses.',
		);
		set({ isLoading: true, error: null });
		try {
			const { error } = await supabase
				.from('email_integrations')
				.delete()
				.eq('id', integrationId);
			if (error) throw error;
			set({ emailIntegration: null, isLoading: false });
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
			throw error;
		}
	},

	/**
	 * @deprecated This function is deprecated. The Gmail integration is being replaced with a new inbox system.
	 * Users will receive a dedicated @n.agentamara.com email address instead of connecting their Gmail.
	 */
	fetchGmailMessages: async () => {
		console.warn(
			'DEPRECATED: fetchGmailMessages is deprecated. The Gmail integration is being replaced with a new inbox system using @n.agentamara.com addresses.',
		);
		set({ isLoading: true, error: null });
		try {
			const { data: sessionData, error: sessionError } =
				await supabase.auth.getSession();
			if (sessionError || !sessionData?.session?.access_token)
				throw new Error('Session expired');
			const response = await fetch(
				`${
					import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
				}/email-gmail-list-messages`,
				{
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${sessionData.session.access_token}`,
						apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
					},
				},
			);
			if (!response.ok) throw new Error(await response.text());
			const { emails } = await response.json();
			set({ isLoading: false });
			return emails as GmailMessage[];
		} catch (error: any) {
			set({
				error: error.message || 'Failed to fetch Gmail messages',
				isLoading: false,
			});
			return [];
		}
	},

	/**
	 * @deprecated This function is deprecated. The Gmail integration is being replaced with a new inbox system.
	 * Users will receive a dedicated @n.agentamara.com email address instead of connecting their Gmail.
	 */
	sendGmailMessage: async (to, subject, body) => {
		console.warn(
			'DEPRECATED: sendGmailMessage is deprecated. The Gmail integration is being replaced with a new inbox system using @n.agentamara.com addresses.',
		);
		set({ isLoading: true, error: null });
		try {
			const { data: sessionData, error: sessionError } =
				await supabase.auth.getSession();
			if (sessionError || !sessionData?.session?.access_token)
				throw new Error('Session expired');
			const response = await fetch(
				`${
					import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
				}/email-gmail-send-message`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${sessionData.session.access_token}`,
						apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
					},
					body: JSON.stringify({ to, subject, body }),
				},
			);
			if (!response.ok) throw new Error(await response.text());
			set({ isLoading: false });
			return true;
		} catch (error: any) {
			set({
				error: error.message || 'Failed to send Gmail message',
				isLoading: false,
			});
			return false;
		}
	},

	// Add fetchSubscriptionChanges function
	fetchSubscriptionChanges: async (subscriptionId) => {
		try {
			const { data, error } = await supabase
				.from('subscription_changes')
				.select('*')
				.eq('subscription_id', subscriptionId)
				.order('created_at', { ascending: false });

			if (error) throw error;
			return data;
		} catch (error) {
			console.error('Error fetching subscription changes:', error);
			set({ error: 'Failed to load subscription changes' });
			return [];
		}
	},

	// Add new calendar integration functions
	fetchCalendarIntegration: async (userId) => {
		set({ isLoading: true, error: null });
		try {
			const { data, error } = await supabase
				.from('calendar_integrations')
				.select('*')
				.eq('user_id', userId)
				.maybeSingle();

			if (error) throw error;

			set({ calendarIntegration: data, isLoading: false });
			return data;
		} catch (error) {
			console.error('Error fetching calendar integration:', error);
			set({
				error:
					error instanceof Error
						? error.message
						: 'Failed to fetch calendar integration',
				isLoading: false,
			});
			return null;
		}
	},

	connectGoogleCalendar: async (userId) => {
		set({ isLoading: true, error: null });
		try {
			const { data: sessionData } = await supabase.auth.getSession();

			const response = await fetch(
				`${
					import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
				}/calendar-oauth?user_id=${userId}`,
				{
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${sessionData.session?.access_token}`,
					},
				},
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			set({ isLoading: false });

			if (!data.url) {
				throw new Error('Failed to get authorization URL');
			}

			return data;
		} catch (error) {
			console.error('Error connecting Google Calendar:', error);
			set({
				error:
					error instanceof Error
						? error.message
						: 'Failed to connect Google Calendar',
				isLoading: false,
			});
			throw error;
		}
	},

	disconnectCalendar: async (integrationId) => {
		set({ isLoading: true, error: null });
		try {
			const { error } = await supabase
				.from('calendar_integrations')
				.delete()
				.eq('id', integrationId);

			if (error) throw error;

			set({ calendarIntegration: null, isLoading: false });
		} catch (error) {
			console.error('Error disconnecting calendar:', error);
			set({
				error:
					error instanceof Error
						? error.message
						: 'Failed to disconnect calendar',
				isLoading: false,
			});
			throw error;
		}
	},

	// Add a diagnostic function to help troubleshoot database issues
	diagnosticCheck: async () => {
		try {
			await logTableSchema('applications');
			await logTableSchema('properties');
			await logTableSchema('tenant_profiles');
			await logTableSchema('users');
			await logTableSchema('appointments'); // Check appointments table too
			await logTableSchema('email_workflows');
			await logTableSchema('workflow_logs');

			// Test a simple query to check RLS policies
			const { error } = await supabase
				.from('applications')
				.select('count')
				.single();
			if (error) {
				console.error('RLS policy test error:', error);
			}
		} catch (err) {
			console.error('Diagnostic check failed:', err);
		}
	},
}));
