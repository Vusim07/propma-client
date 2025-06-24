/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useAgentStore } from '../../stores/agentStore';
import { usePageTitle } from '../../context/PageTitleContext';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import {
	FileText,
	ArrowRight,
	Home,
	Clock,
	CalendarDays,
	Users,
	Mail,
} from 'lucide-react';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { ApplicationWithRelations } from '@/types';
import { useInboxStore } from '@/stores/inboxStore';
const AgentDashboard: React.FC = () => {
	const { user } = useAuthStore();
	const { setPageTitle } = usePageTitle();
	const {
		applications,
		properties,
		appointments,
		fetchApplications,
		fetchProperties,
		fetchAppointments,
		isLoading,
		currentTeamId,
	} = useAgentStore();

	// Inbox store for recent emails
	const { threads, fetchThreads, isLoading: inboxLoading } = useInboxStore();
	React.useEffect(() => {
		fetchThreads({}); // Fetch all threads, optionally add limit/filter if supported
	}, [fetchThreads]);

	useEffect(() => {
		setPageTitle('Welcome, ' + user?.first_name + '👋');
		if (user) {
			fetchApplications(user.id, currentTeamId);
			fetchProperties(user.id, currentTeamId);
			fetchAppointments(user.id);
		}
	}, [
		user,
		fetchApplications,
		fetchProperties,
		fetchAppointments,
		setPageTitle,
		currentTeamId,
	]);

	if (isLoading) {
		return (
			<div className='flex justify-center items-center h-64'>
				<Spinner size='lg' />
			</div>
		);
	}

	// Format applications with proper types
	const formattedApplications: ApplicationWithRelations[] = applications.map(
		(application) => {
			// Traverse nested structure to get the deepest tenant_profiles with first_name/last_name
			let tenantProfile = (application as any).tenant_profiles;
			while (
				tenantProfile &&
				tenantProfile.tenant_profiles &&
				tenantProfile.tenant_profiles.first_name
			) {
				tenantProfile = tenantProfile.tenant_profiles;
			}

			return {
				...application,
				// Use the deepest tenantProfile with a name, or null
				tenant_profiles: tenantProfile || null,
				properties:
					application as unknown as ApplicationWithRelations['properties'],
				submitted_at_formatted: format(
					new Date(application.created_at),
					'dd/MM/yyyy',
				),
			};
		},
	);

	console.log('Formatted Applications:', formattedApplications);

	// Calculate metrics
	const pendingApplications = formattedApplications.filter(
		(app) => app.status === 'pending',
	).length;
	const approvedApplications = formattedApplications.filter(
		(app) => app.status === 'approved',
	).length;
	const rejectedApplications = formattedApplications.filter(
		(app) => app.status === 'rejected',
	).length;

	// Filter appointments for today
	const todayString = format(new Date(), 'yyyy-MM-dd');
	const todaysAppointments = appointments
		.filter((appt) => appt.date === todayString && appt.status === 'scheduled')
		.sort((a, b) => a.start_time.localeCompare(b.start_time));

	// Get recent applications (latest first)
	const recentApplications = formattedApplications
		.slice()
		.sort(
			(a, b) =>
				new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
		)
		.slice(0, 5);

	return (
		<div>
			{/* <div className='mb-6'>
				<p className='text-gray-600 mt-1'>Welcome back, {user?.first_name}</p>
			</div> */}

			{/* Metrics */}
			<div className='grid grid-cols-1 md:grid-cols-3 gap-3 mb-2'>
				<Card>
					<CardContent className='p-6'>
						<div className='flex items-center justify-between'>
							<div>
								<p className='text-sm font-medium text-gray-500'>Properties</p>
								<p className='text-xl font-bold mt-1'>{properties.length}</p>
							</div>
							<div className='bg-blue-100 p-3 rounded-full'>
								<Home className='h-6 w-6 text-dusty_grey' />
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className='p-6'>
						<div className='flex items-center justify-between'>
							<div>
								<p className='text-sm font-medium text-gray-500'>
									Applications
								</p>
								<p className='text-xl font-bold mt-1'>
									{formattedApplications.length}
								</p>
							</div>
							<div className='bg-green-100 p-3 rounded-full'>
								<FileText className='h-6 w-6 text-green-600' />
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className='p-6'>
						<div className='flex items-center justify-between'>
							<div>
								<p className='text-sm font-medium text-gray-500'>Pending</p>
								<p className='text-xl font-bold mt-1'>{pendingApplications}</p>
							</div>
							<div className='bg-yellow-100 p-3 rounded-full'>
								<Clock className='h-6 w-6 text-yellow-600' />
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			<div className='grid grid-cols-1 lg:grid-cols-3 gap-3 mb-2'>
				{/* Recent Applications */}
				<Card className='lg:col-span-1'>
					<CardHeader>
						<div className='flex items-center gap-2'>
							<h2 className='text-md font-semibold'>Recent Applications</h2>
							<Users className='h-5 w-5 text-dusty_grey' />
						</div>
					</CardHeader>
					<CardContent>
						{recentApplications.length > 0 ? (
							<div className='max-h-96 overflow-y-auto'>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Prospect</TableHead>
											<TableHead>Property</TableHead>
											<TableHead>Status</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{recentApplications.map((application) => (
											<TableRow
												key={application.id}
												className='cursor-pointer hover:bg-gray-50'
												onClick={() =>
													(window.location.href = `/agent/screening/${application.id}`)
												}
											>
												<TableCell className='font-medium truncate max-w-[100px]'>
													{(() => {
														const name = getDeepestTenantProfileName(
															application.tenant_profiles,
														);
														return name || `Prospect #${application.tenant_id}`;
													})()}
													<p className='text-xs text-gray-400'>
														{application.submitted_at_formatted ||
															'Date unknown'}
													</p>
												</TableCell>
												<TableCell className='truncate max-w-[100px]'>
													{application.properties?.properties?.address?.split(
														',',
													)[0] || `Property #${application.property_id}`}
												</TableCell>
												<TableCell>
													<Badge
														variant={
															application.status === 'approved'
																? 'success'
																: application.status === 'rejected'
																? 'destructive'
																: application.status === 'pending'
																? 'secondary'
																: 'default'
														}
													>
														{application.status
															? application.status.charAt(0).toUpperCase() +
															  application.status.slice(1)
															: 'Unknown'}
													</Badge>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						) : (
							<p className='text-gray-500 text-center py-4'>
								No recent applications found
							</p>
						)}

						<div className='mt-4'>
							<Link to='/agent/applications'>
								<Button
									variant='outline'
									className='w-full flex justify-center items-center gap-2'
								>
									<span>View All Applications</span>
									<ArrowRight size={16} />
								</Button>
							</Link>
						</div>
					</CardContent>
				</Card>

				{/* Today's Appointments */}
				<Card className='lg:col-span-1'>
					<CardHeader>
						<div className='flex items-center gap-2'>
							<h2 className='text-md font-semibold'>Today's Appointments</h2>
							<CalendarDays className='h-5 w-5 text-dusty_grey' />
						</div>
					</CardHeader>
					<CardContent>
						{todaysAppointments.length > 0 ? (
							<div className='max-h-72 overflow-y-auto'>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Time</TableHead>
											<TableHead>Prospect</TableHead>
											<TableHead>Property</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{todaysAppointments.map((appointment) => (
											<TableRow key={appointment.id}>
												<TableCell className='font-medium'>
													{appointment.start_time}
												</TableCell>
												<TableCell>
													{appointment.tenant_name || 'N/A'}
												</TableCell>
												<TableCell>
													{appointment.property_address?.split(',')[0] || 'N/A'}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						) : (
							<p className='text-gray-500 text-center py-4'>
								No appointments scheduled for today
							</p>
						)}
						<div className='mt-4'>
							<Link to='/agent/appointments'>
								<Button
									variant='outline'
									className='w-full flex justify-between items-center'
								>
									<span>View All Appointments</span>
									<ArrowRight size={16} />
								</Button>
							</Link>
						</div>
					</CardContent>
				</Card>

				{/* Recent Inbox Activities */}
				<Card className='lg:col-span-1'>
					<CardHeader>
						<div className='flex items-center gap-2'>
							<h2 className='text-md font-semibold'>Recent Inbox Activities</h2>
							<Mail className='h-5 w-5 text-dusty_grey' />
						</div>
					</CardHeader>
					<CardContent>
						{inboxLoading ? (
							<p className='text-gray-500 text-center py-4'>Loading...</p>
						) : threads && threads.length > 0 ? (
							<div className='divide-y divide-gray-200 max-h-72 overflow-y-auto'>
								{threads
									.slice()
									.sort((a, b) => {
										const getLatest = (thread: any) => {
											if (!thread.messages || thread.messages.length === 0)
												return 0;
											return Math.max(
												...thread.messages.map((msg: any) => {
													return msg.sent_at
														? new Date(msg.sent_at).getTime()
														: msg.received_at
														? new Date(msg.received_at).getTime()
														: msg.created_at
														? new Date(msg.created_at).getTime()
														: 0;
												}),
											);
										};
										return getLatest(b) - getLatest(a);
									})
									.slice(0, 5)
									.map((thread) => {
										const sortedMessages = (thread.messages || [])
											.slice()
											.sort((a, b) => {
												const aDate = new Date(
													a.sent_at || a.received_at || a.created_at,
												).getTime();
												const bDate = new Date(
													b.sent_at || b.received_at || b.created_at,
												).getTime();
												return bDate - aDate;
											});
										const msg = sortedMessages[0];
										if (!msg) return null;
										const isReceived = msg.status === 'received';
										const sender = isReceived
											? msg.from_name || msg.from_address || 'Unknown'
											: msg.to_address || 'Unknown';
										const statusLabel =
											msg.status.charAt(0).toUpperCase() + msg.status.slice(1);
										const dateStr =
											msg.sent_at || msg.received_at || msg.created_at;
										return (
											<div
												key={thread.id}
												className='py-3 first:pt-0 last:pb-0'
											>
												<div className='flex items-start justify-between max-w-[420px] min-w-[320px] w-full'>
													<div className='flex-1 min-w-0'>
														<p className='font-medium truncate max-w-[180px]'>
															{msg.subject || '(No Subject)'}
														</p>
														<p className='text-sm text-gray-500 truncate max-w-[180px]'>
															{isReceived ? 'From' : 'To'}: {sender}
														</p>
														<p className='text-sm text-gray-500 whitespace-nowrap'>
															{dateStr
																? new Date(dateStr).toLocaleString('en-ZA')
																: ''}
														</p>
													</div>
													<Badge
														variant={
															msg.status === 'received'
																? 'secondary'
																: msg.status === 'sent'
																? 'success'
																: 'outline'
														}
														className='capitalize max-w-[80px] truncate text-center'
													>
														{statusLabel}
													</Badge>
												</div>
											</div>
										);
									})}
							</div>
						) : (
							<p className='text-gray-500 text-center py-4'>
								No inbox activities found
							</p>
						)}
						<div className='mt-4'>
							<Link to='/agent/inbox'>
								<Button
									variant='outline'
									className='w-full flex justify-between items-center'
								>
									<span>Manage Inbox</span>
									<ArrowRight size={16} />
								</Button>
							</Link>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Application Status Summary */}
			<Card>
				<CardHeader>
					<h2 className='text-md font-semibold'>Application Status Summary</h2>
				</CardHeader>
				<CardContent>
					<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
						<div className='bg-gray-50 p-4 rounded-lg'>
							<div className='flex items-center justify-between mb-2'>
								<h3 className='font-medium'>Pending</h3>
								<Badge variant='secondary'>{pendingApplications}</Badge>
							</div>
							<div className='w-full bg-gray-200 rounded-full h-2.5'>
								<div
									className={`bg-yellow-500 h-2.5 rounded-full w-[${
										(pendingApplications / formattedApplications.length) * 100
									}%]`}
								></div>
							</div>
						</div>

						<div className='bg-gray-50 p-4 rounded-lg'>
							<div className='flex items-center justify-between mb-2'>
								<h3 className='font-medium'>Approved</h3>
								<Badge variant='default'>{approvedApplications}</Badge>
							</div>
							<div className='w-full bg-gray-200 rounded-full h-2.5'>
								<div
									className={`bg-green-500 h-2.5 rounded-full w-[${
										(approvedApplications / formattedApplications.length) * 100
									}%]`}
								></div>
							</div>
						</div>

						<div className='bg-gray-50 p-4 rounded-lg'>
							<div className='flex items-center justify-between mb-2'>
								<h3 className='font-medium'>Rejected</h3>
								<Badge variant='destructive'>{rejectedApplications}</Badge>
							</div>
							<div className='w-full bg-gray-200 rounded-full h-2.5'>
								<div
									className={`bg-red-500 h-2.5 rounded-full w-[${
										(rejectedApplications / formattedApplications.length) * 100
									}%]`}
								></div>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
};

export default AgentDashboard;

// Helper to traverse nested tenant_profiles and return the deepest profile with a valid name
function getDeepestTenantProfileName(profile: any): string | null {
	let current = profile;
	let lastValid: { first_name?: string; last_name?: string } | null = null;
	while (current && typeof current === 'object') {
		if (current.first_name && current.last_name) {
			lastValid = current;
		}
		current = current.tenant_profiles;
	}
	if (lastValid && lastValid.first_name && lastValid.last_name) {
		return `${lastValid.first_name} ${lastValid.last_name}`;
	}
	return null;
}
