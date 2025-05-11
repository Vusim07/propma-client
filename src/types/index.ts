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

// Property types
export type Property = Tables<'properties'>;
export type InsertProperty = InsertTables<'properties'>;
export type UpdateProperty = UpdateTables<'properties'>;

// Application types
export type Application = Tables<'applications'>;
export type InsertApplication = InsertTables<'applications'>;
export type UpdateApplication = UpdateTables<'applications'>;

// Screening report types
export type ScreeningReport = Tables<'screening_reports'>;
export type InsertScreeningReport = InsertTables<'screening_reports'>;
export type UpdateScreeningReport = UpdateTables<'screening_reports'>;

// Credit report types
export type CreditReport = Tables<'credit_reports'>;
export type InsertCreditReport = InsertTables<'credit_reports'>;
export type UpdateCreditReport = UpdateTables<'credit_reports'>;

// Appointment types
export type Appointment = Tables<'appointments'>;
export type InsertAppointment = InsertTables<'appointments'>;
export type UpdateAppointment = UpdateTables<'appointments'>;

// Subscription types
export type Subscription = Tables<'subscriptions'>;
export type InsertSubscription = InsertTables<'subscriptions'>;
export type UpdateSubscription = UpdateTables<'subscriptions'>;

export interface SubscriptionChange {
	id: string;
	subscription_id: string;
	previous_plan_name: string;
	new_plan_name: string;
	prorated_amount: number;
	unused_credits: number;
	credit_value: number;
	final_amount: number;
	created_at: string;
	user_id: string;
	team_id?: string;
}

// Email workflow types
export type EmailWorkflow = Tables<'email_workflows'>;
export type InsertEmailWorkflow = InsertTables<'email_workflows'>;
export type UpdateEmailWorkflow = UpdateTables<'email_workflows'>;

// Workflow log types
export type WorkflowLog = Tables<'workflow_logs'>;
export type InsertWorkflowLog = InsertTables<'workflow_logs'>;
export type UpdateWorkflowLog = UpdateTables<'workflow_logs'>;

// Team types
export type Team = Tables<'teams'> & {
	subscription?: {
		id: string;
		plan_name: string;
		status: 'active' | 'inactive' | 'cancelled';
		usage_limit: number;
		current_usage: number;
		created_at: string;
		updated_at: string;
	};
};
export type InsertTeam = InsertTables<'teams'>;
export type UpdateTeam = UpdateTables<'teams'>;

export interface TeamSubscription {
	id: string;
	plan_name: string;
	status: 'active' | 'inactive' | 'cancelled';
	usage_limit: number;
	current_usage: number;
	created_at: string;
	updated_at: string;
}

// Team member types
export type TeamMember = Tables<'team_members'>;
export type InsertTeamMember = InsertTables<'team_members'>;
export type UpdateTeamMember = UpdateTables<'team_members'>;

// Team invitation types
export type TeamInvitation = Tables<'team_invitations'>;
export type InsertTeamInvitation = InsertTables<'team_invitations'>;
export type UpdateTeamInvitation = UpdateTables<'team_invitations'>;
