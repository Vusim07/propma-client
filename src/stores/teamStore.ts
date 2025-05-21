import { create } from 'zustand';
import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { Team, TeamMember, TeamInvitation } from '../types';
import { showToast } from '../utils/toast';

interface TeamStats {
	member_count: number;
	pending_invites: number;
	last_updated: string;
}

interface TeamState {
	currentTeam: Team | null;
	teams: Team[];
	members: TeamMember[];
	invitations: TeamInvitation[];
	isLoading: boolean;
	error: string | null;
	teamStats: Record<string, TeamStats>;
}

interface TeamActions {
	// Team management
	fetchTeams: () => Promise<void>;
	createTeam: (name: string, planType: string) => Promise<Team | null>;
	updateTeam: (id: string, updates: Partial<Team>) => Promise<void>;
	deleteTeam: (id: string) => Promise<void>;
	refreshTeamData: (teamId: string) => Promise<Team | null>;

	// Team member management
	fetchTeamMembers: (teamId: string) => Promise<void>;
	inviteMember: (
		teamId: string,
		email: string,
		role: 'admin' | 'member',
	) => Promise<void>;
	removeMember: (teamId: string, userId: string) => Promise<void>;
	updateMemberRole: (
		teamId: string,
		userId: string,
		role: 'admin' | 'member',
	) => Promise<void>;

	// Team switching
	switchTeam: (teamId: string | null) => Promise<void>;

	// Invitation management
	fetchInvitations: (teamId: string) => Promise<void>;
	acceptInvitation: (token: string) => Promise<void>;
	cancelInvitation: (invitationId: string) => Promise<void>;

	// Member count management
	refreshMemberCounts: (teamId: string) => Promise<void>;
	fetchTeamStats: (teamId: string) => Promise<void>;
}

type TeamStore = TeamState & TeamActions;

export const useTeamStore = create<TeamStore>((set, get) => ({
	currentTeam: null,
	teams: [],
	members: [],
	invitations: [],
	isLoading: false,
	error: null,
	teamStats: {},

	fetchTeams: async () => {
		set({ isLoading: true, error: null });
		try {
			const { data: teams, error } = await supabase.from('teams').select(`
				*,
				subscription:subscription_id (
					id,
					plan_name,
					status,
					usage_limit,
					current_usage
				),
				stats:team_stats (
					member_count,
					pending_invites,
					last_updated
				)
			`);

			if (error) throw error;

			// Build teamStats record for all teams
			const teamStats: Record<string, TeamStats> = {};
			const teamsWithStats = (teams || []).map((team) => {
				const stats = team.stats || {
					member_count: 0,
					pending_invites: 0,
					last_updated: '',
				};
				teamStats[team.id] = stats;
				delete team.stats;
				return team;
			});

			// Also fetch the active team ID from the user record for onboarding
			const userId = (await supabase.auth.getUser()).data.user?.id;
			if (userId) {
				const { data: userData } = await supabase
					.from('users')
					.select('active_team_id')
					.eq('id', userId)
					.single();

				if (userData?.active_team_id) {
					const activeTeam = teamsWithStats.find(
						(team) => team.id === userData.active_team_id,
					);
					if (activeTeam) {
						set({ currentTeam: activeTeam });
					}
				}
			}

			set({ teams: teamsWithStats, teamStats });
		} catch (error) {
			const pgError = error as PostgrestError;
			set({ error: pgError.message });
			showToast.error('Failed to fetch teams');
		} finally {
			set({ isLoading: false });
		}
	},

	createTeam: async (name: string, planType: string) => {
		set({ isLoading: true, error: null });
		try {
			const userId = (await supabase.auth.getUser()).data.user?.id;
			if (!userId) throw new Error('No authenticated user');

			// First create the team
			const { data: team, error } = await supabase
				.from('teams')
				.insert({
					name,
					created_by: userId,
					plan_type: planType,
					max_members:
						planType === 'starter' ? 3 : planType === 'growth' ? 10 : 25,
				})
				.select()
				.single();

			if (error) throw error;

			// Add creator as admin
			const { error: memberError } = await supabase
				.from('team_members')
				.insert({
					team_id: team.id,
					user_id: userId,
					role: 'admin',
				});

			if (memberError) throw memberError;

			// Set as active team for the user
			const { error: activeTeamError } = await supabase
				.from('users')
				.update({ active_team_id: team.id })
				.eq('id', userId);

			if (activeTeamError) throw activeTeamError;

			// Update store state
			set((state) => ({
				teams: [...state.teams, team as Team],
				currentTeam: team as Team,
			}));

			// Refresh the session to update JWT claims
			await supabase.auth.refreshSession();

			showToast.success('Team created successfully');
			return team as Team;
		} catch (error) {
			const pgError = error as PostgrestError;
			set({ error: pgError.message });
			showToast.error('Failed to create team');
			return null;
		} finally {
			set({ isLoading: false });
		}
	},

	updateTeam: async (id: string, updates: Partial<Team>) => {
		set({ isLoading: true, error: null });
		try {
			const { error } = await supabase
				.from('teams')
				.update(updates)
				.eq('id', id);

			if (error) throw error;

			set((state) => ({
				teams: state.teams.map((team) =>
					team.id === id ? { ...team, ...updates } : team,
				),
				currentTeam:
					state.currentTeam?.id === id
						? { ...state.currentTeam, ...updates }
						: state.currentTeam,
			}));

			showToast.success('Team updated successfully');
		} catch (error) {
			const pgError = error as PostgrestError;
			set({ error: pgError.message });
			showToast.error('Failed to update team');
		} finally {
			set({ isLoading: false });
		}
	},

	deleteTeam: async (id: string) => {
		set({ isLoading: true, error: null });
		try {
			const { error } = await supabase.from('teams').delete().eq('id', id);

			if (error) throw error;

			set((state) => ({
				teams: state.teams.filter((team) => team.id !== id),
				currentTeam: state.currentTeam?.id === id ? null : state.currentTeam,
			}));

			showToast.success('Team deleted successfully');
		} catch (error) {
			const pgError = error as PostgrestError;
			set({ error: pgError.message });
			showToast.error('Failed to delete team');
		} finally {
			set({ isLoading: false });
		}
	},

	fetchTeamMembers: async (teamId: string) => {
		set({ isLoading: true, error: null });
		try {
			const { data: members, error } = await supabase
				.from('team_members')
				.select('*, users:user_id(*)')
				.eq('team_id', teamId);

			if (error) throw error;
			set({ members: (members as TeamMember[]) || [] });
		} catch (error) {
			const pgError = error as PostgrestError;
			set({ error: pgError.message });
			showToast.error('Failed to fetch team members');
		} finally {
			set({ isLoading: false });
		}
	},

	inviteMember: async (
		teamId: string,
		email: string,
		role: 'admin' | 'member',
	) => {
		set({ isLoading: true, error: null });
		try {
			const team = get().teams.find((t) => t.id === teamId);
			const stats = get().teamStats[teamId];

			if (!team) throw new Error('Team not found');
			if (team.subscription?.status !== 'active') {
				throw new Error('Team does not have an active subscription');
			}

			const totalMembers =
				(stats?.member_count || 0) + (stats?.pending_invites || 0);
			if (totalMembers >= team.max_members) {
				throw new Error(
					`Team member limit reached (${team.max_members} members). Upgrade your plan to add more members.`,
				);
			}

			const response = await fetch(
				`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/team-invitations/send`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${
							(
								await supabase.auth.getSession()
							).data.session?.access_token
						}`,
					},
					body: JSON.stringify({
						teamId,
						email,
						role,
					}),
				},
			);

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to send invitation');
			}

			// Refresh team stats after successful invitation
			await get().fetchTeamStats(teamId);

			showToast.success('Invitation sent successfully');
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'An unknown error occurred';
			set({ error: message });
			showToast.error(message || 'Operation failed');
		} finally {
			set({ isLoading: false });
		}
	},

	removeMember: async (teamId: string, userId: string) => {
		set({ isLoading: true, error: null });
		try {
			const { error } = await supabase
				.from('team_members')
				.delete()
				.eq('team_id', teamId)
				.eq('user_id', userId);

			if (error) throw error;

			set((state) => ({
				members: state.members.filter(
					(member) => !(member.team_id === teamId && member.user_id === userId),
				),
			}));

			// Refresh team stats after removal
			await get().fetchTeamStats(teamId);

			showToast.success('Team member removed successfully');
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'An unknown error occurred';
			set({ error: message });
			showToast.error(message || 'Operation failed');
		} finally {
			set({ isLoading: false });
		}
	},

	updateMemberRole: async (
		teamId: string,
		userId: string,
		role: 'admin' | 'member',
	) => {
		set({ isLoading: true, error: null });
		try {
			const { error } = await supabase
				.from('team_members')
				.update({ role })
				.eq('team_id', teamId)
				.eq('user_id', userId);

			if (error) throw error;

			set((state) => ({
				members: state.members.map((member) =>
					member.team_id === teamId && member.user_id === userId
						? { ...member, role }
						: member,
				),
			}));

			showToast.success('Member role updated successfully');
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'An unknown error occurred';
			set({ error: message });
			showToast.error(message || 'Operation failed');
		} finally {
			set({ isLoading: false });
		}
	},

	switchTeam: async (teamId: string | null) => {
		set({ isLoading: true, error: null });
		try {
			const { error } = await supabase
				.from('users')
				.update({ active_team_id: teamId })
				.eq('id', (await supabase.auth.getUser()).data.user?.id);

			if (error) throw error;

			const newCurrentTeam = teamId
				? get().teams.find((team) => team.id === teamId) || null
				: null;

			set({ currentTeam: newCurrentTeam });

			// Refresh the session to update JWT claims
			await supabase.auth.refreshSession();

			showToast.success(
				teamId
					? `Switched to team: ${newCurrentTeam?.name}`
					: 'Switched to individual mode',
			);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'An unknown error occurred';
			set({ error: message });
			showToast.error(message || 'Operation failed');
		} finally {
			set({ isLoading: false });
		}
	},

	fetchInvitations: async (teamId: string) => {
		set({ isLoading: true, error: null });
		try {
			const { data: invitations, error } = await supabase
				.from('team_invitations')
				.select('*')
				.eq('team_id', teamId)
				.eq('status', 'pending');

			if (error) throw error;
			set({ invitations: (invitations as TeamInvitation[]) || [] });
		} catch (error) {
			const pgError = error as PostgrestError;
			set({ error: pgError.message });
			showToast.error('Failed to fetch invitations');
		} finally {
			set({ isLoading: false });
		}
	},

	acceptInvitation: async (token: string) => {
		set({ isLoading: true, error: null });
		try {
			// First get the invitation
			const { data: invitation, error: fetchError } = await supabase
				.from('team_invitations')
				.select('*')
				.eq('token', token)
				.single();

			if (fetchError) throw fetchError;
			if (!invitation) throw new Error('Invitation not found');

			// Check if expired
			if (new Date(invitation.expires_at) < new Date()) {
				throw new Error('Invitation has expired');
			}

			const userId = (await supabase.auth.getUser()).data.user?.id;
			if (!userId) throw new Error('No authenticated user');

			// Add user to team
			const { error: memberError } = await supabase
				.from('team_members')
				.insert({
					team_id: invitation.team_id,
					user_id: userId,
					role: invitation.role,
				});

			if (memberError) throw memberError;

			// Update invitation status
			const { error: updateError } = await supabase
				.from('team_invitations')
				.update({ status: 'accepted' })
				.eq('id', invitation.id);

			if (updateError) throw updateError;

			// Switch to the new team
			await get().switchTeam(invitation.team_id);

			showToast.success('Successfully joined team');
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'An unknown error occurred';
			set({ error: message });
			showToast.error(message || 'Operation failed');
		} finally {
			set({ isLoading: false });
		}
	},

	cancelInvitation: async (invitationId: string) => {
		set({ isLoading: true, error: null });
		try {
			const { error } = await supabase
				.from('team_invitations')
				.update({ status: 'cancelled' })
				.eq('id', invitationId);

			if (error) throw error;

			const invitation = get().invitations.find(
				(inv) => inv.id === invitationId,
			);
			if (invitation?.team_id) {
				await get().fetchTeamStats(invitation.team_id);
			}

			set((state) => ({
				invitations: state.invitations.filter((inv) => inv.id !== invitationId),
			}));

			showToast.success('Invitation cancelled successfully');
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'An unknown error occurred';
			set({ error: message });
			showToast.error(message || 'Operation failed');
		} finally {
			set({ isLoading: false });
		}
	},

	refreshMemberCounts: async (teamId: string) => {
		try {
			const [membersResult, invitationsResult] = await Promise.all([
				supabase
					.from('team_members')
					.select('*', { count: 'exact' })
					.eq('team_id', teamId),
				supabase
					.from('team_invitations')
					.select('*', { count: 'exact' })
					.eq('team_id', teamId)
					.eq('status', 'pending'),
			]);

			set((state) => ({
				teamStats: {
					...state.teamStats,
					[teamId]: {
						...state.teamStats[teamId],
						member_count: membersResult.count || 0,
						pending_invites: invitationsResult.count || 0,
						last_updated: new Date().toISOString(),
					},
				},
			}));
		} catch (error) {
			console.error('Error refreshing member counts:', error);
		}
	},

	fetchTeamStats: async (teamId: string) => {
		try {
			const { data: stats, error } = await supabase
				.from('team_stats')
				.select('*')
				.eq('team_id', teamId)
				.single();

			if (error) throw error;

			set((state) => ({
				teamStats: {
					...state.teamStats,
					[teamId]: stats,
				},
			}));
		} catch (error) {
			console.error('Error fetching team stats:', error);
		}
	},

	refreshTeamData: async (teamId: string) => {
		set({ isLoading: true, error: null });
		try {
			// Fetch the specific team with its subscription data
			const { data: team, error } = await supabase
				.from('teams')
				.select(
					`
					*,
					subscription:subscription_id (
						id,
						plan_name,
						status,
						usage_limit,
						current_usage
					)
				`,
				)
				.eq('id', teamId)
				.single();

			if (error) {
				console.error(`Error fetching team ${teamId}:`, error);
				throw error;
			}

			// Also refresh team stats
			await get().fetchTeamStats(teamId);

			// Ensure we're properly updating the state - create a deep copy of the team
			const updatedTeam = { ...team };

			// Update the team in the state with proper subscription data
			set((state) => {
				// Create a new teams array with the updated team
				const updatedTeams = state.teams.map((t) =>
					t.id === teamId ? { ...t, ...updatedTeam } : t,
				);

				// Also update currentTeam if this is the active team
				const updatedCurrentTeam =
					state.currentTeam?.id === teamId
						? { ...state.currentTeam, ...updatedTeam }
						: state.currentTeam;

				return {
					teams: updatedTeams,
					currentTeam: updatedCurrentTeam,
				};
			});

			return team as Team;
		} catch (error) {
			const pgError = error as PostgrestError;
			console.error(`Error refreshing team ${teamId}:`, pgError);
			set({ error: pgError.message });
			return null;
		} finally {
			set({ isLoading: false });
		}
	},
}));
