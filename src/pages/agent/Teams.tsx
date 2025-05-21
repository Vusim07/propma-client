/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect } from 'react';
import { useTeamStore } from '@/stores/teamStore';
import { useAuthStore } from '@/stores/authStore';
import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
	Form,
	FormField,
	FormItem,
	FormLabel,
	FormControl,
	FormMessage,
} from '@/components/ui/form';
import Spinner from '@/components/ui/Spinner';
import { AlertCircle } from 'lucide-react';
import { TeamStatsCard } from '@/components/teams/TeamStatsCard';
import { useNavigate, useLocation } from 'react-router-dom';

const createTeamSchema = z.object({
	name: z.string().min(1, 'Team name is required'),
	planType: z.enum(['starter', 'growth', 'scale', 'enterprise']),
});

const inviteMemberSchema = z.object({
	email: z.string().email('Invalid email address'),
	role: z.enum(['admin', 'member']),
});

type CreateTeamValues = z.infer<typeof createTeamSchema>;
type InviteMemberValues = z.infer<typeof inviteMemberSchema>;

const Teams: React.FC = () => {
	const {
		teams,
		currentTeam,
		members,
		invitations,
		isLoading,
		teamStats,
		fetchTeams,
		createTeam,
		fetchTeamMembers,
		fetchInvitations,
		inviteMember,
		removeMember,
		updateMemberRole,
		switchTeam,
		cancelInvitation,
		refreshTeamData,
	} = useTeamStore();

	const { user } = useAuthStore();
	const navigate = useNavigate();
	const location = useLocation();
	const [isCreateOpen, setIsCreateOpen] = React.useState(false);
	const [isInviteOpen, setIsInviteOpen] = React.useState(false);
	const [isRefreshing, setIsRefreshing] = React.useState(false);

	// Initial data fetch - this is the ONLY data fetch that happens automatically
	useEffect(() => {
		const fetchInitialData = async () => {
			await fetchTeams();
			// If we have a current team after fetching teams, refresh its data
			if (currentTeam?.id) {
				await refreshTeamsData();
			}
		};

		fetchInitialData();
	}, [fetchTeams]);

	// Check if we just came from the billing tab
	useEffect(() => {
		const fromBilling = location.state?.fromBilling === true;
		if (fromBilling && currentTeam?.id) {
			window.history.replaceState({}, document.title);
			refreshTeamsData();
		}
	}, [location.state, currentTeam]);

	useEffect(() => {
		if (currentTeam?.id) {
			fetchTeamMembers(currentTeam.id);
			fetchInvitations(currentTeam.id);
		}
	}, [currentTeam?.id, fetchTeamMembers, fetchInvitations]);

	// Function to manually refresh team data
	const refreshTeamsData = React.useCallback(async () => {
		// Use a local loading state to prevent multiple refreshes
		if (isLoading || isRefreshing) return;

		try {
			setIsRefreshing(true);

			// Fetch all teams first
			await fetchTeams();

			// If we have a current team, refresh its data and also members/invitations
			if (currentTeam?.id) {
				try {
					// Run these operations in parallel
					await Promise.all([
						refreshTeamData(currentTeam.id),
						fetchTeamMembers(currentTeam.id),
						fetchInvitations(currentTeam.id),
					]);
				} catch (err) {
					console.error(
						`Error refreshing current team ${currentTeam.id}:`,
						err,
					);
				}
			}

			if (teams.length > 0) {
				// Process teams one at a time to avoid overwhelming the server
				for (const team of teams) {
					try {
						await refreshTeamData(team.id);
					} catch (err) {
						console.error(`Error refreshing team ${team.id}:`, err);
					}
				}
			}
		} catch (error) {
			console.error('Error in main refresh process:', error);
		} finally {
			setIsRefreshing(false);
		}
	}, [
		fetchTeams,
		fetchTeamMembers,
		fetchInvitations,
		refreshTeamData,
		currentTeam,
		teams,
		isLoading,
		isRefreshing,
	]);

	const handleCreateTeam = async (values: CreateTeamValues) => {
		const team = await createTeam(values.name, values.planType);
		if (team) {
			setIsCreateOpen(false);
			createTeamForm.reset();
			refreshTeamsData();
		}
	};

	const handleInviteMember = async (values: InviteMemberValues) => {
		if (currentTeam?.id) {
			await inviteMember(currentTeam.id, values.email, values.role);
			setIsInviteOpen(false);
			inviteMemberForm.reset();
			await fetchInvitations(currentTeam.id);
		}
	};

	// Handler for activating a team plan
	const handleActivatePlan = async (teamId: string) => {
		await switchTeam(teamId);
		navigate('/agent/settings', { state: { activeTab: 'billing' } });
	};

	const createTeamForm = useForm<CreateTeamValues>({
		resolver: zodResolver(createTeamSchema),
		defaultValues: {
			name: '',
			planType: 'starter',
		},
	});

	const inviteMemberForm = useForm<InviteMemberValues>({
		resolver: zodResolver(inviteMemberSchema),
		defaultValues: {
			email: '',
			role: 'member',
		},
	});

	if (isLoading && teams.length === 0) {
		return (
			<div className='flex items-center justify-center min-h-screen'>
				<Spinner size='lg' />
			</div>
		);
	}

	return (
		<div className='container mx-auto py-6 space-y-6'>
			<div className='flex justify-between items-center'>
				<Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
					<DialogTrigger asChild>
						<Button>Create Team</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Create a New Team</DialogTitle>
							<DialogDescription>
								Create a team to collaborate with other agents and manage
								properties together.
							</DialogDescription>
						</DialogHeader>
						<Form {...createTeamForm}>
							<form
								onSubmit={createTeamForm.handleSubmit(handleCreateTeam)}
								className='space-y-4'
							>
								<FormField
									control={createTeamForm.control}
									name='name'
									render={({ field }) => (
										<FormItem>
											<FormLabel>Team Name</FormLabel>
											<FormControl>
												<Input placeholder='Enter team name' {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={createTeamForm.control}
									name='planType'
									render={({ field }) => (
										<FormItem>
											<FormLabel>Plan Type</FormLabel>
											<Select
												onValueChange={field.onChange}
												defaultValue={field.value}
											>
												<FormControl>
													<SelectTrigger>
														<SelectValue placeholder='Select a plan' />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													<SelectItem value='starter'>
														Starter (3 members)
													</SelectItem>
													<SelectItem value='growth'>
														Growth (10 members)
													</SelectItem>
													<SelectItem value='scale'>
														Scale (25 members)
													</SelectItem>
													<SelectItem value='enterprise'>
														Enterprise (Custom)
													</SelectItem>
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>
								<DialogFooter>
									<Button type='submit' isLoading={isLoading}>
										Create Team
									</Button>
								</DialogFooter>
							</form>
						</Form>
					</DialogContent>
				</Dialog>
			</div>

			<div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
				{teams.map((team) => (
					<div key={team.id} className='space-y-4'>
						<TeamStatsCard
							team={team}
							memberCount={teamStats[team.id]?.member_count || 0}
							pendingInvites={teamStats[team.id]?.pending_invites || 0}
						/>
						<div className='flex justify-end gap-2'>
							<Button
								variant={currentTeam?.id === team.id ? 'outline' : 'primary'}
								onClick={() =>
									switchTeam(currentTeam?.id === team.id ? null : team.id)
								}
							>
								{currentTeam?.id === team.id ? 'Active' : 'Switch'}
							</Button>
							{!team.subscription?.status && (
								<Button
									variant='primary'
									className='bg-green-600 hover:bg-green-700'
									onClick={() => handleActivatePlan(team.id)}
								>
									Activate Plan
								</Button>
							)}
							{team.subscription?.status === 'active' &&
								teamStats[team.id]?.member_count +
									teamStats[team.id]?.pending_invites >=
									team.max_members && (
									<Button
										variant='outline'
										className='text-blue-600 border-blue-600 hover:bg-blue-50'
										onClick={() => handleActivatePlan(team.id)}
									>
										Upgrade Plan
									</Button>
								)}
						</div>
					</div>
				))}
			</div>

			{currentTeam && (
				<>
					<div className='flex justify-between items-center pt-8'>
						<h2 className='text-xl font-semibold'>Team Members</h2>
						<Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
							<DialogTrigger asChild>
								<Button
									disabled={
										members.length + invitations.length >=
										(currentTeam.max_members || 0)
									}
								>
									Invite Member
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Invite Team Member</DialogTitle>
									<DialogDescription>
										{members.length + invitations.length >=
										(currentTeam.max_members || 0) ? (
											<div className='text-yellow-600 flex items-center gap-2 mt-2'>
												<AlertCircle className='h-5 w-5' />
												Your team has reached its member limit. Upgrade your
												plan to add more members.
											</div>
										) : (
											<>Invite a new member to join your team.</>
										)}
									</DialogDescription>
								</DialogHeader>
								<Form {...inviteMemberForm}>
									<form
										onSubmit={inviteMemberForm.handleSubmit(handleInviteMember)}
										className='space-y-4'
									>
										<FormField
											control={inviteMemberForm.control}
											name='email'
											render={({ field }) => (
												<FormItem>
													<FormLabel>Email Address</FormLabel>
													<FormControl>
														<Input
															type='email'
															placeholder='Enter email'
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={inviteMemberForm.control}
											name='role'
											render={({ field }) => (
												<FormItem>
													<FormLabel>Role</FormLabel>
													<Select
														onValueChange={field.onChange}
														defaultValue={field.value}
													>
														<FormControl>
															<SelectTrigger>
																<SelectValue placeholder='Select a role' />
															</SelectTrigger>
														</FormControl>
														<SelectContent>
															<SelectItem value='member'>Member</SelectItem>
															<SelectItem value='admin'>Admin</SelectItem>
														</SelectContent>
													</Select>
													<FormMessage />
												</FormItem>
											)}
										/>
										<DialogFooter>
											<Button type='submit' isLoading={isLoading}>
												Send Invitation
											</Button>
										</DialogFooter>
									</form>
								</Form>
							</DialogContent>
						</Dialog>
					</div>

					<div className='space-y-4'>
						{members.map((member: any) => (
							<Card key={member.user_id}>
								<CardContent className='flex justify-between items-center p-4'>
									<div>
										<p className='font-medium'>
											{member.users?.first_name} {member.users?.last_name}
										</p>
										<p className='text-sm text-gray-500'>
											{member.users?.email}
										</p>
									</div>
									<div className='flex items-center gap-4'>
										{member.user_id !== user?.id && (
											<>
												<Select
													defaultValue={member.role}
													onValueChange={(value) =>
														updateMemberRole(
															currentTeam.id,
															member.user_id,
															value as 'admin' | 'member',
														)
													}
												>
													<SelectTrigger className='w-[100px]'>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value='member'>Member</SelectItem>
														<SelectItem value='admin'>Admin</SelectItem>
													</SelectContent>
												</Select>
												<Button
													variant='danger'
													onClick={() =>
														removeMember(currentTeam.id, member.user_id)
													}
												>
													Remove
												</Button>
											</>
										)}
									</div>
								</CardContent>
							</Card>
						))}

						{invitations.length > 0 && (
							<div className='mt-8'>
								<h3 className='text-lg font-semibold mb-4'>
									Pending Invitations
								</h3>
								{invitations.map((invitation) => (
									<Card key={invitation.id}>
										<CardContent className='flex justify-between items-center p-4'>
											<div>
												<p className='font-medium'>{invitation.email}</p>
												<p className='text-sm text-gray-500'>
													Invited as {invitation.role} • Expires{' '}
													{new Date(invitation.expires_at).toLocaleDateString()}
												</p>
											</div>
											<Button
												variant='outline'
												onClick={() => cancelInvitation(invitation.id)}
											>
												Cancel
											</Button>
										</CardContent>
									</Card>
								))}
							</div>
						)}
					</div>
				</>
			)}
		</div>
	);
};

export default Teams;
