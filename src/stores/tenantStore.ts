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
} from '../types';

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
	) => Promise<void>;
	fetchScreeningReport: (applicationId: string) => Promise<void>;
	fetchAppointments: (tenantId: string) => Promise<void>;
	scheduleAppointment: (
		appointment: Omit<Appointment, 'id' | 'created_at'>,
	) => Promise<void>;
}

export const useTenantStore = create<TenantState>((set) => ({
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
				const defaultProfile: TenantProfile = {
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
			const profileData: TenantProfile = {
				...userData,
				...tenantData,
			};

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

	uploadDocument: async (document) => {
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
				application_id: document.application_id || null,
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

			return verifyData;
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

	fetchScreeningReport: async (applicationId) => {
		set({ isLoading: true, error: null });
		try {
			// Don't use single() which can cause 406 errors when no report exists
			const { data, error } = await supabase
				.from('screening_reports')
				.select('*')
				.eq('application_id', applicationId);

			if (error) throw error;

			// If no data or empty array, set screeningReport to null
			if (!data || data.length === 0) {
				set({
					screeningReport: null,
					isLoading: false,
				});
				return;
			}

			// Use the first report if multiple exist (though this shouldn't happen)
			set({
				screeningReport: data[0],
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
				.eq('tenant_id', tenantId);

			if (error) throw error;

			// Format dates for display
			const formattedAppointments = data?.map((appointment) => ({
				...appointment,
				date: formatDate(appointment.date),
			}));

			set({ appointments: formattedAppointments || [], isLoading: false });
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
		}
	},

	scheduleAppointment: async (appointment) => {
		set({ isLoading: true, error: null });
		try {
			// Make sure all required fields are present
			if (
				!appointment.employer ||
				!appointment.employment_duration ||
				!appointment.monthly_income
			) {
				throw new Error('Missing required employment information');
			}

			const { data, error } = await supabase
				.from('appointments')
				.insert({
					tenant_id: appointment.tenant_id,
					agent_id: appointment.agent_id,
					property_id: appointment.property_id,
					date: appointment.date,
					time: appointment.time,
					status: appointment.status,
					notes: appointment.notes || null,
					employer: appointment.employer,
					employment_duration: appointment.employment_duration,
					monthly_income: appointment.monthly_income,
				})
				.select()
				.single();

			if (error) throw error;

			// Format date for display and ensure we have the correct type
			const formattedAppointment: Appointment = {
				id: data.id,
				tenant_id: data.tenant_id,
				agent_id: data.agent_id,
				property_id: data.property_id,
				date: formatDate(data.date),
				time: data.time,
				status: data.status as Appointment['status'],
				notes: data.notes || null,
				employer: data.employer,
				employment_duration: data.employment_duration,
				monthly_income: data.monthly_income,
				created_at: data.created_at,
			};

			set((state) => ({
				appointments: [...state.appointments, formattedAppointment],
				isLoading: false,
			}));
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
		}
	},
}));
