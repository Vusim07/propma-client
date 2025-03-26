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
} from 'lucide-react';
import { showToast } from '../../utils/toast';

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
		} catch (err: any) {
			showToast.error('Failed to update application status');
			setError(
				`Failed to update application status. Please try again: ${err.message}`,
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

			// In a real app, we would search through tenant name, property address, etc.
			// For MVP, we'll just search through the IDs
			return (
				app.id.includes(searchTerm) ||
				app.tenant_id.includes(searchTerm) ||
				app.property_id.includes(searchTerm)
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
				<p className='text-gray-600 mt-1'>
					Manage and review tenant applications
				</p>
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
					{filteredApplications.map((application) => (
						<Card key={application.id}>
							<CardContent className='p-6'>
								<div className='flex flex-col md:flex-row justify-between mb-4'>
									<div>
										<h2 className='text-lg font-semibold mb-1'>
											Application #{application.id}
										</h2>
										<p className='text-gray-600'>
											Submitted on{' '}
											{new Date(application.submitted_at).toLocaleDateString()}
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
										<h3 className='text-sm font-medium text-gray-500 mb-2'>
											Tenant Information
										</h3>
										<div className='bg-gray-50 p-4 rounded-lg'>
											<div className='mb-2'>
												<p className='text-sm text-gray-500'>Tenant ID</p>
												<p className='font-medium'>#{application.tenant_id}</p>
											</div>
											<div>
												<p className='text-sm text-gray-500'>Contact</p>
												<p className='font-medium'>tenant@example.com</p>
											</div>
										</div>
									</div>

									<div>
										<h3 className='text-sm font-medium text-gray-500 mb-2'>
											Property Information
										</h3>
										<div className='bg-gray-50 p-4 rounded-lg'>
											<div className='mb-2'>
												<p className='text-sm text-gray-500'>Property ID</p>
												<p className='font-medium'>
													#{application.property_id}
												</p>
											</div>
											<div>
												<p className='text-sm text-gray-500'>Address</p>
												<p className='font-medium'>
													{getPropertyAddress(application.property_id)}
												</p>
											</div>
										</div>
									</div>
								</div>

								{application.notes && (
									<div className='mb-6'>
										<h3 className='text-sm font-medium text-gray-500 mb-2'>
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
					))}
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
