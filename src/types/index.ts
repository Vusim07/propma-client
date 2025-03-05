export interface User {
  id: string;
  email: string;
  role: 'tenant' | 'agent' | 'landlord';
  created_at: string;
}

export interface TenantProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  current_address: string;
  employment_status: string;
  monthly_income: number;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_path: string;
  document_type: 'id' | 'bank_statement' | 'payslip' | 'other';
  ocr_text: string;
  created_at: string;
}

export interface ScreeningReport {
  id: string;
  user_id: string;
  credit_score: number;
  income_verification: boolean;
  background_check_status: 'pending' | 'passed' | 'failed';
  affordability_ratio: number;
  pre_approval_status: 'pending' | 'approved' | 'rejected';
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  tenant_id: string;
  property_id: string;
  agent_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'cancelled' | 'completed';
  notes: string;
  created_at: string;
}

export interface Property {
  id: string;
  owner_id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  rent: number;
  bedrooms: number;
  bathrooms: number;
  square_feet: number;
  available_from: string;
  description: string;
  created_at: string;
  updated_at?: string;
  status: 'available' | 'rented' | 'maintenance' | 'inactive';
  property_type: 'apartment' | 'house' | 'condo' | 'townhouse' | 'other';
  amenities?: string[];
  images?: string[];
  application_link?: string;
}

export interface Application {
  id: string;
  tenant_id: string;
  property_id: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  decision_at: string | null;
  notes: string;
}

export interface EmailWorkflow {
  id: string;
  agent_id: string;
  name: string;
  email_filter: {
    subject_contains?: string[];
    body_contains?: string[];
    from_contains?: string[];
  };
  actions: {
    send_application_link: boolean;
    custom_message?: string;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowLog {
  id: string;
  workflow_id: string;
  triggered_at: string;
  email_subject: string;
  email_from: string;
  action_taken: string;
  status: 'success' | 'failed';
}