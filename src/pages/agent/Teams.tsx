/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect } from 'react';
import { useTeamStore } from '../../stores/teamStore';
import { useAuthStore } from '../../stores/authStore';
import Button from '../../components/ui/Button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '../../components/ui/Card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/Input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '../../components/ui/Select';
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
} from '../../components/ui/form';
import Spinner from '../../components/ui/Spinner';

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
		fetchTeams,
		createTeam,
		fetchTeamMembers,
		fetchInvitations,
		inviteMember,
		removeMember,
		updateMemberRole,
		switchTeam,
		cancelInvitation,
	} = useTeamStore();

	const { user } = useAuthStore();
	const [isCreateOpen, setIsCreateOpen] = React.useState(false);
	const [isInviteOpen, setIsInviteOpen] = React.useState(false);

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

	useEffect(() => {
		fetchTeams();
	}, [fetchTeams]);

	useEffect(() => {
		if (currentTeam?.id) {
			fetchTeamMembers(currentTeam.id);
			fetchInvitations(currentTeam.id);
		}
	}, [currentTeam?.id, fetchTeamMembers, fetchInvitations]);

	const onCreateTeam = async (values: CreateTeamValues) => {
		const team = await createTeam(values.name, values.planType);
		if (team) {
			setIsCreateOpen(false);
			createTeamForm.reset();
		}
	};

	const onInviteMember = async (values: InviteMemberValues) => {
		if (currentTeam?.id) {
			await inviteMember(currentTeam.id, values.email, values.role);
			setIsInviteOpen(false);
			inviteMemberForm.reset();
			// Refresh invitations list
			fetchInvitations(currentTeam.id);
		}
	};

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
				<h1 className='text-2xl font-bold'>Teams</h1>
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
								onSubmit={createTeamForm.handleSubmit(onCreateTeam)}
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

			<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
				{teams.map((team) => (
					<Card
						key={team.id}
						className={currentTeam?.id === team.id ? 'border-primary' : ''}
					>
						<CardHeader>
							<CardTitle>{team.name}</CardTitle>
							<CardDescription>
								{team.plan_type.charAt(0).toUpperCase() +
									team.plan_type.slice(1)}{' '}
								Plan
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className='space-y-4'>
								<div className='flex justify-between items-center'>
									<span>
										{members.length} / {team.max_members} members
									</span>
									<Button
										variant={
											currentTeam?.id === team.id ? 'outline' : 'primary'
										}
										onClick={() =>
											switchTeam(currentTeam?.id === team.id ? null : team.id)
										}
									>
										{currentTeam?.id === team.id ? 'Active' : 'Switch'}
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>
				))}
			</div>

			{currentTeam && (
				<>
					<div className='flex justify-between items-center pt-8'>
						<h2 className='text-xl font-semibold'>Team Members</h2>
						<Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
							<DialogTrigger asChild>
								<Button>Invite Member</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Invite Team Member</DialogTitle>
									<DialogDescription>
										Invite a new member to join your team.
									</DialogDescription>
								</DialogHeader>
								<Form {...inviteMemberForm}>
									<form
										onSubmit={inviteMemberForm.handleSubmit(onInviteMember)}
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
