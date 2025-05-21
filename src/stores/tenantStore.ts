/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { formatDate } from '../utils/formatters';
import {
	Document,
	TenantProfile,
	ScreeningReport,
	Appointment,
	UpdateTenantProfile,
	Property,
	Application,
	Tables,
} from '../types';
import { InsertTables } from '../services/database.types'; // Corrected path

interface TenantState {
	profile: TenantProfile | null;
	documents: Document[];
	screeningReport: ScreeningReport | null;
	appointments: Appointment[];
	isLoading: boolean;
	error: string | null;

	fetchProfile: (tenantId: string) => Promise<void>;
	updateProfile: (profile: UpdateTenantProfile) => Promise<void>;
	fetchDocuments: (userId: string) => Promise<void>;
	uploadDocument: (
		document: Omit<
			Document,
			'id' | 'created_at' | 'updated_at' | 'verification_status'
		> & { file?: File },
	) => Promise<Document>;
	fetchScreeningReport: (id: string) => Promise<void>;
	fetchAppointments: (tenantId: string) => Promise<void>;
	scheduleAppointment: (
		appointment: Omit<InsertTables<'appointments'>, 'id' | 'created_at'>,
	) => Promise<void>;
	fetchPropertyByToken: (token: string) => Promise<Property | null>;
	submitApplication: (application: {
		property_id: string;
		agent_id: string;
		tenant_id: string;
		employer: string;
		employment_duration: number;
		monthly_income: number;
		notes?: string;
	}) => Promise<Application | null>;
	completeApplicationWithDocuments: (
		applicationId: string,
		documentTypes: string[],
		forceComplete: boolean,
	) => Promise<boolean>;
}

export const useTenantStore = create<TenantState>((set, get) => ({
	profile: null,
	documents: [],
	screeningReport: null,
	appointments: [],
	isLoading: false,
	error: null,

	fetchProfile: async (tenantId) => {
		set({ isLoading: true, error: null });
		try {
			// First, get the basic user information
			const { data: userData, error: userError } = await supabase
				.from('users')
				.select('*')
				.eq('id', tenantId)
				.single();

			if (userError) throw userError;

			if (!userData) {
				set({ profile: null, isLoading: false });
				return;
			}

			// Get tenant profile using tenant_id, use maybeSingle() instead of single()
			const { data: tenantData, error: tenantError } = await supabase
				.from('tenant_profiles')
				.select('*')
				.eq('tenant_id', tenantId)
				.maybeSingle();

			if (tenantError) throw tenantError;

			// If no tenant profile exists yet, create a default one
			if (!tenantData) {
				const defaultProfile: Tables<'tenant_profiles'> = {
					...userData,
					current_address: '',
					id_number: '',
					employment_status: '',
					monthly_income: 0,
					tenant_id: tenantId,
				};
				set({ profile: defaultProfile, isLoading: false });
				return;
			}

			// Merge existing user data with tenant profile data
			const profileData = tenantData as Tables<'tenant_profiles'>;

			set({ profile: profileData, isLoading: false });
		} catch (error) {
			console.error('Error fetching tenant profile:', error);
			set({
				error: (error as Error).message,
				isLoading: false,
				profile: null,
			});
		}
	},

	updateProfile: async (profile) => {
		set({ isLoading: true, error: null });
		try {
			if (!profile.id) {
				throw new Error('Profile ID is required for updates');
			}

			const { data, error } = await supabase
				.from('tenant_profiles')
				.update(profile)
				.eq('id', profile.id)
				.select()
				.single();

			if (error) throw error;

			set((state) => ({
				profile: data || state.profile,
				isLoading: false,
			}));
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
		}
	},

	fetchDocuments: async (userId) => {
		set({ isLoading: true, error: null });
		try {
			const { data, error } = await supabase
				.from('documents')
				.select('*')
				.eq('user_id', userId);

			if (error) throw error;

			set({ documents: data || [], isLoading: false });
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
		}
	},

	uploadDocument: async (
		document: Omit<
			Document,
			'id' | 'created_at' | 'updated_at' | 'verification_status'
		> & {
			file?: File;
			verification_status?: string;
		},
	): Promise<Document> => {
		set({ isLoading: true, error: null });

		try {
			let filePath = document.file_path;

			// If we have a file object, upload it to storage
			if (document.file) {
				const fileName = document.file.name;
				const fileExt = fileName.split('.').pop();
				filePath = `${document.application_id}/${Date.now()}.${fileExt}`;

				const { data: fileData, error: fileError } = await supabase.storage
					.from('tenant_documents')
					.upload(filePath, document.file, {
						cacheControl: '3600',
						upsert: false,
					});

				if (fileError) {
					console.error('Storage upload error:', fileError);
					throw fileError;
				}

				filePath = fileData?.path || filePath;
			}

			// Prepare document record with explicit typing
			const documentRecord = {
				user_id: document.user_id,
				document_type: document.document_type,
				file_path: filePath,
				verification_status: 'pending',
				extracted_data: document.extracted_data,
				notes: document.notes || null,
				file_name: document.file_name,
				file_size: document.file_size,
				application_id: document.application_id || (null as any),
			};

			// Split the insert operation to debug
			const insertResponse = await supabase
				.from('documents')
				.insert(documentRecord);

			if (insertResponse.error) {
				console.error('Database insert error details:', {
					error: insertResponse.error,
					message: insertResponse.error.message,
					details: insertResponse.error.details,
					hint: insertResponse.error.hint,
				});
				throw insertResponse.error;
			}

			// Separate select to verify insertion
			const { data: verifyData, error: verifyError } = await supabase
				.from('documents')
				.select('*')
				.eq('user_id', document.user_id)
				.eq('file_name', document.file_name)
				.single();

			if (verifyError) {
				console.error('Verification query error:', verifyError);
				throw verifyError;
			}

			set((state) => ({
				documents: [...state.documents, verifyData],
				isLoading: false,
			}));

			return verifyData as Document;
		} catch (error: any) {
			console.error('Document upload failed:', {
				error,
				name: error.name,
				message: error.message,
				stack: error.stack,
				details: error.details,
				code: error.code,
			});
			set({ error: (error as Error).message, isLoading: false });
			throw error;
		}
	},

	fetchScreeningReport: async (id) => {
		set({ isLoading: true, error: null });
		try {
			// If this is an application ID (UUID), try to fetch directly
			const uuidPattern =
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
			if (uuidPattern.test(id)) {
				const { data: appData, error: appError } = await supabase
					.from('screening_reports')
					.select('*')
					.eq('application_id', id);

				if (!appError && appData && appData.length > 0) {
					set({
						screeningReport: appData[0],
						isLoading: false,
					});
					return;
				}
			}

			const { data: profileData, error: profileError } = await supabase
				.from('tenant_profiles')
				.select('id')
				.eq('tenant_id', id)
				.maybeSingle();

			if (profileError) {
				console.error('Error fetching tenant profile:', profileError);
				throw profileError;
			}

			const tenantProfileId = profileData?.id;

			if (!tenantProfileId) {
				set({
					screeningReport: null,
					isLoading: false,
				});
				return;
			}

			// Query screening reports using the tenant profile ID
			const { data, error } = await supabase
				.from('screening_reports')
				.select('*')
				.eq('tenant_id', tenantProfileId);

			if (error) throw error;

			// If no reports found by tenant profile ID, try to find via applications
			if (!data || data.length === 0) {
				// Find the most recent application for this tenant
				const { data: appData, error: appError } = await supabase
					.from('applications')
					.select('id')
					.eq('tenant_id', tenantProfileId)
					.order('created_at', { ascending: false })
					.limit(1);

				if (appError) {
					console.error('Error fetching applications:', appError);
					set({
						screeningReport: null,
						isLoading: false,
					});
					return;
				}

				if (!appData || appData.length === 0) {
					set({
						screeningReport: null,
						isLoading: false,
					});
					return;
				}

				const applicationId = appData[0].id;

				// Try to find screening report for this application
				const { data: reportData, error: reportError } = await supabase
					.from('screening_reports')
					.select('*')
					.eq('application_id', applicationId);

				if (reportError) {
					console.error(
						'Error fetching screening report by application:',
						reportError,
					);
					set({
						screeningReport: null,
						isLoading: false,
					});
					return;
				}

				if (!reportData || reportData.length === 0) {
					set({
						screeningReport: null,
						isLoading: false,
					});
					return;
				}
				set({
					screeningReport: reportData[0],
					isLoading: false,
				});
				return;
			}

			const sortedReports = [...data].sort(
				(a, b) =>
					new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
			);

			set({
				screeningReport: sortedReports[0],
				isLoading: false,
			});
		} catch (error) {
			console.error('Error fetching screening report:', error);
			set({
				error: (error as Error).message,
				isLoading: false,
				screeningReport: null, // Reset on error
			});
		}
	},

	fetchAppointments: async (tenantId) => {
		set({ isLoading: true, error: null });
		try {
			const { data, error } = await supabase
				.from('appointments')
				.select('*')
				.eq('tenant_id', tenantId)
				.order('date', { ascending: true })
				.order('start_time', { ascending: true }); // Order by date and time

			if (error) throw error;

			// Format dates for display using the imported formatter
			const formattedAppointments = data?.map((appointment) => ({
				...appointment,
				date: formatDate(appointment.date), // Use formatDate
			}));

			set({ appointments: formattedAppointments || [], isLoading: false });
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
		}
	},

	scheduleAppointment: async (
		appointment: Omit<InsertTables<'appointments'>, 'id' | 'created_at'>,
	): Promise<void> => {
		set({ isLoading: true, error: null });
		try {
			// Ensure the payload matches the expected type for insertion
			const appointmentPayload: InsertTables<'appointments'> = {
				...appointment,
				status: appointment.status || 'scheduled', // Default status
			};

			const { error } = await supabase
				.from('appointments')
				.insert(appointmentPayload);

			if (error) {
				console.error('Supabase insert error:', error);
				throw error;
			}

			set({ isLoading: false });

			// Fetch updated appointments after successful scheduling
			// No need to manually add to state if fetchAppointments is called after this
		} catch (error) {
			console.error('Error in scheduleAppointment:', error);
			set({ error: (error as Error).message, isLoading: false });
			throw error; // Re-throw the error so the component can catch it
		}
	},

	fetchPropertyByToken: async (token: string): Promise<Property | null> => {
		set({ isLoading: true, error: null });
		try {
			// Try to use the stored function first (this bypasses RLS)
			const { data: rpcData, error: rpcError } = await supabase.rpc<Property[]>(
				'get_property_by_token',
				{ token_param: token },
			);

			if (!rpcError && rpcData && rpcData.length > 0) {
				set({ isLoading: false });
				return rpcData[0];
			}

			// Fallback to standard query
			const { data, error } = await supabase
				.from('properties')
				.select('*')
				.ilike('application_link', `%${token}%`)
				.maybeSingle();

			set({ isLoading: false });

			if (error) {
				console.error('Error fetching property:', error);
				throw error;
			}

			return data;
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
			return null;
		}
	},

	submitApplication: async (application: {
		property_id: string;
		agent_id: string;
		tenant_id: string;
		employer: string;
		employment_duration: number;
		monthly_income: number;
		notes?: string;
	}): Promise<Application | null> => {
		set({ isLoading: true, error: null });
		try {
			// Validate numeric fields
			if (
				isNaN(application.employment_duration) ||
				isNaN(application.monthly_income)
			) {
				throw new Error(
					'Employment duration and monthly income must be valid numbers',
				);
			}

			// Normalize numeric values
			const employmentDuration = Number(application.employment_duration);
			const monthlyIncome = Number(application.monthly_income);

			// First check for existing application using direct query as fallback
			const { data: existingData } = await supabase
				.from('applications')
				.select('*')
				.eq('tenant_id', application.tenant_id)
				.eq('property_id', application.property_id)
				.maybeSingle();

			if (existingData) {
				set({ isLoading: false });
				return existingData;
			}

			// Try RPC insert first (with built-in duplicate check)
			try {
				const { data: applicationId, error: rpcError } =
					await supabase.rpc<string>('insert_application_safe', {
						p_property_id: application.property_id,
						p_agent_id: application.agent_id,
						p_tenant_id: application.tenant_id,
						p_employer: application.employer,
						p_employment_duration: employmentDuration,
						p_monthly_income: monthlyIncome,
						p_notes: application.notes || null,
					});

				if (rpcError) {
					console.warn(
						'RPC insert failed, falling back to direct insert:',
						rpcError,
					);
					throw rpcError;
				}

				// Fetch the created application
				const { data: createdApplication, error: fetchError } = await supabase
					.from('applications')
					.select('*')
					.eq('id', applicationId)
					.single();

				if (fetchError) throw fetchError;

				set({ isLoading: false });
				return createdApplication;
			} catch (_) {
				// Fallback to direct insert with unique constraint
				const applicationData = {
					...application,
					employment_duration: employmentDuration,
					monthly_income: monthlyIncome,
					status: 'pending',
					created_at: new Date().toISOString(),
				};

				const { data, error } = await supabase
					.from('applications')
					.insert(applicationData)
					.select()
					.single();

				if (error) {
					if (error.code === '23505') {
						// Unique violation
						const { data: existingData } = await supabase
							.from('applications')
							.select('*')
							.eq('tenant_id', application.tenant_id)
							.eq('property_id', application.property_id)
							.single();

						set({ isLoading: false });
						return existingData;
					}
					throw error;
				}

				set({ isLoading: false });
				return data;
			}
		} catch (error) {
			console.error('Application submission error:', error);
			set({ error: (error as Error).message, isLoading: false });
			return null;
		}
	},

	completeApplicationWithDocuments: async (
		applicationId: string,
		requiredTypes: string[],
		forceComplete = false,
	): Promise<boolean> => {
		try {
			// 1. Update application status first
			const { error: updateError } = await supabase
				.from('applications')
				.update({ status: 'documents_uploaded' })
				.eq('id', applicationId);

			if (updateError) throw updateError;

			// Return early if force completing
			if (forceComplete) return true;

			// 2. Get all documents for this user, not just for this application
			const { data: userDocs, error: docsError } = await supabase
				.from('documents')
				.select('document_type, created_at')
				.order('created_at', { ascending: false });

			if (docsError) throw docsError;

			// 3. Filter for valid documents (within last 30 days) and check required types
			const validDocs =
				userDocs?.filter((doc) => {
					const createdAt = new Date(doc.created_at);
					const now = new Date();
					const diff = now.getTime() - createdAt.getTime();
					const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
					return diff <= THIRTY_DAYS;
				}) || [];

			// 4. Check if all required document types are present
			const uploadedTypes = validDocs.map((doc) =>
				doc.document_type.toLowerCase().replace(/[_\s-]/g, ''),
			);

			const missingTypes = requiredTypes.filter((type) => {
				const normRequired = type.toLowerCase().replace(/[_\s-]/g, '');
				return !uploadedTypes.includes(normRequired);
			});

			// 5. If we have all required documents, associate them with this application
			if (missingTypes.length === 0) {
				// Optional: Link existing documents to this application if they're not already linked
				const { error: linkError } = await supabase
					.from('documents')
					.update({ application_id: applicationId })
					.is('application_id', null)
					.in('document_type', requiredTypes);

				if (linkError) {
					console.warn('Error linking documents to application:', linkError);
					// Don't throw error here, as it's not critical
				}

				return true;
			}

			return false;
		} catch (error) {
			console.error('Error completing application:', error);
			throw error; // Re-throw to handle in the component
		}
	},
}));

// Helper to determine if a document is valid (uploaded in the last 30 days)
const isDocumentValid = (docDate: string): boolean => {
	const createdAt = new Date(docDate);
	const now = new Date();
	const diff = now.getTime() - createdAt.getTime();
	const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
	return diff <= THIRTY_DAYS;
};
