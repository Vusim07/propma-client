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
	UpdateEmailWorkflow,
} from '../types';

interface AgentState {
	applications: Application[];
	properties: Property[];
	workflows: EmailWorkflow[];
	workflowLogs: WorkflowLog[];
	isLoading: boolean;
	error: string | null;

	fetchApplications: (agentId: string) => Promise<void>;
	updateApplicationStatus: (
		applicationId: string,
		status: Application['status'],
		notes?: string,
	) => Promise<void>;
	fetchProperties: (ownerId: string) => Promise<void>;
	addProperty: (
		property: Omit<Property, 'id' | 'created_at' | 'application_link'>,
	) => Promise<void>;
	updateProperty: (id: string, updates: Partial<Property>) => Promise<void>;
	deleteProperty: (id: string) => Promise<void>;
	generateApplicationLink: (propertyId: string) => Promise<string>;
	fetchWorkflows: (agentId: string) => Promise<void>;
	createWorkflow: (
		workflow: Omit<InsertEmailWorkflow, 'id' | 'created_at' | 'updated_at'>,
	) => Promise<void>;
	updateWorkflow: (id: string, updates: UpdateEmailWorkflow) => Promise<void>;
	deleteWorkflow: (id: string) => Promise<void>;
	fetchWorkflowLogs: (workflowId?: string) => Promise<void>;
}

export const useAgentStore = create<AgentState>((set) => ({
	applications: [],
	properties: [],
	workflows: [],
	workflowLogs: [],
	isLoading: false,
	error: null,

	fetchApplications: async (agentId) => {
		set({ isLoading: true, error: null });
		try {
			const { data, error } = await supabase
				.from('applications')
				.select('*, properties(*), tenants(*)')
				.eq('agent_id', agentId);

			if (error) throw error;

			// Format dates for display
			const formattedApplications = data?.map((app) => ({
				...app,
				// Map created_at to submitted_at if submitted_at doesn't exist
				submitted_at: formatDate(app.submitted_at || app.created_at),
				decision_at: app.decision_at ? formatDate(app.decision_at) : null,
			}));

			set({ applications: formattedApplications || [], isLoading: false });
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
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

			// Format dates for display
			const formattedApplication = {
				...data,
				submitted_at: formatDate(data.submitted_at || data.created_at),
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

	fetchProperties: async (ownerId) => {
		set({ isLoading: true, error: null });
		try {
			const { data, error } = await supabase
				.from('properties')
				.select('*')
				.eq('owner_id', ownerId);

			if (error) throw error;

			// Format currency and dates
			const formattedProperties = data?.map((property) => ({
				...property,
				rent_formatted: formatCurrency(property.monthly_rent), // Change rent to monthly_rent
				available_from: formatDate(property.available_from),
				created_at: property.created_at,
				updated_at: property.updated_at,
			}));

			set({ properties: formattedProperties || [], isLoading: false });
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
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

			const { data, error } = await supabase
				.from('properties')
				.insert({
					...property,
					application_link: applicationLink,
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

	fetchWorkflows: async (agentId) => {
		set({ isLoading: true, error: null });
		try {
			const { data, error } = await supabase
				.from('email_workflows')
				.select('*')
				.eq('agent_id', agentId);

			if (error) throw error;

			set({ workflows: data || [], isLoading: false });
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
		}
	},

	createWorkflow: async (workflow) => {
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

	updateWorkflow: async (id, updates) => {
		set({ isLoading: true, error: null });
		try {
			const { data, error } = await supabase
				.from('email_workflows')
				.update(updates)
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

	deleteWorkflow: async (id) => {
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

	fetchWorkflowLogs: async (workflowId) => {
		set({ isLoading: true, error: null });
		try {
			let query = supabase.from('workflow_logs').select('*');

			if (workflowId) {
				query = query.eq('workflow_id', workflowId);
			}

			const { data, error } = await query;

			if (error) throw error;

			// Format dates for display
			const formattedLogs = data?.map((log) => ({
				...log,
				triggered_at: formatDate(log.triggered_at),
			}));

			set({ workflowLogs: formattedLogs || [], isLoading: false });
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
		}
	},
}));
