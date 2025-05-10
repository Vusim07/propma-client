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
				.maybeSingle(); // Changed from single() to maybeSingle()

			if (tenantError) throw tenantError;
			console.log('Tenant profile:', tenantData);

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
			console.log('Tenant profile:', profileData);
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
		console.log('Starting uploadDocument in store with:', {
			documentType: document.document_type,
			fileName: document.file_name,
			userId: document.user_id,
		});

		set({ isLoading: true, error: null });

		try {
			console.log('Preparing document record:', document);

			let filePath = document.file_path;
			console.log('Initial file path:', filePath);

			// If we have a file object, upload it to storage
			if (document.file) {
				console.log('File object present, uploading to storage');
				const fileName = document.file.name;
				const fileExt = fileName.split('.').pop();
				filePath = `${document.application_id}/${Date.now()}.${fileExt}`;

				console.log('Uploading to storage path:', filePath);

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

				console.log('File uploaded successfully:', fileData);
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

			console.log(
				'Attempting database insert with record:',
				JSON.stringify(documentRecord, null, 2),
			);

			// Split the insert operation to debug
			const insertResponse = await supabase
				.from('documents')
				.insert(documentRecord);

			// Log the raw response
			console.log('Raw insert response:', insertResponse);

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

			console.log('Document successfully inserted and verified:', verifyData);

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
					console.log('Found screening report by application_id:', appData);
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
			console.log('Tenant profile ID for auth user:', tenantProfileId);

			if (!tenantProfileId) {
				console.log('No tenant profile found for this user');
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

			console.log('Screening report data by tenant profile ID:', data);

			if (error) throw error;

			// If no reports found by tenant profile ID, try to find via applications
			if (!data || data.length === 0) {
				console.log('No reports found by tenant_id, trying applications...');

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
					console.log('No applications found for this tenant');
					set({
						screeningReport: null,
						isLoading: false,
					});
					return;
				}

				const applicationId = appData[0].id;
				console.log('Found application ID:', applicationId);

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
					console.log('No screening report found for application');
					set({
						screeningReport: null,
						isLoading: false,
					});
					return;
				}

				console.log('Found screening report by application:', reportData);
				set({
					screeningReport: reportData[0],
					isLoading: false,
				});
				return;
			}

			// We found screening reports by tenant profile ID
			// Use the most recent one
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
			console.log('Scheduling appointment with payload:', appointment);
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

			console.log('Appointment inserted successfully');
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

			// Fallback to direct query if RPC fails or returns empty
			if (rpcError) {
				console.log(
					'RPC get_property_by_token failed, using fallback query:',
					rpcError,
				);
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
			// Validate the numeric fields to ensure they are numbers, not NaN
			if (
				isNaN(application.employment_duration) ||
				isNaN(application.monthly_income)
			) {
				throw new Error(
					'Employment duration and monthly income must be valid numbers',
				);
			}

			// Ensure numeric fields are actually numbers, not strings
			const employmentDuration = Number(application.employment_duration);
			const monthlyIncome = Number(application.monthly_income);

			console.log('Submitting application to Supabase:', {
				...application,
				employment_duration: employmentDuration,
				monthly_income: monthlyIncome,
			});

			// First try to use the RPC function to bypass RLS
			try {
				const { data: applicationId, error: rpcError } =
					await supabase.rpc<string>('insert_application', {
						p_property_id: application.property_id,
						p_agent_id: application.agent_id,
						p_tenant_id: application.tenant_id,
						p_employer: application.employer,
						p_employment_duration: employmentDuration,
						p_monthly_income: monthlyIncome,
						p_notes: application.notes || null,
					});

				if (rpcError) {
					console.log(
						'RPC insert_application failed, falling back to direct insert:',
						rpcError,
					);
					throw rpcError; // Throw to trigger the fallback
				}

				// Fetch the created application
				const { data: createdApplication, error: fetchError } = await supabase
					.from('applications')
					.select('*')
					.eq('id', applicationId)
					.single();

				if (fetchError) {
					throw fetchError;
				}

				set({ isLoading: false });
				return createdApplication;
			} catch (_) {
				// Use underscore to indicate unused variable
				console.log('Using fallback for application submission');

				// Fallback to direct insert (may still trigger RLS errors)
				const applicationData = {
					...application,
					employment_duration: employmentDuration,
					monthly_income: monthlyIncome,
					status: 'pending',
					created_at: new Date().toISOString(),
				};

				// Create the application record
				const { data, error } = await supabase
					.from('applications')
					.insert(applicationData)
					.select()
					.single();

				if (error) {
					console.error('Supabase error on application insert:', error);
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
		requiredDocTypes: string[],
		forceComplete: boolean = false,
	): Promise<boolean> => {
		try {
			// Use get() to access current state
			const validDocuments = get().documents.filter((doc: any) =>
				isDocumentValid(doc.created_at),
			);

			// Normalize the document_type strings for comparison.
			const normalizedUploadedTypes = validDocuments.map((doc: any) =>
				doc.document_type.toLowerCase().replace(/[_\s-]/g, ''),
			);

			// Check for any missing required document types.
			const missingDocs = requiredDocTypes.filter((req) => {
				const normRequired = req.toLowerCase().replace(/[_\s-]/g, '');
				return !normalizedUploadedTypes.some(
					(uploaded) =>
						uploaded === normRequired ||
						uploaded.includes(normRequired) ||
						normRequired.includes(uploaded),
				);
			});

			// If required docs are missing and forceComplete is not set, do not complete.
			if (missingDocs.length > 0 && !forceComplete) {
				return false;
			}

			// Otherwise, update the application record to complete the application.
			const { error } = await supabase
				.from('applications')
				.update({
					status: 'completed',
					updated_at: new Date().toISOString(),
				})
				.eq('id', applicationId);

			if (error) {
				console.error('Error updating application:', error);
				throw error;
			}

			return true;
		} catch (err) {
			console.error('Failed to complete application:', err);
			return false;
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
