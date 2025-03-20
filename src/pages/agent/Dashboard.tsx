import React, { useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useAgentStore } from '../../stores/agentStore';
import { usePageTitle } from '../../context/PageTitleContext';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';
import { Link } from 'react-router-dom';
import { FileText, CheckSquare, ArrowRight, Home, Clock } from 'lucide-react';

const AgentDashboard: React.FC = () => {
	const { user } = useAuthStore();
	const { setPageTitle } = usePageTitle();
	const {
		applications,
		properties,
		workflowLogs,
		fetchApplications,
		fetchProperties,
		fetchWorkflowLogs,
		isLoading,
	} = useAgentStore();

	useEffect(() => {
		setPageTitle('Dashboard');
		if (user) {
			fetchApplications(user.id);
			fetchProperties(user.id);
			fetchWorkflowLogs();
		}
	}, [
		user,
		fetchApplications,
		fetchProperties,
		fetchWorkflowLogs,
		setPageTitle,
	]);

	if (isLoading) {
		return (
			<div className='flex justify-center items-center h-64'>
				<Spinner size='lg' />
			</div>
		);
	}

	// Calculate metrics
	const pendingApplications = applications.filter(
		(app) => app.status === 'pending',
	).length;
	const approvedApplications = applications.filter(
		(app) => app.status === 'approved',
	).length;
	const rejectedApplications = applications.filter(
		(app) => app.status === 'rejected',
	).length;

	// Get recent workflow activities
	const recentWorkflowActivities = workflowLogs.slice(0, 5);

	return (
		<div>
			<div className='mb-6'>
				<h1 className='text-2xl font-bold text-gray-900'>Dashboard</h1>
				<p className='text-gray-600 mt-1'>
					Welcome back, {user?.role === 'agent' ? 'Agent' : 'Landlord'}
				</p>
			</div>

			{/* Metrics */}
			<div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-8'>
				<Card>
					<CardContent className='p-6'>
						<div className='flex items-center justify-between'>
							<div>
								<p className='text-sm font-medium text-gray-500'>Properties</p>
								<p className='text-3xl font-bold mt-1'>{properties.length}</p>
							</div>
							<div className='bg-blue-100 p-3 rounded-full'>
								<Home className='h-6 w-6 text-blue-600' />
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
								<p className='text-3xl font-bold mt-1'>{applications.length}</p>
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
								<p className='text-sm font-medium text-gray-500'>
									Pending Reviews
								</p>
								<p className='text-3xl font-bold mt-1'>{pendingApplications}</p>
							</div>
							<div className='bg-yellow-100 p-3 rounded-full'>
								<Clock className='h-6 w-6 text-yellow-600' />
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			<div className='grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8'>
				{/* Recent Applications */}
				<Card>
					<CardHeader className='flex items-center justify-between'>
						<h2 className='text-lg font-semibold'>Recent Applications</h2>
						<FileText className='h-5 w-5 text-blue-600' />
					</CardHeader>
					<CardContent>
						{applications.length > 0 ? (
							<div className='divide-y divide-gray-200'>
								{applications.slice(0, 5).map((application) => (
									<div
										key={application.id}
										className='py-3 first:pt-0 last:pb-0'
									>
										<div className='flex items-center justify-between'>
											<div>
												<p className='font-medium'>
													Tenant #{application.tenant_id}
												</p>
												<p className='text-sm text-gray-500'>
													Property #{application.property_id} •{' '}
													{new Date(
														application.submitted_at,
													).toLocaleDateString()}
												</p>
											</div>
											<Badge
												variant={
													application.status === 'approved'
														? 'success'
														: application.status === 'rejected'
														? 'danger'
														: 'warning'
												}
											>
												{application.status.toUpperCase()}
											</Badge>
										</div>
									</div>
								))}
							</div>
						) : (
							<p className='text-gray-500 text-center py-4'>
								No applications found
							</p>
						)}

						<div className='mt-4'>
							<Link to='/agent/applications'>
								<Button
									variant='outline'
									className='w-full flex justify-between items-center'
								>
									<span>View All Applications</span>
									<ArrowRight size={16} />
								</Button>
							</Link>
						</div>
					</CardContent>
				</Card>

				{/* Recent Workflow Activities */}
				<Card>
					<CardHeader className='flex items-center justify-between'>
						<h2 className='text-lg font-semibold'>
							Recent Workflow Activities
						</h2>
						<CheckSquare className='h-5 w-5 text-blue-600' />
					</CardHeader>
					<CardContent>
						{recentWorkflowActivities.length > 0 ? (
							<div className='divide-y divide-gray-200'>
								{recentWorkflowActivities.map((activity) => (
									<div key={activity.id} className='py-3 first:pt-0 last:pb-0'>
										<div className='flex items-start justify-between'>
											<div>
												<p className='font-medium truncate max-w-xs'>
													{activity.email_subject}
												</p>
												<p className='text-sm text-gray-500'>
													From: {activity.email_from}
												</p>
												<p className='text-sm text-gray-500'>
													{new Date(activity.triggered_at).toLocaleString()}
												</p>
											</div>
											<Badge
												variant={
													activity.status === 'success' ? 'success' : 'danger'
												}
											>
												{activity.action_taken}
											</Badge>
										</div>
									</div>
								))}
							</div>
						) : (
							<p className='text-gray-500 text-center py-4'>
								No workflow activities found
							</p>
						)}

						<div className='mt-4'>
							<Link to='/agent/workflows'>
								<Button
									variant='outline'
									className='w-full flex justify-between items-center'
								>
									<span>Manage Workflows</span>
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
					<h2 className='text-lg font-semibold'>Application Status Summary</h2>
				</CardHeader>
				<CardContent>
					<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
						<div className='bg-gray-50 p-4 rounded-lg'>
							<div className='flex items-center justify-between mb-2'>
								<h3 className='font-medium'>Pending</h3>
								<Badge variant='warning'>{pendingApplications}</Badge>
							</div>
							<div className='w-full bg-gray-200 rounded-full h-2.5'>
								<div
									className='bg-yellow-500 h-2.5 rounded-full'
									style={{
										width: `${
											(pendingApplications / applications.length) * 100
										}%`,
									}}
								></div>
							</div>
						</div>

						<div className='bg-gray-50 p-4 rounded-lg'>
							<div className='flex items-center justify-between mb-2'>
								<h3 className='font-medium'>Approved</h3>
								<Badge variant='success'>{approvedApplications}</Badge>
							</div>
							<div className='w-full bg-gray-200 rounded-full h-2.5'>
								<div
									className='bg-green-500 h-2.5 rounded-full'
									style={{
										width: `${
											(approvedApplications / applications.length) * 100
										}%`,
									}}
								></div>
							</div>
						</div>

						<div className='bg-gray-50 p-4 rounded-lg'>
							<div className='flex items-center justify-between mb-2'>
								<h3 className='font-medium'>Rejected</h3>
								<Badge variant='danger'>{rejectedApplications}</Badge>
							</div>
							<div className='w-full bg-gray-200 rounded-full h-2.5'>
								<div
									className='bg-red-500 h-2.5 rounded-full'
									style={{
										width: `${
											(rejectedApplications / applications.length) * 100
										}%`,
									}}
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
