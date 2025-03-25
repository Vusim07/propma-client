import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useAgentStore } from '../../stores/agentStore';
import { usePageTitle } from '../../context/PageTitleContext';
import { Card, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import {
	Home,
	Plus,
	Search,
	Bed,
	Bath,
	Square as SquareFoot,
	DollarSign,
	Calendar,
	Copy,
	Check,
	ArrowUpDown,
} from 'lucide-react';
import { Tables } from '../../services/database.types';

// Define proper property view model type
interface PropertyViewModel {
	id: string;
	address: string;
	city: string;
	state: string;
	zip: string;
	status: 'available' | 'rented' | 'maintenance' | 'inactive';
	rent: number; // Used for UI display
	monthly_rent: number; // From database
	bedrooms: number;
	bathrooms: number;
	square_feet: number;
	images: string[];
	available_from: string;
	created_at: string;
	updated_at: string;
	application_link?: string;
	description?: string;
}

// Type definition for the status filter
type StatusFilter = 'all' | 'available' | 'rented' | 'maintenance' | 'inactive';

// Map database property to view model
const mapPropertyToViewModel = (
	property: Tables<'properties'>,
): PropertyViewModel => {
	return {
		...property,
		status: (property.status || 'available') as
			| 'available'
			| 'rented'
			| 'maintenance'
			| 'inactive',
		rent: property.monthly_rent || 0,
		images: property.images || [],
		state: property.province || '',
		zip: property.postal_code || '',
		description: '',
		square_feet: 0, // Add default if not in database
	};
};

const PropertyManagement: React.FC = () => {
	const { user } = useAuthStore();
	const { setPageTitle } = usePageTitle();
	const { properties, fetchProperties, isLoading, error } = useAgentStore();
	const navigate = useNavigate();

	const [searchTerm, setSearchTerm] = useState('');
	const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
	const [sortBy, setSortBy] = useState<'address' | 'rent' | 'date'>('date');
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
	const [copiedLink, setCopiedLink] = useState<string | null>(null);
	const [viewProperties, setViewProperties] = useState<PropertyViewModel[]>([]);

	useEffect(() => {
		setPageTitle('Properties');
		if (user) {
			fetchProperties(user.id);
		}
	}, [user, fetchProperties, setPageTitle]);

	// Convert properties to view model when they change
	useEffect(() => {
		const mappedProperties = properties.map(mapPropertyToViewModel);
		setViewProperties(mappedProperties);
	}, [properties]);

	const handleCopyLink = (link: string) => {
		navigator.clipboard.writeText(link);
		setCopiedLink(link);
		setTimeout(() => setCopiedLink(null), 2000);
	};

	const filteredProperties = viewProperties
		.filter(
			(property) => statusFilter === 'all' || property.status === statusFilter,
		)
		.filter(
			(property) =>
				property.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				property.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				(property.description || '')
					.toLowerCase()
					.includes(searchTerm.toLowerCase()),
		)
		.sort((a, b) => {
			if (sortBy === 'address') {
				return sortOrder === 'asc'
					? (a.address || '').localeCompare(b.address || '')
					: (b.address || '').localeCompare(a.address || '');
			} else if (sortBy === 'rent') {
				return sortOrder === 'asc' ? a.rent - b.rent : b.rent - a.rent;
			} else {
				// Default sort by date
				return sortOrder === 'asc'
					? new Date(a.created_at || 0).getTime() -
							new Date(b.created_at || 0).getTime()
					: new Date(b.created_at || 0).getTime() -
							new Date(a.created_at || 0).getTime();
			}
		});

	const toggleSortOrder = () => {
		setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
	};

	const getStatusBadgeVariant = (
		status: PropertyViewModel['status'],
	): string => {
		switch (status) {
			case 'available':
				return 'success';
			case 'rented':
				return 'info';
			case 'maintenance':
				return 'warning';
			case 'inactive':
				return 'danger';
			default:
				return 'default';
		}
	};

	return (
		<div>
			<div className='mb-6 flex flex-col md:flex-row md:items-center md:justify-between'>
				<div>
					<h1 className='text-2xl font-bold text-gray-900'>
						Property Management
					</h1>
					<p className='text-gray-600 mt-1'>
						Manage your rental properties and listings
					</p>
				</div>
				<div className='mt-4 md:mt-0'>
					<Button onClick={() => navigate('/agent/properties/new')}>
						<Plus size={16} className='mr-2' />
						Add New Property
					</Button>
				</div>
			</div>

			{error && (
				<Alert variant='error' className='mb-6'>
					{error}
				</Alert>
			)}

			{/* Filters and Search */}
			<div className='mb-6 bg-white p-4 rounded-lg shadow-sm'>
				<div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
					<div className='flex flex-wrap gap-2'>
						<Button
							variant={statusFilter === 'all' ? 'primary' : 'outline'}
							size='sm'
							onClick={() => setStatusFilter('all')}
						>
							All
						</Button>
						<Button
							variant={statusFilter === 'available' ? 'primary' : 'outline'}
							size='sm'
							onClick={() => setStatusFilter('available')}
						>
							Available
						</Button>
						<Button
							variant={statusFilter === 'rented' ? 'primary' : 'outline'}
							size='sm'
							onClick={() => setStatusFilter('rented')}
						>
							Rented
						</Button>
						<Button
							variant={statusFilter === 'maintenance' ? 'primary' : 'outline'}
							size='sm'
							onClick={() => setStatusFilter('maintenance')}
						>
							Maintenance
						</Button>
						<Button
							variant={statusFilter === 'inactive' ? 'primary' : 'outline'}
							size='sm'
							onClick={() => setStatusFilter('inactive')}
						>
							Inactive
						</Button>
					</div>

					<div className='flex items-center gap-2'>
						<div className='relative flex-1'>
							<div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
								<Search size={16} className='text-gray-400' />
							</div>
							<input
								type='text'
								placeholder='Search properties...'
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className='pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
							/>
						</div>

						<div className='flex items-center gap-2'>
							<select
								value={sortBy}
								onChange={(e) =>
									setSortBy(e.target.value as 'address' | 'rent' | 'date')
								}
								className='border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
								aria-label='Sort by'
							>
								<option value='date'>Date Added</option>
								<option value='address'>Address</option>
								<option value='rent'>Rent</option>
							</select>

							<Button
								variant='outline'
								size='sm'
								onClick={toggleSortOrder}
								className='flex items-center'
							>
								<ArrowUpDown size={16} className='mr-1' />
								{sortOrder === 'asc' ? 'Asc' : 'Desc'}
							</Button>
						</div>
					</div>
				</div>
			</div>

			{/* Properties List */}
			{isLoading ? (
				<div className='flex justify-center py-8'>
					<Spinner size='lg' />
				</div>
			) : filteredProperties.length > 0 ? (
				<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
					{filteredProperties.map((property) => (
						<Card key={property.id} className='overflow-hidden'>
							<div className='relative h-48 overflow-hidden'>
								{property.images && property.images.length > 0 ? (
									<img
										src={property.images[0]}
										alt={property.address}
										className='w-full h-full object-cover'
									/>
								) : (
									<div className='w-full h-full bg-gray-200 flex items-center justify-center'>
										<Home size={48} className='text-gray-400' />
									</div>
								)}
								<div className='absolute top-2 right-2'>
									<Badge variant={getStatusBadgeVariant(property.status)}>
										{property.status.charAt(0).toUpperCase() +
											property.status.slice(1)}
									</Badge>
								</div>
							</div>

							<CardContent className='p-4'>
								<div className='mb-2'>
									<h3 className='text-lg font-semibold truncate'>
										{property.address}
									</h3>
									<p className='text-gray-600 text-sm'>
										{property.city}, {property.state} {property.zip}
									</p>
								</div>

								<div className='flex items-center justify-between mb-4'>
									<div className='flex items-center text-gray-700'>
										<DollarSign size={16} className='mr-1' />
										<span className='font-semibold'>
											R{property.rent.toLocaleString()}
										</span>
										<span className='text-gray-500 text-sm'>/month</span>
									</div>
									<div className='flex items-center space-x-3 text-gray-600 text-sm'>
										<div className='flex items-center'>
											<Bed size={14} className='mr-1' />
											{property.bedrooms}
										</div>
										<div className='flex items-center'>
											<Bath size={14} className='mr-1' />
											{property.bathrooms}
										</div>
										<div className='flex items-center'>
											<SquareFoot size={14} className='mr-1' />
											{property.square_feet}
										</div>
									</div>
								</div>

								<div className='mb-4'>
									<div className='flex items-center text-sm text-gray-600 mb-1'>
										<Calendar size={14} className='mr-1' />
										Available from:{' '}
										{new Date(property.available_from).toLocaleDateString()}
									</div>

									{property.application_link && (
										<div className='flex items-center mt-2'>
											<div className='text-sm text-gray-600 truncate flex-1'>
												Application Link:{' '}
												<span className='font-mono text-xs'>
													{property.application_link.substring(0, 25)}...
												</span>
											</div>
											<button
												onClick={() =>
													handleCopyLink(property.application_link || '')
												}
												className='ml-2 p-1 text-gray-500 hover:text-blue-500'
												title='Copy application link'
											>
												{copiedLink === property.application_link ? (
													<Check size={16} className='text-green-500' />
												) : (
													<Copy size={16} />
												)}
											</button>
										</div>
									)}
								</div>

								<div className='flex space-x-2'>
									<Link
										to={`/agent/properties/${property.id}`}
										className='flex-1'
									>
										<Button variant='outline' size='sm' className='w-full'>
											View Details
										</Button>
									</Link>
									<Link
										to={`/agent/properties/${property.id}/edit`}
										className='flex-1'
									>
										<Button variant='primary' size='sm' className='w-full'>
											Edit
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
						<Home className='h-12 w-12 text-gray-300 mx-auto mb-4' />
						<p className='text-gray-500'>No properties found</p>
						<p className='text-sm text-gray-400 mt-1'>
							{statusFilter !== 'all'
								? `No ${statusFilter} properties available`
								: searchTerm
								? 'No properties match your search criteria'
								: 'Add your first property to get started'}
						</p>
						{properties.length === 0 && (
							<Button
								variant='primary'
								className='mt-4'
								onClick={() => navigate('/agent/properties/new')}
							>
								<Plus size={16} className='mr-2' />
								Add Your First Property
							</Button>
						)}
					</CardContent>
				</Card>
			)}
		</div>
	);
};

export default PropertyManagement;
