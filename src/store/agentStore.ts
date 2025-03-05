import { create } from 'zustand';
import { Application, Property, EmailWorkflow, WorkflowLog } from '../types';

interface AgentState {
  applications: Application[];
  properties: Property[];
  workflows: EmailWorkflow[];
  workflowLogs: WorkflowLog[];
  isLoading: boolean;
  error: string | null;
  
  fetchApplications: (agentId: string) => Promise<void>;
  updateApplicationStatus: (applicationId: string, status: Application['status'], notes?: string) => Promise<void>;
  fetchProperties: (ownerId: string) => Promise<void>;
  addProperty: (property: Omit<Property, 'id' | 'created_at' | 'application_link'>) => Promise<void>;
  updateProperty: (id: string, updates: Partial<Property>) => Promise<void>;
  deleteProperty: (id: string) => Promise<void>;
  generateApplicationLink: (propertyId: string) => Promise<string>;
  fetchWorkflows: (agentId: string) => Promise<void>;
  createWorkflow: (workflow: Omit<EmailWorkflow, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateWorkflow: (id: string, updates: Partial<EmailWorkflow>) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  fetchWorkflowLogs: (workflowId?: string) => Promise<void>;
}

// Mock data for MVP
const mockApplications: Application[] = [
  {
    id: '1',
    tenant_id: '1',
    property_id: '1',
    status: 'pending',
    submitted_at: new Date().toISOString(),
    decision_at: null,
    notes: '',
  },
  {
    id: '2',
    tenant_id: '4',
    property_id: '2',
    status: 'approved',
    submitted_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    decision_at: new Date().toISOString(),
    notes: 'Approved after verification of all documents',
  },
];

const mockProperties: Property[] = [
  {
    id: '1',
    owner_id: '3',
    address: '456 Oak Ave',
    city: 'Metropolis',
    state: 'NY',
    zip: '10001',
    rent: 2000,
    bedrooms: 2,
    bathrooms: 1,
    square_feet: 950,
    available_from: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    description: 'Modern 2-bedroom apartment with hardwood floors and stainless steel appliances.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'available',
    property_type: 'apartment',
    amenities: ['Dishwasher', 'Central AC', 'In-unit Laundry', 'Parking'],
    images: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2340&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2340&q=80'
    ],
    application_link: 'https://rentease.app/apply/prop_1',
  },
  {
    id: '2',
    owner_id: '3',
    address: '789 Pine St',
    city: 'Metropolis',
    state: 'NY',
    zip: '10002',
    rent: 2500,
    bedrooms: 3,
    bathrooms: 2,
    square_feet: 1200,
    available_from: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    description: 'Spacious 3-bedroom townhouse with private backyard and garage.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'available',
    property_type: 'townhouse',
    amenities: ['Backyard', 'Garage', 'Fireplace', 'Hardwood Floors'],
    images: [
      'https://images.unsplash.com/photo-1570129477492-45c003edd2be?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2340&q=80',
      'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2340&q=80'
    ],
    application_link: 'https://rentease.app/apply/prop_2',
  },
];

const mockWorkflows: EmailWorkflow[] = [
  {
    id: '1',
    agent_id: '2',
    name: 'Property Inquiry Response',
    email_filter: {
      subject_contains: ['interested in property', 'property available'],
      body_contains: ['looking for', 'interested in renting'],
    },
    actions: {
      send_application_link: true,
      custom_message: 'Thank you for your interest in our property. Please complete the application at the link below:',
    },
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const mockWorkflowLogs: WorkflowLog[] = [
  {
    id: '1',
    workflow_id: '1',
    triggered_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    email_subject: 'Interested in property at 456 Oak Ave',
    email_from: 'potential_tenant@example.com',
    action_taken: 'Sent application link',
    status: 'success',
  },
  {
    id: '2',
    workflow_id: '1',
    triggered_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    email_subject: 'Is the property at 789 Pine St still available?',
    email_from: 'another_tenant@example.com',
    action_taken: 'Sent application link',
    status: 'success',
  },
];

export const useAgentStore = create<AgentState>((set) => ({
  applications: [],
  properties: [],
  workflows: [],
  workflowLogs: [],
  isLoading: false,
  error: null,

  fetchApplications: async (agentId) => {
    set({ isLoading: true, error: null });
    try {
      // In a real app, we would fetch from Supabase
      // const { data, error } = await supabase
      //   .from('applications')
      //   .select('*, properties(*)')
      //   .eq('properties.owner_id', agentId);
      // if (error) throw error;
      
      // For MVP, we'll use mock data
      await new Promise(resolve => setTimeout(resolve, 500));
      set({ applications: mockApplications, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  updateApplicationStatus: async (applicationId, status, notes) => {
    set({ isLoading: true, error: null });
    try {
      // In a real app, we would update in Supabase
      // const { data, error } = await supabase
      //   .from('applications')
      //   .update({ 
      //     status, 
      //     notes, 
      //     decision_at: status !== 'pending' ? new Date().toISOString() : null 
      //   })
      //   .eq('id', applicationId);
      // if (error) throw error;
      
      // For MVP, we'll update the local state
      await new Promise(resolve => setTimeout(resolve, 500));
      set(state => ({
        applications: state.applications.map(app => 
          app.id === applicationId 
            ? { 
                ...app, 
                status, 
                notes: notes || app.notes,
                decision_at: status !== 'pending' ? new Date().toISOString() : null
              } 
            : app
        ),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  fetchProperties: async (ownerId) => {
    set({ isLoading: true, error: null });
    try {
      // In a real app, we would fetch from Supabase
      // const { data, error } = await supabase
      //   .from('properties')
      //   .select('*')
      //   .eq('owner_id', ownerId);
      // if (error) throw error;
      
      // For MVP, we'll use mock data
      await new Promise(resolve => setTimeout(resolve, 500));
      set({ properties: mockProperties, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  addProperty: async (property) => {
    set({ isLoading: true, error: null });
    try {
      // In a real app, we would save to Supabase
      // const { data, error } = await supabase
      //   .from('properties')
      //   .insert(property);
      // if (error) throw error;
      
      // For MVP, we'll update the local state
      await new Promise(resolve => setTimeout(resolve, 500));
      const now = new Date().toISOString();
      const newPropertyId = String(Date.now());
      const applicationLink = `https://rentease.app/apply/prop_${newPropertyId}`;
      
      const newProperty: Property = {
        ...property,
        id: newPropertyId,
        created_at: now,
        updated_at: now,
        application_link: applicationLink,
      };
      
      set(state => ({
        properties: [...state.properties, newProperty],
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  updateProperty: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      // In a real app, we would update in Supabase
      // const { data, error } = await supabase
      //   .from('properties')
      //   .update({ ...updates, updated_at: new Date().toISOString() })
      //   .eq('id', id);
      // if (error) throw error;
      
      // For MVP, we'll update the local state
      await new Promise(resolve => setTimeout(resolve, 500));
      set(state => ({
        properties: state.properties.map(property => 
          property.id === id 
            ? { ...property, ...updates, updated_at: new Date().toISOString() } 
            : property
        ),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  deleteProperty: async (id) => {
    set({ isLoading: true, error: null });
    try {
      // In a real app, we would delete from Supabase
      // const { error } = await supabase
      //   .from('properties')
      //   .delete()
      //   .eq('id', id);
      // if (error) throw error;
      
      // For MVP, we'll update the local state
      await new Promise(resolve => setTimeout(resolve, 500));
      set(state => ({
        properties: state.properties.filter(property => property.id !== id),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  generateApplicationLink: async (propertyId) => {
    set({ isLoading: true, error: null });
    try {
      // In a real app, we might generate a unique token and save it to Supabase
      // const token = generateUniqueToken();
      // const { data, error } = await supabase
      //   .from('properties')
      //   .update({ application_link: `https://rentease.app/apply/${token}` })
      //   .eq('id', propertyId);
      // if (error) throw error;
      
      // For MVP, we'll update the local state
      await new Promise(resolve => setTimeout(resolve, 500));
      const applicationLink = `https://rentease.app/apply/prop_${propertyId}_${Date.now()}`;
      
      set(state => ({
        properties: state.properties.map(property => 
          property.id === propertyId 
            ? { ...property, application_link: applicationLink, updated_at: new Date().toISOString() } 
            : property
        ),
        isLoading: false,
      }));
      
      return applicationLink;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      return '';
    }
  },

  fetchWorkflows: async (agentId) => {
    set({ isLoading: true, error: null });
    try {
      // In a real app, we would fetch from Supabase
      // const { data, error } = await supabase
      //   .from('email_workflows')
      //   .select('*')
      //   .eq('agent_id', agentId);
      // if (error) throw error;
      
      // For MVP, we'll use mock data
      await new Promise(resolve => setTimeout(resolve, 500));
      set({ workflows: mockWorkflows, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  createWorkflow: async (workflow) => {
    set({ isLoading: true, error: null });
    try {
      // In a real app, we would save to Supabase
      // const { data, error } = await supabase
      //   .from('email_workflows')
      //   .insert(workflow);
      // if (error) throw error;
      
      // For MVP, we'll update the local state
      await new Promise(resolve => setTimeout(resolve, 500));
      const now = new Date().toISOString();
      const newWorkflow: EmailWorkflow = {
        ...workflow,
        id: String(Date.now()),
        created_at: now,
        updated_at: now,
      };
      
      set(state => ({
        workflows: [...state.workflows, newWorkflow],
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  updateWorkflow: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      // In a real app, we would update in Supabase
      // const { data, error } = await supabase
      //   .from('email_workflows')
      //   .update({ ...updates, updated_at: new Date().toISOString() })
      //   .eq('id', id);
      // if (error) throw error;
      
      // For MVP, we'll update the local state
      await new Promise(resolve => setTimeout(resolve, 500));
      set(state => ({
        workflows: state.workflows.map(workflow => 
          workflow.id === id 
            ? { ...workflow, ...updates, updated_at: new Date().toISOString() } 
            : workflow
        ),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  deleteWorkflow: async (id) => {
    set({ isLoading: true, error: null });
    try {
      // In a real app, we would delete from Supabase
      // const { error } = await supabase
      //   .from('email_workflows')
      //   .delete()
      //   .eq('id', id);
      // if (error) throw error;
      
      // For MVP, we'll update the local state
      await new Promise(resolve => setTimeout(resolve, 500));
      set(state => ({
        workflows: state.workflows.filter(workflow => workflow.id !== id),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  fetchWorkflowLogs: async (workflowId) => {
    set({ isLoading: true, error: null });
    try {
      // In a real app, we would fetch from Supabase
      // let query = supabase.from('workflow_logs').select('*');
      // if (workflowId) {
      //   query = query.eq('workflow_id', workflowId);
      // }
      // const { data, error } = await query;
      // if (error) throw error;
      
      // For MVP, we'll use mock data
      await new Promise(resolve => setTimeout(resolve, 500));
      const logs = workflowId 
        ? mockWorkflowLogs.filter(log => log.workflow_id === workflowId)
        : mockWorkflowLogs;
      
      set({ workflowLogs: logs, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },
}));