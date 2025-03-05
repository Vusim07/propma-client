import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { User } from '../types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, role: 'tenant' | 'agent' | 'landlord') => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

// For MVP purposes, we'll simulate authentication with mock data
const mockUsers = [
  {
    id: '1',
    email: 'tenant@example.com',
    role: 'tenant',
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    email: 'agent@example.com',
    role: 'agent',
    created_at: new Date().toISOString(),
  },
  {
    id: '3',
    email: 'landlord@example.com',
    role: 'landlord',
    created_at: new Date().toISOString(),
  },
];

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      // In a real app, we would use Supabase Auth
      // const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      // if (error) throw error;
      
      // For MVP, we'll simulate authentication
      const mockUser = mockUsers.find(user => user.email === email);
      if (!mockUser) {
        throw new Error('Invalid credentials');
      }
      
      // Simulate a delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      set({ user: mockUser as User, isLoading: false });
      localStorage.setItem('user', JSON.stringify(mockUser));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  register: async (email, password, role) => {
    set({ isLoading: true, error: null });
    try {
      // In a real app, we would use Supabase Auth
      // const { data, error } = await supabase.auth.signUp({ email, password });
      // if (error) throw error;
      
      // For MVP, we'll simulate registration
      const newUser = {
        id: String(mockUsers.length + 1),
        email,
        role,
        created_at: new Date().toISOString(),
      };
      
      // Simulate a delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      set({ user: newUser as User, isLoading: false });
      localStorage.setItem('user', JSON.stringify(newUser));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      // In a real app, we would use Supabase Auth
      // await supabase.auth.signOut();
      
      // For MVP, we'll just clear the local state
      localStorage.removeItem('user');
      set({ user: null, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      // In a real app, we would use Supabase Auth
      // const { data } = await supabase.auth.getSession();
      // const user = data.session?.user || null;
      
      // For MVP, we'll check localStorage
      const storedUser = localStorage.getItem('user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      
      set({ user: user as User | null, isLoading: false });
    } catch (error) {
      set({ user: null, isLoading: false });
    }
  },
}));