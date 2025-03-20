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
	fetchDocuments: (applicationId: string) => Promise<void>;
	uploadDocument: (
		document: Omit<
			Document,
			'id' | 'created_at' | 'updated_at' | 'verification_status'
		> & { file: File },
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
			const { data, error } = await supabase
				.from('tenants')
				.select('*')
				.eq('id', tenantId)
				.single();

			if (error) throw error;

			set({
				profile: data || null,
				isLoading: false,
			});
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
		}
	},

	updateProfile: async (profile) => {
		set({ isLoading: true, error: null });
		try {
			if (!profile.id) {
				throw new Error('Profile ID is required for updates');
			}

			const { data, error } = await supabase
				.from('tenants')
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

	fetchDocuments: async (applicationId) => {
		set({ isLoading: true, error: null });
		try {
			const { data, error } = await supabase
				.from('documents')
				.select('*')
				.eq('application_id', applicationId);

			if (error) throw error;

			set({ documents: data || [], isLoading: false });
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
		}
	},

	uploadDocument: async (document) => {
		set({ isLoading: true, error: null });
		try {
			// Get file extension from the File object
			const fileName = document.file.name;
			const fileExt = fileName.split('.').pop();
			const filePath = `${document.application_id}/${Date.now()}.${fileExt}`;

			// Upload to storage
			const { data: fileData, error: fileError } = await supabase.storage
				.from('tenant_documents')
				.upload(filePath, document.file, {
					cacheControl: '3600',
					upsert: false,
				});

			if (fileError) throw fileError;

			// Now save the document metadata to the database
			const { data, error } = await supabase
				.from('documents')
				.insert({
					application_id: document.application_id,
					document_type: document.document_type,
					file_path: fileData?.path || filePath,
					verification_status: 'pending',
					extracted_data: document.extracted_data || null,
					notes: document.notes || null,
				})
				.select()
				.single();

			if (error) throw error;

			set((state) => ({
				documents: [...state.documents, data],
				isLoading: false,
			}));
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
		}
	},

	fetchScreeningReport: async (applicationId) => {
		set({ isLoading: true, error: null });
		try {
			const { data, error } = await supabase
				.from('screening_reports')
				.select('*')
				.eq('application_id', applicationId)
				.single();

			if (error) throw error;

			set({ screeningReport: data, isLoading: false });
		} catch (error) {
			set({ error: (error as Error).message, isLoading: false });
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
