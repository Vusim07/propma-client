import { Database } from '../services/database.types';

// Type helpers to improve DX when working with the database
export type Tables<T extends keyof Database['public']['Tables']> =
	Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> =
	Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> =
	Database['public']['Tables'][T]['Update'];

// User profile types
export type Profile = Tables<'profiles'>;
export type InsertProfile = InsertTables<'profiles'>;
export type UpdateProfile = UpdateTables<'profiles'>;

// Tenant types
export type TenantProfile = Tables<'tenants'>;
export type InsertTenantProfile = InsertTables<'tenants'>;
export type UpdateTenantProfile = UpdateTables<'tenants'>;

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
	submitted_at_formatted: string;
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
		submitted_at_formatted: new Intl.DateTimeFormat('en-ZA', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
		}).format(new Date(application.submitted_at || application.created_at)),
		decision_at_formatted: application.decision_at
			? new Intl.DateTimeFormat('en-ZA', {
					day: '2-digit',
					month: '2-digit',
					year: 'numeric',
			  }).format(new Date(application.decision_at))
			: null,
	};
}
