/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { Tables } from '../services/database.types';

interface AuthState {
	user: Tables<'profiles'> | null;
	session: any | null;
	loading: boolean;
	error: string | null;

	// Actions
	login: (email: string, password: string) => Promise<void>;
	loginWithMagicLink: (email: string) => Promise<void>;
	signup: (
		email: string,
		password: string,
		userData: Partial<Tables<'profiles'>>,
	) => Promise<void>;
	logout: () => Promise<void>;
	resetPassword: (email: string) => Promise<void>;
	updateProfile: (updates: Partial<Tables<'profiles'>>) => Promise<void>;
	getProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
	user: null,
	session: null,
	loading: false,
	error: null,

	login: async (email, password) => {
		try {
			set({ loading: true, error: null });
			const { data, error } = await supabase.auth.signInWithPassword({
				email,
				password,
			});

			if (error) throw error;

			set({ session: data.session });
			await get().getProfile();
		} catch (error: any) {
			set({ error: error.message });
		} finally {
			set({ loading: false });
		}
	},

	loginWithMagicLink: async (email) => {
		try {
			set({ loading: true, error: null });
			const { error } = await supabase.auth.signInWithOtp({ email });

			if (error) throw error;

			set({ error: null });
		} catch (error: any) {
			set({ error: error.message });
		} finally {
			set({ loading: false });
		}
	},

	signup: async (email, password, userData) => {
		try {
			set({ loading: true, error: null });

			// 1. Create auth user
			const { data, error } = await supabase.auth.signUp({ email, password });

			if (error) throw error;

			// 2. Create profile
			if (data.user) {
				const { error: profileError } = await supabase.from('profiles').insert({
					id: data.user.id,
					email,
					first_name: userData.first_name || '',
					last_name: userData.last_name || '',
					role: userData.role || 'agent',
					phone: userData.phone || null,
					company_name: userData.company_name || null,
				});

				if (profileError) throw profileError;
			}

			set({ session: data.session });
			await get().getProfile();
		} catch (error: any) {
			set({ error: error.message });
		} finally {
			set({ loading: false });
		}
	},

	logout: async () => {
		try {
			set({ loading: true, error: null });
			const { error } = await supabase.auth.signOut();

			if (error) throw error;

			set({ user: null, session: null });
		} catch (error: any) {
			set({ error: error.message });
		} finally {
			set({ loading: false });
		}
	},

	resetPassword: async (email) => {
		try {
			set({ loading: true, error: null });
			const { error } = await supabase.auth.resetPasswordForEmail(email);

			if (error) throw error;
		} catch (error: any) {
			set({ error: error.message });
		} finally {
			set({ loading: false });
		}
	},

	updateProfile: async (updates) => {
		try {
			set({ loading: true, error: null });
			const user = get().user;

			if (!user) throw new Error('User not authenticated');

			const { error } = await supabase
				.from('profiles')
				.update(updates)
				.eq('id', user.id);

			if (error) throw error;

			set({ user: { ...user, ...updates } });
		} catch (error: any) {
			set({ error: error.message });
		} finally {
			set({ loading: false });
		}
	},

	getProfile: async () => {
		try {
			set({ loading: true, error: null });
			const { data: sessionData } = await supabase.auth.getSession();

			if (!sessionData.session) {
				set({ user: null });
				return;
			}

			const { data, error } = await supabase
				.from('profiles')
				.select('*')
				.eq('id', sessionData.session.user.id)
				.single();

			if (error) throw error;

			set({ user: data });
		} catch (error: any) {
			set({ error: error.message, user: null });
		} finally {
			set({ loading: false });
		}
	},
}));
