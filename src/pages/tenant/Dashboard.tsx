import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { usePageTitle } from '../../context/PageTitleContext';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';
import { FileText, CheckSquare, Calendar, ArrowRight } from 'lucide-react';

const TenantDashboard: React.FC = () => {
	const { user } = useAuthStore();
	const { setPageTitle } = usePageTitle();
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
	} = useTenantStore();

	useEffect(() => {
		setPageTitle('Dashboard');
		if (user) {
			fetchProfile(user.id);
			fetchDocuments(user.id);
			fetchScreeningReport(user.id);
			fetchAppointments(user.id);
		}
	}, [
		user,
		fetchProfile,
		fetchDocuments,
		fetchScreeningReport,
		fetchAppointments,
		setPageTitle,
	]);

	if (isLoading) {
		return (
			<div className='flex justify-center items-center h-64'>
				<Spinner size='lg' />
			</div>
		);
	}

	return (
		<div>
			<div className='mb-6'>
				<h1 className='text-2xl font-bold text-gray-900'>
					Welcome, {profile?.first_name || 'Tenant'}
				</h1>
				<p className='text-gray-600 mt-1'>
					Manage your rental application process
				</p>
			</div>

			<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8'>
				{/* Documents Card */}
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
				<CardHeader>
					<h2 className='text-lg font-semibold'>Profile Information</h2>
				</CardHeader>
				<CardContent>
					{profile ? (
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
								<p className='font-medium'>{profile.phone}</p>
							</div>
							<div>
								<p className='text-sm text-gray-500'>Current Address</p>
								<p className='font-medium'>{profile.current_address}</p>
							</div>
							<div>
								<p className='text-sm text-gray-500'>Employment Status</p>
								<p className='font-medium'>{profile.employment_status}</p>
							</div>
							<div>
								<p className='text-sm text-gray-500'>Monthly Income</p>
								<p className='font-medium'>
									R{profile.monthly_income.toLocaleString()}
								</p>
							</div>
						</div>
					) : (
						<p className='text-gray-600'>No profile information available</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
};

export default TenantDashboard;
