/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { Tables } from '../services/database.types';

interface AuthState {
	user: Tables<'users'> | null;
	session: any | null;
	loading: boolean;
	isLoading: boolean;
	error: string | null;
	activeTeam: Tables<'teams'> | null;

	// Actions
	login: (email: string, password: string) => Promise<Tables<'users'> | null>;
	loginWithMagicLink: (email: string) => Promise<void>;
	loginWithSocial: (provider: 'google' | 'facebook') => Promise<void>;
	register: (
		email: string,
		password: string,
		role: 'tenant' | 'agent' | 'landlord' | 'pending',
	) => Promise<{ user: any; profile: Tables<'users'> | null } | undefined>;
	signup: (
		email: string,
		password: string,
		userData: Partial<Tables<'users'>>,
	) => Promise<void>;
	logout: () => Promise<void>;
	resetPassword: (email: string) => Promise<void>;
	updateProfile: (
		updates: Partial<Tables<'users'>>,
	) => Promise<Tables<'users'>>; // Fixed return type
	getProfile: () => Promise<void>;
	checkAuth: () => Promise<void>;
	initialize: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
	user: null,
	session: null,
	loading: false,
	isLoading: false,
	error: null,
	activeTeam: null,

	login: async (email, password) => {
		try {
			set({ loading: true, isLoading: true, error: null });
			console.log('Auth store: login attempt started');

			const { data, error } = await supabase.auth.signInWithPassword({
				email,
				password,
			});

			if (error) throw error;
			console.log('Auth store: auth success, fetching profile');

			// Store session first
			set({ session: data.session });

			// Get user profile data
			const { data: profileData, error: profileError } = await supabase
				.from('users')
				.select('*')
				.eq('id', data.user.id)
				.single();

			if (profileError) {
				console.error('Error fetching profile:', profileError);
				throw new Error('Could not retrieve user profile');
			}

			console.log(
				'Auth store: profile fetched successfully:',
				profileData.role,
			);

			// Set the user in state
			set({ user: profileData });

			// Also store role in localStorage for convenience
			localStorage.setItem('userRole', profileData.role);

			// Persist state synchronously to minimize race conditions
			try {
				// Force localStorage to update synchronously
				localStorage.setItem(
					'auth-user-state',
					JSON.stringify({
						id: profileData.id,
						role: profileData.role,
					}),
				);
			} catch (e) {
				console.warn('Failed to persist state to localStorage', e);
			}

			console.log('Auth store: login complete, returning profile');
			return profileData; // Return the profile data for navigation
		} catch (error: any) {
			console.error('Login error:', error);
			set({ error: error.message });
			throw error; // Re-throw so the component can handle it
		} finally {
			set({ loading: false, isLoading: false });
		}
	},

	loginWithMagicLink: async (email) => {
		try {
			set({ loading: true, isLoading: true, error: null });
			const { error } = await supabase.auth.signInWithOtp({ email });

			if (error) throw error;

			set({ error: null });
		} catch (error: any) {
			set({ error: error.message });
		} finally {
			set({ loading: false, isLoading: false });
		}
	},

	loginWithSocial: async (provider) => {
		try {
			set({ loading: true, isLoading: true, error: null });

			// Configure the redirect URL with the correct path
			const redirectTo = `${window.location.origin}/auth/callback`;

			console.log('Starting social login with:', provider);
			console.log('Redirect URL:', redirectTo);

			// Save the provider to local storage for debugging
			localStorage.setItem('socialLoginProvider', provider);
			localStorage.setItem('socialLoginAttempt', Date.now().toString());

			// Configure provider-specific scopes
			const scopes =
				provider === 'google'
					? 'email profile'
					: provider === 'facebook'
					? 'email,public_profile'
					: 'email';

			const { error } = await supabase.auth.signInWithOAuth({
				provider,
				options: {
					redirectTo,
					scopes,
					queryParams:
						provider === 'google'
							? {
									access_type: 'offline',
									prompt: 'consent',
							  }
							: undefined,
				},
			});

			if (error) {
				console.error('OAuth initialization error:', error);
				throw error;
			}

			console.log('OAuth flow started, redirecting to provider');
			// The user will be redirected to the OAuth provider
		} catch (error: any) {
			console.error('Social login error:', error);
			set({ error: error.message });
			set({ loading: false, isLoading: false });
		}
	},

	signup: async (email, password, userData) => {
		try {
			set({ loading: true, isLoading: true, error: null });

			// 1. Create auth user
			const { data, error } = await supabase.auth.signUp({ email, password });

			if (error) throw error;

			// 2. Create profile
			if (data.user) {
				const { error: profileError } = await supabase.from('users').insert({
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
			set({ loading: false, isLoading: false });
		}
	},

	logout: async () => {
		try {
			set({ loading: true, isLoading: true, error: null });
			const { error } = await supabase.auth.signOut();

			if (error) throw error;

			set({ user: null, session: null, activeTeam: null });
		} catch (error: any) {
			set({ error: error.message });
		} finally {
			set({ loading: false, isLoading: false });
		}
	},

	resetPassword: async (email) => {
		try {
			set({ loading: true, isLoading: true, error: null });
			const { error } = await supabase.auth.resetPasswordForEmail(email);

			if (error) throw error;
		} catch (error: any) {
			set({ error: error.message });
		} finally {
			set({ loading: false, isLoading: false });
		}
	},

	updateProfile: async (updates) => {
		try {
			set({ loading: true, isLoading: true, error: null });
			const user = get().user;

			if (!user) throw new Error('User not authenticated');

			// Normalize and validate role
			const normalizedUpdates = { ...updates };
			if (updates.role) {
				const normalizedRole = updates.role.trim().toLowerCase();
				if (!['tenant', 'agent', 'landlord'].includes(normalizedRole)) {
					console.error(
						'Invalid role:',
						updates.role,
						'Normalized:',
						normalizedRole,
					);
					throw new Error('Invalid role. Must be tenant, agent, or landlord.');
				}
				normalizedUpdates.role = normalizedRole;
			}

			// Handle team context in updates
			if ('active_team_id' in updates) {
				// If switching teams, validate team membership
				if (updates.active_team_id) {
					const { data: membership, error: membershipError } = await supabase
						.from('team_members')
						.select('team:teams(*)')
						.eq('user_id', user.id)
						.eq('team_id', updates.active_team_id)
						.single();

					if (membershipError || !membership) {
						throw new Error('Not a member of the selected team');
					}

					// Set active team in state
					set({ activeTeam: membership.team } as any);
				} else {
					// Clearing team context
					set({ activeTeam: null });
				}
			}

			console.log('Updating profile with data:', normalizedUpdates);

			const { error } = await supabase
				.from('users')
				.update(normalizedUpdates)
				.eq('id', user.id);

			if (error) {
				console.error('Profile update error:', error);
				throw error;
			}

			// Update local user state
			const updatedUser = { ...user, ...updates };
			set({ user: updatedUser });

			// If role was updated, also update localStorage
			if (updates.role) {
				localStorage.setItem('userRole', updates.role);
			}

			return updatedUser; // Return the updated user profile
		} catch (error: any) {
			console.error('Profile update failed:', error);
			set({ error: error.message });
			throw error;
		} finally {
			set({ loading: false, isLoading: false });
		}
	},

	getProfile: async () => {
		try {
			set({ loading: true, isLoading: true, error: null });
			const { data: sessionData } = await supabase.auth.getSession();

			if (!sessionData.session) {
				set({ user: null, activeTeam: null });
				return;
			}

			const { data, error } = await supabase
				.from('users')
				.select(
					`
					*,
					team_members!team_members_user_id_fkey(
						team:teams(*)
					)
				`,
				)
				.eq('id', sessionData.session.user.id)
				.single();

			if (error) throw error;

			// Find active team if user has one set
			let activeTeam = null;
			if (data.active_team_id && data.team_members) {
				const teamMembership = data.team_members.find(
					(tm: any) => tm.team.id === data.active_team_id,
				);
				if (teamMembership) {
					activeTeam = teamMembership.team;
				}
			}

			set({ user: data, activeTeam });
		} catch (error: any) {
			set({ error: error.message, user: null, activeTeam: null });
		} finally {
			set({ loading: false, isLoading: false });
		}
	},

	checkAuth: async () => {
		try {
			set({ loading: true, isLoading: true, error: null });
			await get().getProfile();
		} catch (error: any) {
			set({ error: error.message });
		} finally {
			set({ loading: false, isLoading: false });
		}
	},

	register: async (email, password, role) => {
		try {
			set({ loading: true, isLoading: true, error: null });

			// Ensure email is valid before proceeding
			if (!email || typeof email !== 'string' || !email.includes('@')) {
				throw new Error('A valid email address is required');
			}

			// Allow 'pending' as a temporary role during initial registration
			const normalizedRole = role.trim().toLowerCase();
			if (
				!['tenant', 'agent', 'landlord', 'pending'].includes(normalizedRole)
			) {
				console.error('Invalid role:', role, 'Normalized:', normalizedRole);
				throw new Error(
					'Invalid role. Must be tenant, agent, landlord, or pending.',
				);
			}

			// Normalize email to ensure consistency
			const normalizedEmail = email.trim().toLowerCase();

			console.log(
				'Starting registration for:',
				normalizedEmail,
				'with temporary role:',
				normalizedRole,
			);

			// Create auth user with proper metadata to ensure profile creation works
			const { data, error } = await supabase.auth.signUp({
				email: normalizedEmail,
				password,
				options: {
					emailRedirectTo: `${window.location.origin}/auth/callback`,
					data: {
						email: normalizedEmail,
						role: normalizedRole,
						first_name: '',
						last_name: '',
					},
				},
			});

			if (error) {
				console.error('Auth signup error:', error);
				throw error;
			}

			// If no user object was returned, handle gracefully
			if (!data.user) {
				console.log('No user data returned, but no error occurred');
				throw new Error('User creation failed - no user data returned');
			}

			console.log('User created successfully with ID:', data.user.id);

			// Store session in the store
			set({ session: data.session });

			// Let Supabase's trigger handle profile creation
			// Wait a moment to ensure the profile has been created
			await new Promise((resolve) => setTimeout(resolve, 1200)); // Increased timeout

			// Fetch the newly created profile
			const { data: profileData, error: profileError } = await supabase
				.from('users')
				.select('*')
				.eq('id', data.user.id)
				.single();

			if (profileError) {
				console.error(
					'Error fetching profile after registration:',
					profileError,
				);
				// Check if the error is just that the profile wasn't found
				if (profileError.code === 'PGRST116') {
					// Try creating the profile manually as fallback
					console.log('Profile not found, creating manually');
					const { error: insertError } = await supabase.from('users').insert({
						id: data.user.id,
						email: normalizedEmail,
						first_name: '',
						last_name: '',
						role: normalizedRole,
					});

					if (insertError) {
						console.error('Manual profile creation failed:', insertError);
					} else {
						// Fetch again after manual creation
						const { data: newProfileData } = await supabase
							.from('users')
							.select('*')
							.eq('id', data.user.id)
							.single();

						set({ user: newProfileData || null });
						return { user: data.user, profile: newProfileData };
					}
				}
			} else {
				// Set the user in state
				set({ user: profileData });
			}

			// Store user role in localStorage for redirects
			localStorage.setItem('userRole', role);

			return { user: data.user, profile: profileData };
		} catch (error: any) {
			console.error('Registration error:', error);
			set({ error: error.message || 'Registration failed' });
			throw error; // Re-throw for component handling
		} finally {
			set({ loading: false, isLoading: false });
		}
	},

	initialize: async () => {
		try {
			set({ loading: true, isLoading: true, error: null });

			console.log('Initializing auth store...');

			// Get existing session if any
			const { data: sessionData, error: sessionError } =
				await supabase.auth.getSession();

			if (sessionError) {
				console.error('Session retrieval error:', sessionError);
				throw sessionError;
			}

			if (!sessionData.session) {
				console.log('No existing session found');
				set({ user: null, session: null, activeTeam: null });
				return false;
			}

			console.log('Existing session found');
			set({ session: sessionData.session });

			// Fetch the profile and team data for this session
			const { data: profileData, error: profileError } = await supabase
				.from('users')
				.select(
					`
					*,
					team_members!team_members_user_id_fkey(
						team:teams(*)
					)
				`,
				)
				.eq('id', sessionData.session.user.id)
				.single();

			if (profileError) {
				console.error(
					'Error fetching profile during initialization:',
					profileError,
				);
				return false;
			}

			// Find active team if user has one set
			let activeTeam = null;
			if (profileData.active_team_id && profileData.team_members) {
				const teamMembership = profileData.team_members.find(
					(tm: any) => tm.team.id === profileData.active_team_id,
				);
				if (teamMembership) {
					activeTeam = teamMembership.team;
				}
			}

			set({ user: profileData, activeTeam });
			console.log('Auth initialization complete');
			return true;
		} catch (error: any) {
			console.error('Auth initialization error:', error);
			set({
				error: error.message,
				user: null,
				session: null,
				activeTeam: null,
			});
			return false;
		} finally {
			set({ loading: false, isLoading: false });
		}
	},
}));
