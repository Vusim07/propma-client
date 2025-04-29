import { create } from 'zustand';
import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { Team, TeamMember, TeamInvitation } from '../types';
import { showToast } from '../utils/toast';

interface TeamState {
	currentTeam: Team | null;
	teams: Team[];
	members: TeamMember[];
	invitations: TeamInvitation[];
	isLoading: boolean;
	error: string | null;
}

interface TeamActions {
	// Team management
	fetchTeams: () => Promise<void>;
	createTeam: (name: string, planType: string) => Promise<Team | null>;
	updateTeam: (id: string, updates: Partial<Team>) => Promise<void>;
	deleteTeam: (id: string) => Promise<void>;

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
}

type TeamStore = TeamState & TeamActions;

export const useTeamStore = create<TeamStore>((set, get) => ({
	currentTeam: null,
	teams: [],
	members: [],
	invitations: [],
	isLoading: false,
	error: null,

	fetchTeams: async () => {
		set({ isLoading: true, error: null });
		try {
			const { data: teams, error } = await supabase
				.from('teams')
				.select('*')
				.order('name');

			if (error) throw error;
			set({ teams: (teams as Team[]) || [] });
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
			const { data: team, error } = await supabase
				.from('teams')
				.insert({
					name,
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
					user_id: (await supabase.auth.getUser()).data.user?.id,
					role: 'admin',
				});

			if (memberError) throw memberError;

			set((state) => ({ teams: [...state.teams, team as Team] }));
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
			// First check if team has reached member limit
			const team = get().teams.find((t) => t.id === teamId);
			if (!team) throw new Error('Team not found');

			const { count } = await supabase
				.from('team_members')
				.select('*', { count: 'exact' })
				.eq('team_id', teamId);

			if (count && count >= team.max_members) {
				throw new Error('Team member limit reached');
			}

			const { error } = await supabase.from('team_invitations').insert({
				team_id: teamId,
				email,
				role,
				token: crypto.randomUUID(),
				expires_at: new Date(
					Date.now() + 7 * 24 * 60 * 60 * 1000,
				).toISOString(), // 7 days
				created_by: (await supabase.auth.getUser()).data.user?.id,
			});

			if (error) throw error;
			showToast.success('Invitation sent successfully');
		} catch (error) {
			const pgError = error as PostgrestError;
			set({ error: pgError.message });
			showToast.error(pgError.message || 'Failed to send invitation');
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

			showToast.success('Team member removed successfully');
		} catch (error) {
			const pgError = error as PostgrestError;
			set({ error: pgError.message });
			showToast.error('Failed to remove team member');
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
			const pgError = error as PostgrestError;
			set({ error: pgError.message });
			showToast.error('Failed to update member role');
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
			const pgError = error as PostgrestError;
			set({ error: pgError.message });
			showToast.error('Failed to switch team');
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
			const pgError = error as PostgrestError;
			set({ error: pgError.message });
			showToast.error(pgError.message || 'Failed to accept invitation');
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

			set((state) => ({
				invitations: state.invitations.filter((inv) => inv.id !== invitationId),
			}));

			showToast.success('Invitation cancelled successfully');
		} catch (error) {
			const pgError = error as PostgrestError;
			set({ error: pgError.message });
			showToast.error('Failed to cancel invitation');
		} finally {
			set({ isLoading: false });
		}
	},
}));
