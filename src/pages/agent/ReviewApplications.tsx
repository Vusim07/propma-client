/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; // Re-add Link import
import { useAuthStore } from '../../stores/authStore';
import { useAgentStore } from '../../stores/agentStore';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/Table';
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
	SheetClose, // Keep SheetClose for the footer button
	SheetFooter, // Keep SheetFooter
	SheetDescription,
} from '@/components/ui/sheet';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import Badge from '@/components/ui/Badge';
import Alert from '@/components/ui/Alert';
import { usePageTitle } from '../../context/PageTitleContext';

import {
	FileText,
	CheckCircle,
	XCircle,
	Clock,
	Search,
	ArrowRight, // Keep ArrowRight for the link button
	Home,
	User,
	Phone,
	Mail,
	MapPin,
	Briefcase,
	DollarSign,
	Calendar,
	Eye,
} from 'lucide-react';
import { showToast } from '../../utils/toast';
import { formatCurrency } from '../../utils/formatters';
// Removed unused cn import

interface TenantProfile {
	first_name?: string;
	last_name?: string;
	phone?: string | null;
	email?: string;
	current_address?: string;
}

interface Property {
	monthly_rent?: number;
}

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

const formatPhoneNumber = (phone: string | null): string => {
	if (!phone) return 'Not provided';
	const digits = phone.replace(/\D/g, '');
	if (digits.startsWith('27')) {
		const mobile = digits.slice(2);
		if (mobile.length === 9) {
			return `+27 ${mobile.slice(0, 2)} ${mobile.slice(2, 5)} ${mobile.slice(
				5,
			)}`;
		}
	}
	if (digits.startsWith('0')) {
		if (digits.length === 10) {
			return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
		}
	}
	return phone;
};

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

const formatDate = (dateString: string | undefined): string => {
	if (!dateString) return 'N/A';
	try {
		const date = new Date(dateString);
		const day = String(date.getDate()).padStart(2, '0');
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const year = date.getFullYear();
		return `${day}/${month}/${year}`;
	} catch (error) {
		// Changed variable name from e to error
		console.error('Error formatting date:', error); // Added console log for the error
		return 'Invalid Date';
	}
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
	const [selectedApplication, setSelectedApplication] =
		useState<EnhancedApplication | null>(null);
	const [isSheetOpen, setIsSheetOpen] = useState(false);

	useEffect(() => {
		if (user) {
			setPageTitle('Prospects');
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
			if (selectedApplication?.id === applicationId) {
				setSelectedApplication((prev) =>
					prev ? { ...prev, status: status } : null,
				);
			}
			setTimeout(() => setSuccess(''), 3000);
		} catch (err: unknown) {
			const errorMessage =
				err instanceof Error ? err.message : 'Unknown error occurred';
			showToast.error('Failed to update application status');
			setError(
				`Failed to update application status. Please try again: ${errorMessage}`,
			);
			setTimeout(() => setError(''), 3000);
		}
	};

	const filteredApplications = applications
		.map((app) => app as EnhancedApplication)
		.filter((app) => statusFilter === 'all' || app.status === statusFilter)
		.filter(
			(app) => propertyFilter === 'all' || app.property_id === propertyFilter,
		)
		.filter((app) => {
			if (!searchTerm) return true;
			const tenantProfile = app.tenant_profiles;
			const fullName = tenantProfile
				? `${tenantProfile.first_name || ''} ${
						tenantProfile.last_name || ''
				  }`.toLowerCase()
				: '';
			const propertyAddress = getPropertyAddress(app.property_id).toLowerCase();

			return (
				app.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
				(tenantProfile?.email &&
					tenantProfile.email
						.toLowerCase()
						.includes(searchTerm.toLowerCase())) ||
				fullName.includes(searchTerm.toLowerCase()) ||
				propertyAddress.includes(searchTerm.toLowerCase())
			);
		});

	const getPropertyAddress = (propertyId: string) => {
		const property = properties.find((p) => p.id === propertyId);
		return property
			? `${property.address}, ${property.city}`
			: 'Unknown property';
	};

	const handleViewApplication = (application: EnhancedApplication) => {
		setSelectedApplication(application);
		setIsSheetOpen(true);
	};

	return (
		<Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
			<div>
				<div className='mb-6'>
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
									placeholder='Search name, email, property...'
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									className='pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
								/>
							</div>
						</div>
					</div>

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

				{isLoading ? (
					<div className='flex justify-center py-8'>
						<Spinner size='lg' />
					</div>
				) : (
					<div className='bg-white rounded-lg shadow-sm overflow-hidden'>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Applicant</TableHead>
									<TableHead>Property</TableHead>
									<TableHead>Submitted</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className='text-right'>Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredApplications.length > 0 ? (
									filteredApplications.map((application) => {
										const tenantProfile = application.tenant_profiles || {};
										const fullName = `${tenantProfile.first_name || ''} ${
											tenantProfile.last_name || ''
										}`.trim();

										return (
											<TableRow key={application.id}>
												<TableCell>
													<div className='font-medium'>{fullName || 'N/A'}</div>
													<div className='text-sm text-gray-500'>
														{tenantProfile.email || 'No email'}
													</div>
												</TableCell>
												<TableCell>
													{getPropertyAddress(application.property_id)}
												</TableCell>
												<TableCell>
													{formatDate(
														application.submitted_at || application.created_at,
													)}
												</TableCell>
												<TableCell>
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
												</TableCell>
												<TableCell className='text-right'>
													<SheetTrigger asChild>
														<Button
															variant='outline'
															size='sm'
															onClick={() => handleViewApplication(application)}
														>
															<Eye size={16} className='mr-1' />
															View
														</Button>
													</SheetTrigger>
												</TableCell>
											</TableRow>
										);
									})
								) : (
									<TableRow>
										<TableCell
											colSpan={5}
											className='h-24 text-center text-gray-500'
										>
											<FileText className='h-8 w-8 text-gray-300 mx-auto mb-2' />
											No applications found.
											<p className='text-sm text-gray-400 mt-1'>
												{statusFilter !== 'all'
													? `No ${statusFilter} applications available.`
													: propertyFilter !== 'all'
													? 'No applications for this property.'
													: searchTerm
													? 'No applications match your search criteria.'
													: 'No applications have been submitted yet.'}
											</p>
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>
				)}
			</div>

			<SheetContent className='w-full sm:max-w-2xl overflow-y-auto bg-white'>
				{selectedApplication && (
					<>
						<SheetHeader className='mb-6'>
							<SheetTitle>
								Application Details - #{selectedApplication.id.substring(0, 8)}
							</SheetTitle>
							<SheetDescription>
								Review the details for this application. Submitted on{' '}
								{formatDate(
									selectedApplication.submitted_at ||
										selectedApplication.created_at,
								)}
							</SheetDescription>
						</SheetHeader>

						<div className='space-y-6 px-1 pb-6'>
							<div className='flex justify-end'>
								<Badge
									variant={
										selectedApplication.status === 'approved'
											? 'success'
											: selectedApplication.status === 'rejected'
											? 'danger'
											: 'warning'
									}
								>
									{selectedApplication.status.toUpperCase()}
								</Badge>
							</div>

							<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
								<div>
									<h3 className='text-sm font-medium text-gray-500 mb-2 flex items-center'>
										<User size={16} className='mr-1 text-blue-500' />
										Tenant Information
									</h3>
									<div className='bg-gray-50 p-4 rounded-lg space-y-3'>
										{selectedApplication.tenant_profiles ? (
											<>
												<div>
													<p className='text-xs text-gray-500 mb-0.5'>Name</p>
													<p className='font-medium text-sm'>
														{selectedApplication.tenant_profiles.first_name}{' '}
														{selectedApplication.tenant_profiles.last_name}
													</p>
												</div>
												<div>
													<p className='text-xs text-gray-500 mb-0.5 flex items-center'>
														<Phone size={12} className='mr-1 text-gray-400' />
														Phone
													</p>
													<p className='font-medium text-sm'>
														{formatPhoneNumber(
															selectedApplication.tenant_profiles.phone as any,
														)}
													</p>
												</div>
												<div>
													<p className='text-xs text-gray-500 mb-0.5 flex items-center'>
														<Mail size={12} className='mr-1 text-gray-400' />
														Email
													</p>
													<p className='font-medium text-sm'>
														{selectedApplication.tenant_profiles.email}
													</p>
												</div>
												<div>
													<p className='text-xs text-gray-500 mb-0.5 flex items-center'>
														<MapPin size={12} className='mr-1 text-gray-400' />
														Current Address
													</p>
													<p className='font-medium text-sm'>
														{selectedApplication.tenant_profiles
															.current_address || 'Not provided'}
													</p>
												</div>
											</>
										) : (
											<p className='text-gray-500 italic text-sm'>
												Tenant profile information not available
											</p>
										)}
									</div>
								</div>

								<div className='space-y-4'>
									<div>
										<h3 className='text-sm font-medium text-gray-500 mb-2 flex items-center'>
											<Home size={16} className='mr-1 text-blue-500' />
											Property Information
										</h3>
										<div className='bg-gray-50 p-4 rounded-lg space-y-3'>
											<div>
												<p className='text-xs text-gray-500 mb-0.5'>Property</p>
												<p className='font-medium text-sm'>
													{getPropertyAddress(selectedApplication.property_id)}
												</p>
											</div>
											{selectedApplication.properties && (
												<div>
													<p className='text-xs text-gray-500 mb-0.5'>
														Monthly Rent
													</p>
													<p className='font-medium text-sm text-green-600'>
														{formatCurrency(
															selectedApplication.properties.monthly_rent || 0,
														)}
													</p>
												</div>
											)}
										</div>
									</div>

									<div>
										<h3 className='text-sm font-medium text-gray-500 mb-2 flex items-center'>
											<Briefcase size={16} className='mr-1 text-blue-500' />
											Financial Information
										</h3>
										<div className='bg-gray-50 p-4 rounded-lg space-y-3'>
											<div>
												<p className='text-xs text-gray-500 mb-0.5 flex items-center'>
													<DollarSign
														size={12}
														className='mr-1 text-gray-400'
													/>
													Monthly Income
												</p>
												<p className='font-medium text-sm text-green-600'>
													{formatCurrency(selectedApplication.monthly_income)}
												</p>
											</div>
											<div>
												<p className='text-xs text-gray-500 mb-0.5'>Employer</p>
												<p className='font-medium text-sm'>
													{selectedApplication.employer}
												</p>
											</div>
											<div>
												<p className='text-xs text-gray-500 mb-0.5 flex items-center'>
													<Calendar size={12} className='mr-1 text-gray-400' />
													Employment Duration
												</p>
												<p className='font-medium text-sm'>
													{formatEmploymentDuration(
														selectedApplication.employment_duration,
													)}
												</p>
											</div>
										</div>
									</div>
								</div>
							</div>

							{selectedApplication.notes && (
								<div>
									<h3 className='text-sm font-medium text-gray-500 mb-2 flex items-center'>
										<FileText size={16} className='mr-1 text-blue-500' />
										Notes
									</h3>
									<div className='bg-gray-50 p-4 rounded-lg'>
										<p className='text-gray-700 text-sm'>
											{selectedApplication.notes}
										</p>
									</div>
								</div>
							)}

							<div className='flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t'>
								<div className='flex space-x-3'>
									{selectedApplication.status === 'pending' && (
										<>
											<Button
												variant='primary'
												size='sm'
												onClick={() =>
													handleStatusChange(
														selectedApplication.id,
														'approved',
														'Application approved via details view.',
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
														selectedApplication.id,
														'rejected',
														'Application rejected via details view.',
													)
												}
											>
												<XCircle size={16} className='mr-1' />
												Reject
											</Button>
										</>
									)}
									{selectedApplication.status !== 'pending' && (
										<Button
											variant='outline'
											size='sm'
											onClick={() =>
												handleStatusChange(selectedApplication.id, 'pending')
											}
										>
											<Clock size={16} className='mr-1' />
											Mark as Pending
										</Button>
									)}
								</div>
								<Link to={`/agent/screening/${selectedApplication.id}`}>
									<Button variant='outline' size='sm'>
										View Full Screening Report
										<ArrowRight size={16} className='ml-1' />
									</Button>
								</Link>
							</div>
						</div>

						<SheetFooter className='mt-auto'>
							<SheetClose asChild>
								<Button variant='outline'>Close</Button>
							</SheetClose>
						</SheetFooter>
					</>
				)}
				{!selectedApplication && (
					<div className='flex items-center justify-center h-full'>
						<p className='text-gray-500'>No application selected.</p>
					</div>
				)}
			</SheetContent>
		</Sheet>
	);
};

export default ReviewApplications;
