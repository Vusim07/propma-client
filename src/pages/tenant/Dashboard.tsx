/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { usePageTitle } from '../../context/PageTitleContext';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';
import {
	FileText,
	CheckSquare,
	Calendar,
	ArrowRight,
	RefreshCw,
	Home,
	ExternalLink,
} from 'lucide-react';
import { showToast } from '../../utils/toast';
import { supabase } from '../../services/supabase';
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '../../components/ui/Table';

interface ApplicationInfo {
	id: string;
	property_address: string;
	property_id: string;
	status: string;
	submitted_at: string;
	agent_name?: string;
}

const TenantDashboard: React.FC = () => {
	const { user } = useAuthStore();
	const { setPageTitle } = usePageTitle();
	const [refreshing, setRefreshing] = useState(false);
	const [applications, setApplications] = useState<ApplicationInfo[]>([]);
	const {
		profile,
		documents,
		screeningReport,
		appointments,
		fetchProfile,
		fetchDocuments,
		fetchScreeningReport,
		fetchAppointments,
		isLoading,
		error,
	} = useTenantStore();

	useEffect(() => {
		setPageTitle('Dashboard');
		if (user) {
			loadTenantData();
		}
	}, [user, setPageTitle]);

	// Add an effect to fetch applications when profile is loaded
	useEffect(() => {
		if (profile?.id && !isLoading) {
			fetchApplications();
		}
	}, [profile]);

	const loadTenantData = async () => {
		if (!user) return;
		console.log(user);

		try {
			// First fetch profile to check if it exists
			await fetchProfile(user.id);

			// Then fetch other data regardless of profile status
			// Applications will be fetched by the profile effect when it's ready
			await Promise.all([
				fetchDocuments(user.id),
				fetchScreeningReport(user.id),
				fetchAppointments(user.id),
			]);
		} catch (err) {
			console.error('Error loading tenant data:', err);
			showToast.error('Failed to load your profile information');
		}
	};

	const fetchApplications = async () => {
		if (isLoading) {
			// Still loading profile data, wait for it
			return;
		}

		if (!profile?.id) {
			console.log(
				'Profile not loaded yet or not found - skipping application fetch',
			);
			return;
		}

		try {
			// Query applications for the current tenant including property and agent details
			const { data, error } = await supabase
				.from('applications')
				.select(
					`
					*,
					properties (*),
					users:agent_id (first_name, last_name)
				`,
				)
				.eq('tenant_id', profile.id);

			if (error) throw error;

			if (data) {
				const formattedApplications: ApplicationInfo[] = data.map(
					(app: any) => ({
						id: app.id,
						property_address: app.properties?.address || 'Unknown property',
						property_id: app.properties?.id || '',
						status: app.status,
						submitted_at: new Date(app.created_at).toLocaleDateString('en-ZA'),
						agent_name: app.users
							? `${app.users.first_name} ${app.users.last_name}`
							: undefined,
					}),
				);

				setApplications(formattedApplications);
			}
		} catch (err) {
			console.error('Error fetching applications:', err);
		}
	};

	const handleRefresh = async () => {
		setRefreshing(true);
		const toastId = showToast.loading('Refreshing your profile...');

		try {
			await loadTenantData();
			showToast.dismiss(toastId as any);
			showToast.success('Your profile has been refreshed');
		} catch (err) {
			showToast.dismiss(toastId as any);
			// Error is already handled in loadTenantData
		} finally {
			setRefreshing(false);
		}
	};

	if (isLoading && !profile) {
		return (
			<div className='flex justify-center items-center h-64'>
				<Spinner size='lg' />
			</div>
		);
	}

	if (error) {
		return (
			<div className='text-center p-6'>
				<h2 className='text-xl font-semibold text-red-600 mb-2'>
					Error Loading Profile
				</h2>
				<p className='text-gray-600 mb-4'>{error}</p>
				<Button onClick={handleRefresh} disabled={refreshing}>
					{refreshing ? (
						<>
							<Spinner size='sm' className='mr-2' />
							Retrying...
						</>
					) : (
						<>
							<RefreshCw size={16} className='mr-2' />
							Retry
						</>
					)}
				</Button>
			</div>
		);
	}

	return (
		<div>
			<div className='mb-6 flex justify-between items-center'>
				<div>
					<h1 className='text-2xl font-bold text-gray-900'>
						Welcome, {user?.first_name || 'Tenant'}
					</h1>
					<p className='text-gray-600 mt-1'>
						Manage your rental application process
					</p>
				</div>
				<Button
					variant='outline'
					size='sm'
					onClick={handleRefresh}
					disabled={refreshing || isLoading}
				>
					{refreshing ? (
						<Spinner size='sm' className='mr-2' />
					) : (
						<RefreshCw size={16} className='mr-2' />
					)}
					Refresh
				</Button>
			</div>

			{/* Documents Card */}
			<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8'>
				<Card>
					<CardHeader className='flex items-center justify-between'>
						<h2 className='text-lg font-semibold'>Documents</h2>
						<FileText className='h-5 w-5 text-blue-600' />
					</CardHeader>
					<CardContent>
						<p className='text-gray-600 mb-4'>
							{documents.length > 0
								? `You have uploaded ${documents.length} document(s)`
								: 'No documents uploaded yet'}
						</p>
						<Link to='/tenant/documents'>
							<Button
								variant='outline'
								className='w-full flex justify-between items-center'
							>
								<span>Manage Documents</span>
								<ArrowRight size={16} />
							</Button>
						</Link>
					</CardContent>
				</Card>

				{/* Screening Card */}
				<Card>
					<CardHeader className='flex items-center justify-between'>
						<h2 className='text-lg font-semibold'>Screening Status</h2>
						<CheckSquare className='h-5 w-5 text-blue-600' />
					</CardHeader>
					<CardContent>
						{screeningReport ? (
							<div className='mb-4'>
								<div className='flex items-center justify-between mb-2'>
									<span className='text-gray-600'>Pre-approval:</span>
									<Badge
										variant={
											screeningReport.pre_approval_status === 'approved'
												? 'success'
												: screeningReport.pre_approval_status === 'rejected'
												? 'danger'
												: 'warning'
										}
									>
										{screeningReport.pre_approval_status.toUpperCase()}
									</Badge>
								</div>
								<div className='flex items-center justify-between'>
									<span className='text-gray-600'>Credit Score:</span>
									<span className='font-medium'>
										{screeningReport.credit_score}
									</span>
								</div>
							</div>
						) : (
							<p className='text-gray-600 mb-4'>
								No screening report available
							</p>
						)}
						<Link to='/tenant/screening'>
							<Button
								variant='outline'
								className='w-full flex justify-between items-center'
							>
								<span>View Screening Results</span>
								<ArrowRight size={16} />
							</Button>
						</Link>
					</CardContent>
				</Card>

				{/* Appointments Card */}
				<Card>
					<CardHeader className='flex items-center justify-between'>
						<h2 className='text-lg font-semibold'>Appointments</h2>
						<Calendar className='h-5 w-5 text-blue-600' />
					</CardHeader>
					<CardContent>
						<p className='text-gray-600 mb-4'>
							{appointments.length > 0
								? `You have ${appointments.length} upcoming appointment(s)`
								: 'No appointments scheduled'}
						</p>
						<Link to='/tenant/appointments'>
							<Button
								variant='outline'
								className='w-full flex justify-between items-center'
							>
								<span>Schedule Appointments</span>
								<ArrowRight size={16} />
							</Button>
						</Link>
					</CardContent>
				</Card>
			</div>

			{/* Applications Section */}
			{applications.length > 0 && (
				<Card className='mb-8'>
					<CardHeader className='flex flex-row items-center justify-between'>
						<h2 className='text-lg font-semibold'>Your Applications</h2>
						<Home className='h-5 w-5 text-blue-600' />
					</CardHeader>
					<CardContent>
						<div className='w-full overflow-auto'>
							<Table>
								<TableHeader className='hidden md:table-header-group'>
									<TableRow className='hover:bg-transparent'>
										<TableHead>Property</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Submitted</TableHead>
										<TableHead>Agent</TableHead>
										<TableHead className='text-right'>Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{applications.map((app) => (
										<TableRow
											key={app.id}
											className='flex flex-col md:table-row border-b'
										>
											{/* Mobile view card header with status badge */}
											<TableCell className='md:hidden flex justify-between items-center py-2 px-0 border-b border-gray-100'>
												<span className='font-medium'>Property</span>
												<Badge
													variant={
														app.status === 'approved'
															? 'success'
															: app.status === 'rejected'
															? 'danger'
															: 'warning'
													}
												>
													{app.status.toUpperCase()}
												</Badge>
											</TableCell>

											{/* Property column */}
											<TableCell
												data-label='Property'
												className='flex flex-col md:table-cell pb-1 md:pb-4'
											>
												<span className='block md:hidden text-xs text-gray-500 mb-1 md:hidden'>
													Property
												</span>
												<span className='font-medium'>
													{app.property_address}
												</span>
											</TableCell>

											{/* Status column - hidden on mobile (shown in header) */}
											<TableCell
												data-label='Status'
												className='hidden md:table-cell'
											>
												<Badge
													variant={
														app.status === 'approved'
															? 'success'
															: app.status === 'rejected'
															? 'danger'
															: 'warning'
													}
												>
													{app.status.toUpperCase()}
												</Badge>
											</TableCell>

											{/* Submitted date column */}
											<TableCell
												data-label='Submitted'
												className='flex flex-col md:table-cell py-1 md:py-4'
											>
												<span className='block md:hidden text-xs text-gray-500 mb-1'>
													Submitted
												</span>
												<span className='text-sm'>{app.submitted_at}</span>
											</TableCell>

											{/* Agent name column */}
											<TableCell
												data-label='Agent'
												className='flex flex-col md:table-cell py-1 md:py-4'
											>
												<span className='block md:hidden text-xs text-gray-500 mb-1'>
													Agent
												</span>
												<span className='text-sm'>
													{app.agent_name || 'Unassigned'}
												</span>
											</TableCell>

											{/* Actions column */}
											<TableCell className='flex flex-col md:table-cell py-2 md:py-4 text-left md:text-right'>
												<span className='block md:hidden text-xs text-gray-500 mb-1'>
													Actions
												</span>
												<Link to={`/tenant/screening?application=${app.id}`}>
													<Button
														variant='outline'
														size='sm'
														className='w-full md:w-auto flex justify-between items-center'
													>
														<span>View Details</span>
														<ExternalLink size={14} className='ml-2' />
													</Button>
												</Link>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Profile Information */}
			<Card>
				<CardHeader className='flex items-center justify-between'>
					<h2 className='text-lg font-semibold'>Profile Information</h2>
					{isLoading && <Spinner size='sm' />}
				</CardHeader>
				<CardContent>
					{!profile ? (
						<div className='text-center py-4'>
							<p className='text-gray-600 mb-4'>
								You haven't created a tenant profile yet. A complete profile is
								required for rental applications.
							</p>
							<Link to='/tenant/profile'>
								<Button size='lg'>Create Your Profile</Button>
							</Link>
						</div>
					) : (
						<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
							<div>
								<p className='text-sm text-gray-500'>Full Name</p>
								<p className='font-medium'>
									{profile.first_name} {profile.last_name}
								</p>
							</div>
							<div>
								<p className='text-sm text-gray-500'>Email</p>
								<p className='font-medium'>{user?.email}</p>
							</div>
							<div>
								<p className='text-sm text-gray-500'>Phone</p>
								<p className='font-medium'>{profile.phone || 'Not provided'}</p>
							</div>
							<div>
								<p className='text-sm text-gray-500'>Current Address</p>
								<p className='font-medium'>
									{profile.current_address || 'Not provided'}
								</p>
							</div>
							<div>
								<p className='text-sm text-gray-500'>Employment Status</p>
								<p className='font-medium'>
									{profile.employment_status || 'Not provided'}
								</p>
							</div>
							<div>
								<p className='text-sm text-gray-500'>Monthly Income</p>
								<p className='font-medium'>
									{profile.monthly_income
										? `R${profile.monthly_income.toLocaleString('en-ZA')}`
										: 'Not provided'}
								</p>
							</div>
							<div>
								<p className='text-sm text-gray-500'>ID Number</p>
								<p className='font-medium'>
									{profile.id_number
										? `${profile.id_number.substring(
												0,
												3,
										  )}******${profile.id_number.substring(
												profile.id_number.length - 3,
										  )}`
										: 'Not provided'}
								</p>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
};

export default TenantDashboard;
