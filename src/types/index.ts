import { Database } from '../services/database.types';

// Type helpers to improve DX when working with the database
export type Tables<T extends keyof Database['public']['Tables']> =
	Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> =
	Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> =
	Database['public']['Tables'][T]['Update'];

// User profile types
export type Profile = Tables<'users'>;
export type InsertProfile = InsertTables<'users'>;
export type UpdateProfile = UpdateTables<'users'>;

// Tenant types
export type TenantProfile = Tables<'tenant_profiles'>;
export type InsertTenantProfile = InsertTables<'tenant_profiles'>;
export type UpdateTenantProfile = UpdateTables<'tenant_profiles'>;

// Document types
export type Document = Tables<'documents'>;
export type InsertDocument = InsertTables<'documents'>;
export type UpdateDocument = UpdateTables<'documents'>;

// Document with file for upload operations
export type DocumentWithFile = Document & {
	file: File;
};

// Property types
export type Property = Tables<'properties'>;
/*
Properties has fields:
- id: string
- agent_id: string
- address: string
- city: string
- province: string (not state)
- postal_code: string (not zip)
- monthly_rent: number (not rent)
- bedrooms: number
- bathrooms: number
- square_feet: number
- available_from: string
- description: string
- status: string
- property_type: string
- suburb: string
- deposit_amount: number
- amenities: any[] (optional)
- images: string[] (optional)
- created_at: string
- updated_at: string
- application_link?: string
*/
export type InsertProperty = InsertTables<'properties'>;
export type UpdateProperty = UpdateTables<'properties'>;

// Property with formatted values for display
export type PropertyWithFormatting = Property & {
	rent_formatted: string; // Formatted monthly_rent
	available_from_formatted: string;
	application_link?: string; // Add this field
};

// Application types
export type Application = Tables<'applications'>;
export type InsertApplication = InsertTables<'applications'>;
export type UpdateApplication = UpdateTables<'applications'>;

// Application with joined data and formatting
export type ApplicationWithRelations = Application & {
	property?: PropertyWithFormatting;
	tenant?: TenantProfile;
	created_at_formatted: string;
	decision_at_formatted: string | null;
};

// Screening report types
export type ScreeningReport = Tables<'screening_reports'>;
export type InsertScreeningReport = InsertTables<'screening_reports'>;
export type UpdateScreeningReport = UpdateTables<'screening_reports'>;

// Appointment types
export type Appointment = Tables<'appointments'>;
export type InsertAppointment = InsertTables<'appointments'>;
export type UpdateAppointment = UpdateTables<'appointments'>;

// Email workflow types
export type EmailWorkflow = Tables<'email_workflows'>;
export type InsertEmailWorkflow = InsertTables<'email_workflows'>;
export type UpdateEmailWorkflow = UpdateTables<'email_workflows'>;

// Workflow log types
export type WorkflowLog = Tables<'workflow_logs'>;
export type InsertWorkflowLog = InsertTables<'workflow_logs'>;
export type UpdateWorkflowLog = UpdateTables<'workflow_logs'>;

// RPC Function types
export interface RpcFunctions {
	get_property_by_token: (params: {
		token_param: string;
	}) => Promise<Property[]>;
	get_tenant_profile_for_user: (params: {
		user_id: string;
	}) => Promise<TenantProfile[]>;
	create_tenant_profile: (params: {
		p_tenant_id: string;
		p_first_name: string;
		p_last_name: string;
		p_email: string;
		p_phone?: string;
		p_current_address?: string;
		p_id_number?: string;
		p_employment_status?: string;
		p_monthly_income?: number;
	}) => Promise<string>;
	get_tenant_applications_for_property: (params: {
		tenant_id_param: string;
		property_id_param: string;
	}) => Promise<Application[]>;
	insert_application: (params: {
		p_property_id: string;
		p_agent_id: string;
		p_tenant_id: string;
		p_employer: string;
		p_employment_duration: number;
		p_monthly_income: number;
		p_notes?: string | null;
	}) => Promise<string>; // Returns the application ID
	check_application_exists: (params: {
		tenant_id_param: string;
		property_id_param: string;
	}) => Promise<boolean>; // Returns true if an application exists
}

// Extend the Supabase client type for rpc
declare module '@supabase/supabase-js' {
	interface SupabaseClient {
		rpc<T = unknown>(
			fn: keyof RpcFunctions | string,
			params?: object,
			options?: object,
		): Promise<{ data: T; error: Error | null }>;
	}
}

export function formatProperty(property: Property): PropertyWithFormatting {
	return {
		...property,
		rent_formatted: new Intl.NumberFormat('en-ZA', {
			style: 'currency',
			currency: 'ZAR',
		}).format(property.monthly_rent),
		available_from_formatted: new Intl.DateTimeFormat('en-ZA', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
		}).format(new Date(property.available_from)),
		application_link: property.application_link,
	};
}

/**
 * Converts a DB application to a formatted display application with relations
 */
export function formatApplication(
	application: Application,
	property?: Property,
	tenant?: TenantProfile,
): ApplicationWithRelations {
	return {
		...application,
		property: property ? formatProperty(property) : undefined,
		tenant,
		created_at_formatted: new Intl.DateTimeFormat('en-ZA', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
		}).format(new Date(application.created_at)),
		decision_at_formatted: application.decision_at
			? new Intl.DateTimeFormat('en-ZA', {
					day: '2-digit',
					month: '2-digit',
					year: 'numeric',
			  }).format(new Date(application.decision_at))
			: null,
	};
}
