export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export type Database = {
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
					status: string;
					tenant_id: string;
					updated_at: string;
					decision_at: string | null; // Add this field
				};
				Insert: {
					agent_id: string;
					created_at?: string;
					employer: string;
					employment_duration: number;
					id?: string;
					monthly_income: number;
					notes?: string | null;
					property_id: string;
					status: string;
					tenant_id: string;
					updated_at?: string;
					decision_at?: string | null; // Add this field
				};
				Update: {
					agent_id?: string;
					created_at?: string;
					employer?: string;
					employment_duration?: number;
					id?: string;
					monthly_income?: number;
					notes?: string | null;
					property_id?: string;
					status?: string;
					tenant_id?: string;
					updated_at?: string;
					decision_at?: string | null; // Add this field
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
					updated_at: string;
				};
				Insert: {
					company_name?: string | null;
					created_at?: string;
					email: string;
					first_name: string;
					id: string;
					last_name: string;
					phone?: string | null;
					role: string;
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
					updated_at?: string;
				};
				Relationships: [];
			};
			properties: {
				Row: {
					address: string;
					agent_id: string;
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
				};
				Insert: {
					address: string;
					agent_id: string;
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
				];
			};
			screening_reports: {
				Row: {
					affordability_notes: string | null;
					affordability_score: number | null;
					agent_id: string;
					application_id: string;
					created_at: string;
					credit_score: number | null;
					id: string;
					id_verification_status: string | null;
					income_verification: boolean;
					pre_approval_status: string;
					background_check_status: string | null;
					recommendation: string | null;
					report_data: Json | null;
					updated_at: string;
				};
				Insert: {
					affordability_notes?: string | null;
					affordability_score?: number | null;
					agent_id: string;
					application_id: string;
					created_at?: string;
					credit_score?: number | null;
					id?: string;
					id_verification_status?: string | null;
					income_verification?: boolean;
					background_check_status?: string | null;
					pre_approval_status: string;
					recommendation?: string | null;
					report_data?: Json | null;
					updated_at?: string;
				};
				Update: {
					affordability_notes?: string | null;
					affordability_score?: number | null;
					agent_id?: string;
					application_id?: string;
					created_at?: string;
					credit_score?: number | null;
					id?: string;
					id_verification_status?: string | null;
					income_verification?: boolean;
					pre_approval_status?: string | null;
					background_check_status?: string | null;
					recommendation?: string | null;
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
					employment_status: string;
					monthly_income: number;
					last_name: string;
					phone: string | null; // Changed from any
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
					employment_status?: string;
					monthly_income?: number;
					phone: string | null; // Changed from any
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
					employment_status?: string;
					monthly_income?: number;
					last_name?: string;
					phone?: string | null; // Changed from any
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
					start_time: string; // Correct field name
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
					start_time: string; // Changed from 'time' to 'start_time'
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
					start_time?: string; // Changed from 'time' to 'start_time'
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
					id: string; // Unique identifier for the subscription
					user_id: string; // Foreign key to the users table
					plan_name: string; // Name of the subscription plan (e.g., "Basic", "Pro", "Enterprise")
					plan_price: number; // Price of the plan in cents (ZAR)
					usage_limit: number; // Maximum usage allowed for the plan
					current_usage: number; // Current usage count
					status: string; // Subscription status (e.g., "active", "inactive", "cancelled")
					paystack_subscription_id: string; // Paystack subscription ID for integration
					start_date: string; // Subscription start date
					end_date: string | null; // Subscription end date (nullable for ongoing subscriptions)
					created_at: string; // Timestamp when the subscription was created
					updated_at: string; // Timestamp when the subscription was last updated
				};
				Insert: {
					id?: string;
					user_id: string;
					plan_name: string;
					plan_price: number;
					usage_limit: number;
					current_usage?: number; // Defaults to 0
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
				];
			};
			credit_reports: {
				Row: {
					id: string; // Unique identifier for the credit report
					tenant_id: string; // Foreign key to the tenant_profiles table
					status: string; // Status of the report (e.g., "Success")
					risk_type: string | null; // Risk type (e.g., "AVERAGE RISK")
					risk_color: string | null; // Risk color (e.g., "245,236,86")
					credit_score: number | null; // Credit score (e.g., 636)
					thin_file_indicator: boolean; // Indicates if the file is thin
					score_version: string | null; // Version of the score (e.g., "2")
					score_type: string | null; // Type of the score (e.g., "CPA")
					decline_reasons: Json | null; // Decline reasons as JSON array
					enquiry_counts: Json | null; // JSON object for enquiry counts
					addresses: Json | null; // JSON array for addresses
					employers: Json | null; // JSON array for employer history
					accounts: Json | null; // JSON array for account details
					public_records: Json | null; // JSON array for public records
					payment_history: boolean; // Indicates if payment history is available
					property_details: Json | null; // JSON object for property details
					directors: Json | null; // JSON array for director information
					nlr_summary: Json | null; // JSON object for NLR summary
					raw_data: Json | null; // Full raw JSON response for future-proofing
					pdf_file: string | null; // Base64-encoded PDF file
					report_date: string; // Date of the report
					created_at: string; // Timestamp when the record was created
					updated_at: string; // Timestamp when the record was last updated
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
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			[_ in never]: never;
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type PublicSchema = Database[Extract<keyof Database, 'public'>];

export type Tables<
	PublicTableNameOrOptions extends
		| keyof (PublicSchema['Tables'] & PublicSchema['Views'])
		| { schema: keyof Database },
	TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
		? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
				Database[PublicTableNameOrOptions['schema']]['Views'])
		: never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
	? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
			Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
			Row: infer R;
	  }
		? R
		: never
	: PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] &
			PublicSchema['Views'])
	? (PublicSchema['Tables'] &
			PublicSchema['Views'])[PublicTableNameOrOptions] extends {
			Row: infer R;
	  }
		? R
		: never
	: never;

export type TablesInsert<
	PublicTableNameOrOptions extends
		| keyof PublicSchema['Tables']
		| { schema: keyof Database },
	TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
		? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
		: never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
	? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Insert: infer I;
	  }
		? I
		: never
	: PublicTableNameOrOptions extends keyof PublicSchema['Tables']
	? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
			Insert: infer I;
	  }
		? I
		: never
	: never;

export type TablesUpdate<
	PublicTableNameOrOptions extends
		| keyof PublicSchema['Tables']
		| { schema: keyof Database },
	TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
		? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
		: never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
	? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Update: infer U;
	  }
		? U
		: never
	: PublicTableNameOrOptions extends keyof PublicSchema['Tables']
	? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
			Update: infer U;
	  }
		? U
		: never
	: never;

export type Enums<
	PublicEnumNameOrOptions extends
		| keyof PublicSchema['Enums']
		| { schema: keyof Database },
	EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
		? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
		: never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
	? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
	: PublicEnumNameOrOptions extends keyof PublicSchema['Enums']
	? PublicSchema['Enums'][PublicEnumNameOrOptions]
	: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		| keyof PublicSchema['CompositeTypes']
		| { schema: keyof Database },
	CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
		schema: keyof Database;
	}
		? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
		: never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
	? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof PublicSchema['CompositeTypes']
	? PublicSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
	: never;
