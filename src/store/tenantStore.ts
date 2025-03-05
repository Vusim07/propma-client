import { create } from 'zustand';
import { Document, TenantProfile, ScreeningReport, Appointment } from '../types';

interface TenantState {
  profile: TenantProfile | null;
  documents: Document[];
  screeningReport: ScreeningReport | null;
  appointments: Appointment[];
  isLoading: boolean;
  error: string | null;
  
  fetchProfile: (userId: string) => Promise<void>;
  updateProfile: (profile: Partial<TenantProfile>) => Promise<void>;
  fetchDocuments: (userId: string) => Promise<void>;
  uploadDocument: (document: Omit<Document, 'id' | 'created_at'>) => Promise<void>;
  fetchScreeningReport: (userId: string) => Promise<void>;
  fetchAppointments: (userId: string) => Promise<void>;
  scheduleAppointment: (appointment: Omit<Appointment, 'id' | 'created_at'>) => Promise<void>;
}

// Mock data for MVP
const mockProfile: TenantProfile = {
  id: '1',
  user_id: '1',
  first_name: 'John',
  last_name: 'Doe',
  phone: '555-123-4567',
  current_address: '123 Main St, Anytown, USA',
  employment_status: 'Employed',
  monthly_income: 5000,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockDocuments: Document[] = [
  {
    id: '1',
    user_id: '1',
    file_name: 'drivers_license.jpg',
    file_type: 'image/jpeg',
    file_size: 1024000,
    file_path: '/storage/documents/drivers_license.jpg',
    document_type: 'id',
    ocr_text: 'DRIVER LICENSE\nJOHN DOE\nDOB: 01/01/1985\n123 MAIN ST\nANYTOWN, USA',
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    user_id: '1',
    file_name: 'pay_stub.pdf',
    file_type: 'application/pdf',
    file_size: 512000,
    file_path: '/storage/documents/pay_stub.pdf',
    document_type: 'payslip',
    ocr_text: 'ACME CORP\nPAY PERIOD: 01/01/2023 - 01/15/2023\nEMPLOYEE: JOHN DOE\nGROSS PAY: $2,500.00\nNET PAY: $1,875.00',
    created_at: new Date().toISOString(),
  },
];

const mockScreeningReport: ScreeningReport = {
  id: '1',
  user_id: '1',
  credit_score: 720,
  income_verification: true,
  background_check_status: 'passed',
  affordability_ratio: 0.28,
  pre_approval_status: 'approved',
  notes: 'Tenant has good credit and income verification passed.',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockAppointments: Appointment[] = [
  {
    id: '1',
    tenant_id: '1',
    property_id: '1',
    agent_id: '2',
    date: '2023-06-15',
    start_time: '10:00',
    end_time: '10:30',
    status: 'scheduled',
    notes: 'First viewing of the property',
    created_at: new Date().toISOString(),
  },
];

export const useTenantStore = create<TenantState>((set) => ({
  profile: null,
  documents: [],
  screeningReport: null,
  appointments: [],
  isLoading: false,
  error: null,

  fetchProfile: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      // In a real app, we would fetch from Supabase
      // const { data, error } = await supabase
      //   .from('tenant_profiles')
      //   .select('*')
      //   .eq('user_id', userId)
      //   .single();
      // if (error) throw error;
      
      // For MVP, we'll use mock data
      await new Promise(resolve => setTimeout(resolve, 500));
      set({ profile: mockProfile, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  updateProfile: async (profile) => {
    set({ isLoading: true, error: null });
    try {
      // In a real app, we would update in Supabase
      // const { data, error } = await supabase
      //   .from('tenant_profiles')
      //   .update(profile)
      //   .eq('id', profile.id);
      // if (error) throw error;
      
      // For MVP, we'll update the local state
      await new Promise(resolve => setTimeout(resolve, 500));
      set(state => ({
        profile: state.profile ? { ...state.profile, ...profile, updated_at: new Date().toISOString() } : null,
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  fetchDocuments: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      // In a real app, we would fetch from Supabase
      // const { data, error } = await supabase
      //   .from('documents')
      //   .select('*')
      //   .eq('user_id', userId);
      // if (error) throw error;
      
      // For MVP, we'll use mock data
      await new Promise(resolve => setTimeout(resolve, 500));
      set({ documents: mockDocuments, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  uploadDocument: async (document) => {
    set({ isLoading: true, error: null });
    try {
      // In a real app, we would upload to Supabase Storage and then save metadata
      // const { data: fileData, error: fileError } = await supabase.storage
      //   .from('documents')
      //   .upload(`${document.user_id}/${document.file_name}`, document.file);
      // if (fileError) throw fileError;
      
      // const { data, error } = await supabase.from('documents').insert({
      //   ...document,
      //   file_path: fileData.path,
      // });
      // if (error) throw error;
      
      // For MVP, we'll update the local state
      await new Promise(resolve => setTimeout(resolve, 500));
      const newDocument: Document = {
        ...document,
        id: String(Date.now()),
        created_at: new Date().toISOString(),
      };
      
      set(state => ({
        documents: [...state.documents, newDocument],
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  fetchScreeningReport: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      // In a real app, we would fetch from Supabase
      // const { data, error } = await supabase
      //   .from('screening_reports')
      //   .select('*')
      //   .eq('user_id', userId)
      //   .single();
      // if (error) throw error;
      
      // For MVP, we'll use mock data
      await new Promise(resolve => setTimeout(resolve, 500));
      set({ screeningReport: mockScreeningReport, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  fetchAppointments: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      // In a real app, we would fetch from Supabase
      // const { data, error } = await supabase
      //   .from('appointments')
      //   .select('*')
      //   .eq('tenant_id', userId);
      // if (error) throw error;
      
      // For MVP, we'll use mock data
      await new Promise(resolve => setTimeout(resolve, 500));
      set({ appointments: mockAppointments, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  scheduleAppointment: async (appointment) => {
    set({ isLoading: true, error: null });
    try {
      // In a real app, we would save to Supabase
      // const { data, error } = await supabase
      //   .from('appointments')
      //   .insert(appointment);
      // if (error) throw error;
      
      // For MVP, we'll update the local state
      await new Promise(resolve => setTimeout(resolve, 500));
      const newAppointment: Appointment = {
        ...appointment,
        id: String(Date.now()),
        created_at: new Date().toISOString(),
      };
      
      set(state => ({
        appointments: [...state.appointments, newAppointment],
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },
}));