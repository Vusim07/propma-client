/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useAgentStore } from '../../stores/agentStore';
import { Card, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import { usePageTitle } from '../../context/PageTitleContext';

import {
	FileText,
	CheckCircle,
	XCircle,
	Clock,
	Search,
	ArrowRight,
	Home,
	User,
	Phone,
	Mail,
	MapPin,
	Briefcase,
	DollarSign,
	Calendar,
} from 'lucide-react';
import { showToast } from '../../utils/toast';
import { formatCurrency } from '../../utils/formatters';

// Define interface for tenant profile
interface TenantProfile {
	first_name?: string;
	last_name?: string;
	phone?: string | null;
	email?: string;
	current_address?: string;
}

// Define interface for property
interface Property {
	monthly_rent?: number;
}

// Define interface for enhanced application
interface EnhancedApplication {
	id: string;
	tenant_id: string;
	property_id: string;
	status: 'pending' | 'approved' | 'rejected';
	monthly_income: number;
	employer: string;
	employment_duration: number;
	notes?: string;
	created_at: string;
	submitted_at?: string;
	tenant_profiles?: TenantProfile;
	properties?: Property;
}

// Format phone number for display
const formatPhoneNumber = (phone: string | null): string => {
	if (!phone) return 'Not provided';

	// Remove any non-digit characters
	const digits = phone.replace(/\D/g, '');

	// Handle international format (+27)
	if (digits.startsWith('27')) {
		const mobile = digits.slice(2);
		if (mobile.length === 9) {
			return `+27 ${mobile.slice(0, 2)} ${mobile.slice(2, 5)} ${mobile.slice(
				5,
			)}`;
		}
	}

	// Handle local format (0XX)
	if (digits.startsWith('0')) {
		if (digits.length === 10) {
			return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
		}
	}

	// Fallback to basic formatting if number doesn't match expected patterns
	return phone;
};

// Format employment duration in years/months
const formatEmploymentDuration = (months: number): string => {
	if (months < 1) return 'Less than a month';
	const years = Math.floor(months / 12);
	const remainingMonths = months % 12;

	if (years === 0)
		return `${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
	if (remainingMonths === 0) return `${years} year${years !== 1 ? 's' : ''}`;
	return `${years} year${years !== 1 ? 's' : ''}, ${remainingMonths} month${
		remainingMonths !== 1 ? 's' : ''
	}`;
};

const ReviewApplications: React.FC = () => {
	const { user } = useAuthStore();
	const { setPageTitle } = usePageTitle();

	const {
		applications,
		properties,
		fetchApplications,
		fetchProperties,
		updateApplicationStatus,
		isLoading,
	} = useAgentStore();

	const [statusFilter, setStatusFilter] = useState<
		'all' | 'pending' | 'approved' | 'rejected'
	>('all');
	const [propertyFilter, setPropertyFilter] = useState<string>('all');
	const [searchTerm, setSearchTerm] = useState('');
	const [success, setSuccess] = useState('');
	const [error, setError] = useState('');

	useEffect(() => {
		if (user) {
			setPageTitle('Applications');
			fetchApplications(user.id);
			fetchProperties(user.id);
		}
	}, [user, fetchApplications, fetchProperties, setPageTitle]);

	const handleStatusChange = async (
		applicationId: string,
		status: 'pending' | 'approved' | 'rejected',
		notes?: string,
	) => {
		try {
			await updateApplicationStatus(applicationId, status, notes);
			showToast.success(`Application ${status} successfully`);
			setSuccess(`Application ${status} successfully`);

			// Clear success message after 3 seconds
			setTimeout(() => setSuccess(''), 3000);
		} catch (err: unknown) {
			const errorMessage =
				err instanceof Error ? err.message : 'Unknown error occurred';
			showToast.error('Failed to update application status');
			setError(
				`Failed to update application status. Please try again: ${errorMessage}`,
			);

			// Clear error message after 3 seconds
			setTimeout(() => setError(''), 3000);
		}
	};

	const filteredApplications = applications
		.filter((app) => statusFilter === 'all' || app.status === statusFilter)
		.filter(
			(app) => propertyFilter === 'all' || app.property_id === propertyFilter,
		)
		.filter((app) => {
			if (!searchTerm) return true;

			// Enhanced search that includes tenant names
			const appWithProfile = app as EnhancedApplication; // Type assertion with our specific interface
			const tenantProfile = appWithProfile.tenant_profiles;
			const fullName = tenantProfile
				? `${tenantProfile.first_name || ''} ${
						tenantProfile.last_name || ''
				  }`.toLowerCase()
				: '';

			return (
				app.id.includes(searchTerm.toLowerCase()) ||
				app.tenant_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
				app.property_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
				fullName.includes(searchTerm.toLowerCase())
			);
		});

	// Get property address by ID
	const getPropertyAddress = (propertyId: string) => {
		const property = properties.find((p) => p.id === propertyId);
		return property
			? `${property.address}, ${property.city}, ${property.province} ${property.postal_code}`
			: 'Unknown property';
	};

	return (
		<div>
			<div className='mb-6'>
				<h1 className='text-2xl font-bold mb-2'>Tenant Applications</h1>
				<p className='text-gray-600'>Manage and review tenant applications</p>
			</div>

			{error && (
				<Alert variant='error' className='mb-6'>
					{error}
				</Alert>
			)}

			{success && (
				<Alert variant='success' className='mb-6'>
					{success}
				</Alert>
			)}

			{/* Filters and Search */}
			<div className='bg-white p-4 rounded-lg shadow-sm mb-6'>
				<div className='flex flex-col md:flex-row justify-between gap-4'>
					<div className='flex flex-wrap gap-2'>
						<Button
							variant={statusFilter === 'all' ? 'primary' : 'outline'}
							size='sm'
							onClick={() => setStatusFilter('all')}
						>
							All Status
						</Button>
						<Button
							variant={statusFilter === 'pending' ? 'primary' : 'outline'}
							size='sm'
							onClick={() => setStatusFilter('pending')}
						>
							<Clock size={16} className='mr-1' />
							Pending
						</Button>
						<Button
							variant={statusFilter === 'approved' ? 'primary' : 'outline'}
							size='sm'
							onClick={() => setStatusFilter('approved')}
						>
							<CheckCircle size={16} className='mr-1' />
							Approved
						</Button>
						<Button
							variant={statusFilter === 'rejected' ? 'primary' : 'outline'}
							size='sm'
							onClick={() => setStatusFilter('rejected')}
						>
							<XCircle size={16} className='mr-1' />
							Rejected
						</Button>
					</div>

					<div className='flex items-center gap-2'>
						<div className='relative flex-1'>
							<div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
								<Search size={16} className='text-gray-400' />
							</div>
							<input
								type='text'
								placeholder='Search applications...'
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className='pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
							/>
						</div>
					</div>
				</div>

				{/* Property Filter */}
				<div className='mt-4'>
					<div className='flex items-center mb-2'>
						<Home size={16} className='text-gray-500 mr-2' />
						<span className='text-sm font-medium text-gray-700'>
							Filter by Property
						</span>
					</div>
					<select
						value={propertyFilter}
						onChange={(e) => setPropertyFilter(e.target.value)}
						className='w-full md:w-auto border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
						aria-label='Filter by Property'
					>
						<option value='all'>All Properties</option>
						{properties.map((property) => (
							<option key={property.id} value={property.id}>
								{property.address}, {property.city}
							</option>
						))}
					</select>
				</div>
			</div>

			{/* Applications List */}
			{isLoading ? (
				<div className='flex justify-center py-8'>
					<Spinner size='lg' />
				</div>
			) : filteredApplications.length > 0 ? (
				<div className='space-y-6'>
					{filteredApplications.map((application) => {
						// Get the tenant profile data with type assertion
						const appWithExtras = application as EnhancedApplication; // Type assertion with our specific interface
						const tenantProfile = appWithExtras.tenant_profiles || {};

						return (
							<Card key={application.id}>
								<CardContent className='p-6'>
									<div className='flex flex-col md:flex-row justify-between mb-6'>
										<div>
											<h2 className='text-lg font-semibold mb-1'>
												Application #{application.id.substring(0, 8)}
											</h2>
											<p className='text-gray-600'>
												Submitted on{' '}
												{appWithExtras.submitted_at ||
													new Date(application.created_at).toLocaleDateString()}
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
											className='self-start md:self-center mt-2 md:mt-0'
										>
											{application.status.toUpperCase()}
										</Badge>
									</div>

									<div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-6'>
										<div>
											<h3 className='text-sm font-medium text-gray-500 mb-2 flex items-center'>
												<User size={16} className='mr-1 text-blue-500' />
												Tenant Information
											</h3>
											<div className='bg-gray-50 p-4 rounded-lg'>
												{tenantProfile ? (
													<>
														<div className='mb-3'>
															<p className='text-sm text-gray-500 mb-1'>Name</p>
															<p className='font-medium'>
																{tenantProfile.first_name}{' '}
																{tenantProfile.last_name}
															</p>
														</div>

														<div className='mb-3'>
															<p className='text-sm text-gray-500 mb-1 flex items-center'>
																<Phone
																	size={14}
																	className='mr-1 text-gray-400'
																/>
																Phone
															</p>
															<p className='font-medium'>
																{formatPhoneNumber(tenantProfile.phone as any)}
															</p>
														</div>

														<div className='mb-3'>
															<p className='text-sm text-gray-500 mb-1 flex items-center'>
																<Mail
																	size={14}
																	className='mr-1 text-gray-400'
																/>
																Email
															</p>
															<p className='font-medium'>
																{tenantProfile.email}
															</p>
														</div>

														<div>
															<p className='text-sm text-gray-500 mb-1 flex items-center'>
																<MapPin
																	size={14}
																	className='mr-1 text-gray-400'
																/>
																Current Address
															</p>
															<p className='font-medium text-sm'>
																{tenantProfile.current_address ||
																	'Not provided'}
															</p>
														</div>
													</>
												) : (
													<p className='text-gray-500 italic'>
														Tenant profile information not available
													</p>
												)}
											</div>
										</div>

										<div>
											<h3 className='text-sm font-medium text-gray-500 mb-2 flex items-center'>
												<Home size={16} className='mr-1 text-blue-500' />
												Property Information
											</h3>
											<div className='bg-gray-50 p-4 rounded-lg'>
												<div className='mb-3'>
													<p className='text-sm text-gray-500 mb-1'>Property</p>
													<p className='font-medium'>
														{getPropertyAddress(application.property_id)}
													</p>
												</div>

												{appWithExtras.properties && (
													<div className='mt-3'>
														<p className='text-sm text-gray-500 mb-1'>
															Monthly Rent
														</p>
														<p className='font-medium text-green-600'>
															{formatCurrency(
																appWithExtras.properties.monthly_rent || 0,
															)}
														</p>
													</div>
												)}
											</div>

											<h3 className='text-sm font-medium text-gray-500 mt-4 mb-2 flex items-center'>
												<Briefcase size={16} className='mr-1 text-blue-500' />
												Financial Information
											</h3>
											<div className='bg-gray-50 p-4 rounded-lg'>
												<div className='mb-3'>
													<p className='text-sm text-gray-500 mb-1 flex items-center'>
														<DollarSign
															size={14}
															className='mr-1 text-gray-400'
														/>
														Monthly Income
													</p>
													<p className='font-medium text-green-600'>
														{formatCurrency(application.monthly_income)}
													</p>
												</div>

												<div className='mb-3'>
													<p className='text-sm text-gray-500 mb-1'>Employer</p>
													<p className='font-medium'>{application.employer}</p>
												</div>

												<div>
													<p className='text-sm text-gray-500 mb-1 flex items-center'>
														<Calendar
															size={14}
															className='mr-1 text-gray-400'
														/>
														Employment Duration
													</p>
													<p className='font-medium'>
														{formatEmploymentDuration(
															application.employment_duration,
														)}
													</p>
												</div>
											</div>
										</div>
									</div>

									{application.notes && (
										<div className='mb-6'>
											<h3 className='text-sm font-medium text-gray-500 mb-2 flex items-center'>
												<FileText size={16} className='mr-1 text-blue-500' />
												Notes
											</h3>
											<div className='bg-gray-50 p-4 rounded-lg'>
												<p className='text-gray-700'>{application.notes}</p>
											</div>
										</div>
									)}

									<div className='flex flex-col md:flex-row justify-between items-center'>
										<div className='flex space-x-3 mb-4 md:mb-0'>
											{application.status === 'pending' && (
												<>
													<Button
														variant='primary'
														size='sm'
														onClick={() =>
															handleStatusChange(
																application.id,
																'approved',
																'Application approved after review.',
															)
														}
													>
														<CheckCircle size={16} className='mr-1' />
														Approve
													</Button>
													<Button
														variant='danger'
														size='sm'
														onClick={() =>
															handleStatusChange(
																application.id,
																'rejected',
																'Application rejected after review.',
															)
														}
													>
														<XCircle size={16} className='mr-1' />
														Reject
													</Button>
												</>
											)}
											{application.status !== 'pending' && (
												<Button
													variant='outline'
													size='sm'
													onClick={() =>
														handleStatusChange(application.id, 'pending')
													}
												>
													<Clock size={16} className='mr-1' />
													Mark as Pending
												</Button>
											)}
										</div>

										<Link to={`/agent/screening/${application.tenant_id}`}>
											<Button variant='outline' size='sm'>
												View Screening Report
												<ArrowRight size={16} className='ml-1' />
											</Button>
										</Link>
									</div>
								</CardContent>
							</Card>
						);
					})}
				</div>
			) : (
				<Card>
					<CardContent className='p-6 text-center'>
						<FileText className='h-12 w-12 text-gray-300 mx-auto mb-4' />
						<p className='text-gray-500'>No applications found</p>
						<p className='text-sm text-gray-400 mt-1'>
							{statusFilter !== 'all'
								? `No ${statusFilter} applications available`
								: propertyFilter !== 'all'
								? 'No applications for this property'
								: searchTerm
								? 'No applications match your search criteria'
								: 'No applications have been submitted yet'}
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
};

export default ReviewApplications;
