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
} from 'lucide-react';
import { showToast } from '../../utils/toast';

const TenantDashboard: React.FC = () => {
	const { user } = useAuthStore();
	const { setPageTitle } = usePageTitle();
	const [refreshing, setRefreshing] = useState(false);
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

	const loadTenantData = async () => {
		if (!user) return;
		console.log(user);

		try {
			// First fetch profile to check if it exists
			await fetchProfile(user.id);

			// Then fetch other data
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
									{profile.id_number || 'Not provided'}
								</p>
							</div>
							<div>
								<p className='text-sm text-gray-500'>Date of Birth</p>
								<p className='font-medium'>
									{profile.date_of_birth
										? new Date(profile.date_of_birth).toLocaleDateString(
												'en-ZA',
												{
													day: '2-digit',
													month: '2-digit',
													year: 'numeric',
												},
										  )
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
