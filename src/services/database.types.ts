/* eslint-disable @typescript-eslint/no-explicit-any */
import { SupabaseClient } from '@supabase/supabase-js';

export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export interface Database {
	public: {
		Tables: {
			applications: {
				Row: {
					agent_id: string;
					created_at: string;
					employer: string;
					employment_duration: number;
					id: string;
					monthly_income: number;
					notes: string | null;
					property_id: string;
					team_id: string | null;
					status: string;
					tenant_id: string;
					updated_at: string;
					decision_at: string | null;
				};
				Insert: {
					agent_id: string;
					created_at?: string;
					employer: string;
					employment_duration: number;
					id?: string;
					team_id?: string | null;
					monthly_income: number;
					notes?: string | null;
					property_id: string;
					status: string;
					tenant_id: string;
					updated_at?: string;
					decision_at?: string | null;
				};
				Update: {
					agent_id?: string;
					created_at?: string;
					employer?: string;
					employment_duration?: number;
					id?: string;
					team_id?: string | null;
					monthly_income?: number;
					notes?: string | null;
					property_id?: string;
					status?: string;
					tenant_id?: string;
					updated_at?: string;
					decision_at?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'applications_agent_id_fkey';
						columns: ['agent_id'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'applications_property_id_fkey';
						columns: ['property_id'];
						isOneToOne: false;
						referencedRelation: 'properties';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'applications_tenant_id_fkey';
						columns: ['tenant_id'];
						isOneToOne: false;
						referencedRelation: 'tenant_profiles';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: '${tableName}_team_id_fkey';
						columns: ['team_id'];
						isOneToOne: false;
						referencedRelation: 'teams';
						referencedColumns: ['id'];
					},
				];
			};
			documents: {
				Row: {
					application_id: string | null;
					created_at: string;
					document_type: string;
					extracted_data: Json | null;
					file_path: string;
					id: string;
					notes: string | null;
					updated_at: string;
					verification_status: string;
					user_id: string;
					team_id: string | null;
					file_name: string;
					file_size: number;
				};
				Insert: {
					application_id?: string;
					created_at?: string;
					document_type: string;
					extracted_data?: Json | null;
					file_path: string;
					id?: string;
					notes?: string | null;
					updated_at?: string;
					verification_status: string;
					user_id?: string | null;
					team_id?: string | null;
					file_name?: string | null;
					file_size?: number | null;
				};
				Update: {
					application_id?: string;
					created_at?: string;
					document_type?: string;
					extracted_data?: Json | null;
					file_path?: string;
					id?: string;
					notes?: string | null;
					updated_at?: string;
					verification_status?: string;
					user_id?: string | null;
					team_id?: string | null;
					file_name?: string | null;
					file_size?: number | null;
				};
				Relationships: [
					{
						foreignKeyName: 'documents_application_id_fkey';
						columns: ['application_id'];
						isOneToOne: false;
						referencedRelation: 'applications';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'documents_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: '${tableName}_team_id_fkey';
						columns: ['team_id'];
						isOneToOne: false;
						referencedRelation: 'teams';
						referencedColumns: ['id'];
					},
				];
			};
			users: {
				Row: {
					company_name: string | null;
					created_at: string;
					email: string;
					first_name: string;
					id: string;
					last_name: string;
					phone: string | null;
					role: string;
					active_team_id: string | null;
					is_individual: boolean;
					updated_at: string;
				};
				Insert: {
					company_name?: string | null;
					created_at?: string;
					email: string;
					first_name: string;
					id?: string;
					last_name: string;
					phone?: string | null;
					role: string;
					active_team_id: string | null;
					is_individual: boolean;
					updated_at?: string;
				};
				Update: {
					company_name?: string | null;
					created_at?: string;
					email?: string;
					first_name?: string;
					id?: string;
					last_name?: string;
					phone?: string | null;
					role?: string;
					active_team_id?: string | null;
					is_individual?: boolean;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: '${tableName}_team_id_fkey';
						columns: ['team_id'];
						isOneToOne: false;
						referencedRelation: 'teams';
						referencedColumns: ['id'];
					},
				];
			};
			properties: {
				Row: {
					address: string;
					agent_id: string;
					team_id: string | null;
					available_from: string;
					bathrooms: number;
					bedrooms: number;
					city: string;
					created_at: string;
					deposit_amount: number;
					id: string;
					monthly_rent: number;
					postal_code: string;
					property_type: string;
					province: string;
					status: string;
					suburb: string;
					updated_at?: string;
					application_link: string;
					amenities: string[];
					images: string[];
					square_feet: number;
					description: string;
					web_reference: string;
				};
				Insert: {
					address: string;
					agent_id: string;
					team_id: string | null;
					available_from: string;
					bathrooms: number;
					bedrooms: number;
					city: string;
					created_at?: string;
					deposit_amount: number;
					id?: string;
					monthly_rent: number;
					postal_code: string;
					property_type: string;
					province: string;
					status: string;
					suburb: string;
					updated_at?: string;
					application_link: string;
					amenities: string[];
					images: string[];
					square_feet: number;
					description: string;
				};
				Update: {
					address?: string;
					agent_id?: string;
					team_id?: string | null;
					available_from?: string;
					bathrooms?: number;
					bedrooms?: number;
					city?: string;
					created_at?: string;
					deposit_amount?: number;
					id?: string;
					monthly_rent?: number;
					postal_code?: string;
					property_type?: string;
					province?: string;
					status?: string;
					suburb?: string;
					updated_at?: string;
					application_link?: string;
					amenities?: string[];
					images?: string[];
					square_feet?: number;
					description?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'properties_agent_id_fkey';
						columns: ['agent_id'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: '${tableName}_team_id_fkey';
						columns: ['team_id'];
						isOneToOne: false;
						referencedRelation: 'teams';
						referencedColumns: ['id'];
					},
				];
			};
			screening_reports: {
				Row: {
					affordability_notes: string | null;
					affordability_score: number | null;
					agent_id: string;
					application_id: string;
					team_id: string | null;
					created_at: string;
					credit_score: number | null;
					id: string;
					id_verification_status: string | null;
					income_verification: boolean;
					pre_approval_status: string;
					background_check_status: string | null;
					recommendation: string | null;
					credit_report_id: string | null;
					report_data: Json | null;
					updated_at: string;
				};
				Insert: {
					affordability_notes?: string | null;
					affordability_score?: number | null;
					agent_id: string;
					team_id?: string | null;
					application_id: string;
					created_at?: string;
					credit_score?: number | null;
					id?: string;
					id_verification_status?: string | null;
					income_verification?: boolean;
					background_check_status?: string | null;
					pre_approval_status: string;
					recommendation?: string | null;
					credit_report_id?: string | null;
					report_data?: Json | null;
					updated_at?: string;
				};
				Update: {
					affordability_notes?: string | null;
					affordability_score?: number | null;
					agent_id?: string;
					team_id?: string | null;
					application_id?: string;
					created_at?: string;
					credit_score?: number | null;
					id?: string;
					id_verification_status?: string | null;
					income_verification?: boolean;
					pre_approval_status?: string | null;
					background_check_status?: string | null;
					recommendation?: string | null;
					credit_report_id?: string | null;
					report_data?: Json | null;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'screening_reports_agent_id_fkey';
						columns: ['agent_id'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'screening_reports_application_id_fkey';
						columns: ['application_id'];
						isOneToOne: false;
						referencedRelation: 'applications';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'screening_reports_credit_report_id_fkey';
						columns: ['credit_report_id'];
						isOneToOne: false;
						referencedRelation: 'credit_reports';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: '${tableName}_team_id_fkey';
						columns: ['team_id'];
						isOneToOne: false;
						referencedRelation: 'teams';
						referencedColumns: ['id'];
					},
				];
			};
			tenant_profiles: {
				Row: {
					created_at: string;
					current_address: string;
					email: string;
					first_name: string;
					id: string;
					tenant_id: string;
					id_number: string;
					employer: string | null;
					employment_status: string;
					employment_duration: number;
					monthly_income: number;
					last_name: string;
					phone: string | null;
					updated_at: string;
				};
				Insert: {
					created_at?: string;
					current_address: string;
					email: string;
					first_name: string;
					id?: string;
					tenant_id?: string;
					id_number: string;
					last_name: string;
					employer?: string;
					employment_status?: string;
					employment_duration?: number;
					monthly_income?: number;
					phone: string | null;
					updated_at?: string;
				};
				Update: {
					created_at?: string;
					current_address?: string;
					email?: string;
					first_name?: string;
					id?: string;
					tenant_id?: string;
					id_number?: string;
					employer?: string;
					employment_status?: string;
					employment_duration?: number;
					monthly_income?: number;
					last_name?: string;
					phone?: string | null;
					updated_at?: string;
				};
				Relationships: [];
			};
			email_workflows: {
				Row: {
					id: string;
					agent_id: string;
					name: string;
					trigger_event: string;
					email_template: string;
					active: boolean;
					created_at: string;
					updated_at: string;
					email_filter: Json | null;
					actions: Json | null;
				};
				Insert: {
					id?: string;
					agent_id: string;
					name: string;
					trigger_event: string;
					email_template: string;
					active: boolean;
					created_at?: string;
					updated_at?: string;
					email_filter?: Json | null;
					actions?: Json | null;
				};
				Update: {
					id?: string;
					agent_id?: string;
					name?: string;
					trigger_event?: string;
					email_template?: string;
					active?: boolean;
					created_at?: string;
					updated_at?: string;
					email_filter?: Json | null;
					actions?: Json | null;
				};
				Relationships: [
					{
						foreignKeyName: 'email_workflows_agent_id_fkey';
						columns: ['agent_id'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					},
				];
			};
			workflow_logs: {
				Row: {
					id: string;
					workflow_id: string;
					tenant_id: string;
					application_id: string | null;
					triggered_at: string;
					status: string;
					error_message: string | null;
					email_subject: string | null;
					email_from: string | null;
					action_taken: string | null;
				};
				Insert: {
					id?: string;
					workflow_id: string;
					tenant_id: string;
					application_id?: string | null;
					triggered_at?: string;
					status: string;
					error_message?: string | null;
					email_subject?: string | null;
					email_from?: string | null;
					action_taken?: string | null;
				};
				Update: {
					id?: string;
					workflow_id?: string;
					tenant_id?: string;
					application_id?: string | null;
					triggered_at?: string;
					status?: string;
					error_message?: string | null;
					email_subject?: string | null;
					email_from?: string | null;
					action_taken?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'workflow_logs_workflow_id_fkey';
						columns: ['workflow_id'];
						isOneToOne: false;
						referencedRelation: 'email_workflows';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'workflow_logs_tenant_id_fkey';
						columns: ['tenant_id'];
						isOneToOne: false;
						referencedRelation: 'tenant_profiles';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'workflow_logs_application_id_fkey';
						columns: ['application_id'];
						isOneToOne: false;
						referencedRelation: 'applications';
						referencedColumns: ['id'];
					},
				];
			};
			appointments: {
				Row: {
					id: string;
					tenant_id: string;
					agent_id: string;
					property_id: string;
					date: string;
					start_time: string;
					end_time: string | null;
					status: string;
					notes: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					tenant_id: string;
					agent_id: string;
					property_id: string;
					date: string;
					start_time: string;
					end_time?: string | null;
					status: string;
					notes?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					tenant_id?: string;
					agent_id?: string;
					property_id?: string;
					date?: string;
					start_time?: string;
					end_time?: string | null;
					status?: string;
					notes?: string | null;
					created_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'appointments_tenant_id_fkey';
						columns: ['tenant_id'];
						isOneToOne: false;
						referencedRelation: 'tenant_profiles';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'appointments_agent_id_fkey';
						columns: ['agent_id'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'appointments_property_id_fkey';
						columns: ['property_id'];
						isOneToOne: false;
						referencedRelation: 'properties';
						referencedColumns: ['id'];
					},
				];
			};
			subscriptions: {
				Row: {
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
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					plan_name: string;
					plan_price: number;
					team_id: string | null;
					plan_type: string | null;
					is_team: boolean;
					usage_limit: number;
					current_usage?: number;
					status: string;
					paystack_subscription_id: string;
					start_date: string;
					end_date?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					plan_name?: string;
					plan_price?: number;
					team_id?: string | null;
					plan_type?: string | null;
					is_team?: boolean;
					usage_limit?: number;
					current_usage?: number;
					status?: string;
					paystack_subscription_id?: string;
					start_date?: string;
					end_date?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'subscriptions_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: '${tableName}_team_id_fkey';
						columns: ['team_id'];
						isOneToOne: false;
						referencedRelation: 'teams';
						referencedColumns: ['id'];
					},
				];
			};
			credit_reports: {
				Row: {
					id: string;
					tenant_id: string;
					status: string;
					risk_type: string | null;
					risk_color: string | null;
					credit_score: number | null;
					thin_file_indicator: boolean;
					score_version: string | null;
					score_type: string | null;
					decline_reasons: Json | null;
					enquiry_counts: Json | null;
					addresses: Json | null;
					employers: Json | null;
					accounts: Json | null;
					public_records: Json | null;
					payment_history: boolean;
					property_details: Json | null;
					directors: Json | null;
					nlr_summary: Json | null;
					raw_data: Json | null;
					pdf_file: string | null;
					pdf_path: string | null;
					report_date: string;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					tenant_id: string;
					status: string;
					risk_type?: string | null;
					risk_color?: string | null;
					credit_score?: number | null;
					thin_file_indicator?: boolean;
					score_version?: string | null;
					score_type?: string | null;
					decline_reasons?: Json | null;
					enquiry_counts?: Json | null;
					addresses?: Json | null;
					employers?: Json | null;
					accounts?: Json | null;
					public_records?: Json | null;
					payment_history?: boolean;
					property_details?: Json | null;
					directors?: Json | null;
					nlr_summary?: Json | null;
					raw_data?: Json | null;
					pdf_file?: string | null;
					pdf_path?: string | null;
					report_date?: string;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					tenant_id?: string;
					status?: string;
					risk_type?: string | null;
					risk_color?: string | null;
					credit_score?: number | null;
					thin_file_indicator?: boolean;
					score_version?: string | null;
					score_type?: string | null;
					decline_reasons?: Json | null;
					enquiry_counts?: Json | null;
					addresses?: Json | null;
					employers?: Json | null;
					accounts?: Json | null;
					public_records?: Json | null;
					payment_history?: boolean;
					property_details?: Json | null;
					directors?: Json | null;
					nlr_summary?: Json | null;
					raw_data?: Json | null;
					pdf_file?: string | null;
					pdf_path?: string | null;
					report_date?: string;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'credit_reports_tenant_id_fkey';
						columns: ['tenant_id'];
						isOneToOne: false;
						referencedRelation: 'tenant_profiles';
						referencedColumns: ['id'];
					},
				];
			};
			calendar_integrations: {
				Row: {
					id: string;
					user_id: string;
					provider: string;
					refresh_token: string;
					access_token: string | null;
					token_expiry: string | null;
					calendar_id: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					provider: string;
					refresh_token: string;
					access_token?: string | null;
					token_expiry?: string | null;
					calendar_id?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					provider?: string;
					refresh_token?: string;
					access_token?: string | null;
					token_expiry?: string | null;
					calendar_id?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'calendar_integrations_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					},
				];
			};
			email_integrations: {
				Row: {
					id: string;
					user_id: string;
					provider: string;
					refresh_token: string;
					access_token: string | null;
					token_expiry: string | null;
					email_address: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					provider: string;
					refresh_token: string;
					access_token?: string | null;
					token_expiry?: string | null;
					email_address?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					provider?: string;
					refresh_token?: string;
					access_token?: string | null;
					token_expiry?: string | null;
					email_address?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'email_integrations_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					},
				];
			};
			teams: {
				Row: {
					id: string;
					name: string;
					created_at: string;
					subscription_id: string | null;
					plan_type: string;
					max_members: number;
					updated_at: string;
				};
				Insert: {
					id?: string;
					name: string;
					subscription_id?: string;
					plan_type?: string;
					max_members?: number;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					name?: string;
					subscription_id?: string;
					plan_type?: string;
					max_members?: number;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'teams_subscription_id_fkey';
						columns: ['subscription_id'];
						isOneToOne: false;
						referencedRelation: 'subscriptions';
						referencedColumns: ['id'];
					},
				];
			};

			team_members: {
				Row: {
					user_id: string;
					team_id: string;
					role: string;
					joined_at: string;
				};
				Insert: {
					user_id: string;
					team_id: string;
					role: string;
					joined_at?: string;
				};
				Update: {
					user_id?: string;
					team_id?: string;
					role?: string;
					joined_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'team_members_team_id_fkey';
						columns: ['team_id'];
						isOneToOne: false;
						referencedRelation: 'teams';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'team_members_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					},
				];
			};

			team_invitations: {
				Row: {
					id: string;
					team_id: string;
					email: string;
					token: string;
					role: string;
					expires_at: string;
					created_at: string;
					created_by: string;
					status: string;
				};
				Insert: {
					id?: string;
					team_id: string;
					email: string;
					token: string;
					role?: string;
					expires_at: string;
					created_at?: string;
					created_by: string;
					status?: string;
				};
				Update: {
					id?: string;
					team_id?: string;
					email?: string;
					token?: string;
					role?: string;
					expires_at?: string;
					created_at?: string;
					created_by?: string;
					status?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'team_invitations_team_id_fkey';
						columns: ['team_id'];
						isOneToOne: false;
						referencedRelation: 'teams';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'team_invitations_created_by_fkey';
						columns: ['created_by'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					},
				];
			};
			team_stats: {
				Row: {
					team_id: string;
					member_count: number;
					pending_invites: number;
					last_updated: string;
				};
				Insert: {
					team_id: string;
					member_count?: number;
					pending_invites?: number;
					last_updated?: string;
				};
				Update: {
					team_id?: string;
					member_count?: number;
					pending_invites?: number;
					last_updated?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'team_stats_team_id_fkey';
						columns: ['team_id'];
						isOneToOne: true;
						referencedRelation: 'teams';
						referencedColumns: ['id'];
					},
				];
				plans: {
					Row: {
						id: string;
						name: string;
						price: number;
						usage_limit: number;
						description: string;
						extra_usage: string | null;
						is_team_plan: boolean;
						max_team_size: number | null;
						popular: boolean;
						features: string[];
						created_at: string;
						updated_at: string;
					};
					Insert: {
						id: string;
						name: string;
						price: number;
						usage_limit: number;
						description: string;
						extra_usage?: string | null;
						is_team_plan?: boolean;
						max_team_size?: number | null;
						popular?: boolean;
						features: string[];
						created_at?: string;
						updated_at?: string;
					};
					Update: {
						id?: string;
						name?: string;
						price?: number;
						usage_limit?: number;
						description?: string;
						extra_usage?: string | null;
						is_team_plan?: boolean;
						max_team_size?: number | null;
						popular?: boolean;
						features?: string[];
						created_at?: string;
						updated_at?: string;
					};
				};
			};
			team_email_addresses: {
				Row: {
					id: string;
					team_id: string;
					email_username: string;
					email_address: string;
					is_active: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					team_id: string;
					email_username: string;
					email_address: string;
					is_active?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					team_id?: string;
					email_username?: string;
					email_address?: string;
					is_active?: boolean;
					created_at?: string;
					updated_at?: string;
				};
			};
			email_threads: {
				Row: {
					id: string;
					team_id: string;
					subject: string;
					last_message_at: string;
					status: 'active' | 'archived' | 'deleted';
					priority: 'low' | 'normal' | 'high' | 'urgent';
					needs_follow_up: boolean;
					lead_source: string | null;
					property_id: string | null;
					tenant_id: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					team_id: string;
					subject: string;
					last_message_at?: string;
					status?: 'active' | 'archived' | 'deleted';
					priority?: 'low' | 'normal' | 'high' | 'urgent';
					needs_follow_up?: boolean;
					lead_source?: string | null;
					property_id?: string | null;
					tenant_id?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					team_id?: string;
					subject?: string;
					last_message_at?: string;
					status?: 'active' | 'archived' | 'deleted';
					priority?: 'low' | 'normal' | 'high' | 'urgent';
					needs_follow_up?: boolean;
					lead_source?: string | null;
					property_id?: string | null;
					tenant_id?: string | null;
					created_at?: string;
					updated_at?: string;
				};
			};
			email_messages: {
				Row: {
					id: string;
					thread_id: string;
					message_id: string;
					from_address: string;
					from_name: string | null;
					to_address: string;
					subject: string;
					body: string;
					body_html: string | null;
					status:
						| 'received'
						| 'sent'
						| 'draft'
						| 'archived'
						| 'deleted'
						| 'bounced'
						| 'failed';
					is_read: boolean;
					has_attachments: boolean;
					in_reply_to: string | null;
					sent_at: string | null;
					received_at: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					thread_id: string;
					message_id: string;
					from_address: string;
					from_name?: string | null;
					to_address: string;
					subject: string;
					body: string;
					body_html?: string | null;
					status?:
						| 'received'
						| 'sent'
						| 'draft'
						| 'archived'
						| 'deleted'
						| 'bounced'
						| 'failed';
					is_read?: boolean;
					has_attachments?: boolean;
					in_reply_to?: string | null;
					sent_at?: string | null;
					received_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					thread_id?: string;
					message_id?: string;
					from_address?: string;
					from_name?: string | null;
					to_address?: string;
					subject?: string;
					body?: string;
					body_html?: string | null;
					status?:
						| 'received'
						| 'sent'
						| 'draft'
						| 'archived'
						| 'deleted'
						| 'bounced'
						| 'failed';
					is_read?: boolean;
					has_attachments?: boolean;
					in_reply_to?: string | null;
					sent_at?: string | null;
					received_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
			};
			email_attachments: {
				Row: {
					id: string;
					message_id: string;
					file_name: string;
					file_type: string;
					file_size: number;
					storage_path: string;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					message_id: string;
					file_name: string;
					file_type: string;
					file_size: number;
					storage_path: string;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					message_id?: string;
					file_name?: string;
					file_type?: string;
					file_size?: number;
					storage_path?: string;
					created_at?: string;
					updated_at?: string;
				};
			};
			email_ai_suggestions: {
				Row: {
					id: string;
					message_id: string;
					suggestion_type: 'follow_up' | 'response' | 'classification';
					content: string;
					confidence_score: number;
					is_applied: boolean;
					metadata: Json | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					message_id: string;
					suggestion_type: 'follow_up' | 'response' | 'classification';
					content: string;
					confidence_score: number;
					is_applied?: boolean;
					metadata?: Json | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					message_id?: string;
					suggestion_type?: 'follow_up' | 'response' | 'classification';
					content?: string;
					confidence_score?: number;
					is_applied?: boolean;
					metadata?: Json | null;
					created_at?: string;
					updated_at?: string;
				};
			};
			email_delivery_logs: {
				Row: {
					id: string;
					message_id: string;
					event_type: string;
					recipient: string;
					status: string;
					error_message: string | null;
					raw_data: Json | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					message_id: string;
					event_type: string;
					recipient: string;
					status: string;
					error_message?: string | null;
					raw_data?: Json | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					message_id?: string;
					event_type?: string;
					recipient?: string;
					status?: string;
					error_message?: string | null;
					raw_data?: Json | null;
					created_at?: string;
					updated_at?: string;
				};
			};
			email_addresses: {
				Row: {
					id: string;
					user_id: string | null;
					team_id: string | null;
					email_address: string;
					is_active: boolean;
					is_primary: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id?: string | null;
					team_id?: string | null;
					email_address?: string;
					is_active?: boolean;
					is_primary?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string | null;
					team_id?: string | null;
					email_address?: string;
					is_active?: boolean;
					is_primary?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'email_addresses_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'email_addresses_team_id_fkey';
						columns: ['team_id'];
						isOneToOne: false;
						referencedRelation: 'teams';
						referencedColumns: ['id'];
					},
				];
			};
		};
		Functions: {
			save_screening_report: {
				Args: {
					p_application_id: string;
					p_agent_id_val: string; // renamed parameter to match SQL function
					p_tenant_id_val: string; // renamed parameter to match SQL function
					p_affordability_score: number;
					p_affordability_notes: string;
					p_income_verification: boolean;
					p_pre_approval_status: string;
					p_recommendation: string;
					p_report_data: Json;
					p_background_check_status: string;
					p_credit_score: number | null;
					p_monthly_income: number | null;
					p_credit_report_id?: string | null;
				};
				Returns: Record<string, any>;
			};

			// Added custom RPCs for PropertyApplication.tsx
			create_tenant_profile: {
				Args: {
					p_tenant_id: string;
					p_first_name: string;
					p_last_name: string;
					p_email: string;
					p_phone: string;
					p_current_address: string;
					p_id_number: string;
					p_employment_status: string;
					p_monthly_income: number;
				};
				Returns: string;
			};

			get_application_id_if_exists: {
				Args: {
					tenant_id_param: string;
					property_id_param: string;
				};
				Returns: string | null;
			};

			check_application_exists: {
				Args: {
					tenant_id_param: string;
					property_id_param: string;
				};
				Returns: boolean;
			};

			get_tenant_applications_for_property: {
				Args: {
					tenant_id_param: string;
					property_id_param: string;
				};
				Returns: Array<any>; // You can refine this to Application[] if needed
			};
			// Subscription usage tracking function
			increment_screening_usage: {
				Args: {
					agent_id: string;
				};
				Returns: {
					success: boolean;
					message: string;
					current_usage?: number;
					usage_limit?: number;
					remaining?: number;
					is_team?: boolean;
				};
			};
			// Added new RPC function to insert an application
			insert_application: {
				Args: {
					p_property_id: string;
					p_agent_id: string;
					p_tenant_id: string;
					p_employer: string;
					p_employment_duration: number;
					p_monthly_income: number;
					p_notes: string | null;
				};
				Returns: string;
			};
			// Added new RPC function to get property by token
			get_property_by_token: {
				Args: {
					token_param: string;
				};
				Returns: Database['public']['Tables']['properties']['Row'][];
			};

			// Add new safe application insert function
			insert_application_safe: {
				Args: {
					p_property_id: string;
					p_agent_id: string;
					p_tenant_id: string;
					p_employer: string;
					p_employment_duration: number;
					p_monthly_income: number;
					p_notes: string | null;
				};
				Returns: string;
			};

			// Add new function to get existing application
			get_existing_application: {
				Args: {
					p_tenant_id: string;
					p_property_id: string;
				};
				Returns: Database['public']['Tables']['applications']['Row'] | null;
			};
		};
	};
}

// Define custom type for Supabase client that properly includes RPC functions
export type TypedSupabaseClient = SupabaseClient<Database> & {
	rpc<T = any>(
		fn: keyof Database['public']['Functions'],
		args: Database['public']['Functions'][keyof Database['public']['Functions']]['Args'],
	): Promise<{ data: T; error: null } | { data: null; error: Error }>;
};

// Export table types
export type Tables<T extends keyof Database['public']['Tables']> =
	Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> =
	Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> =
	Database['public']['Tables'][T]['Update'];
