import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useAgentStore } from '../../store/agentStore';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import Spinner from '../../components/ui/Spinner';
import {
	Home,
	MapPin,
	Calendar,
	DollarSign,
	Bed,
	Bath,
	Square,
	CheckSquare,
	Copy,
	Check,
	ArrowLeft,
	Edit,
	Trash2,
} from 'lucide-react';
import { Property } from '../../types';
import { showToast } from '../../utils/toast';

const PropertyDetail: React.FC = () => {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const { user } = useAuthStore();
	const {
		properties,
		fetchProperties,
		deleteProperty,
		generateApplicationLink,
		isLoading,
	} = useAgentStore();

	const [property, setProperty] = useState<Property | null>(null);
	const [error, setError] = useState('');
	const [copiedLink, setCopiedLink] = useState(false);

	useEffect(() => {
		if (user) {
			fetchProperties(user.id);
		}
	}, [user, fetchProperties]);

	useEffect(() => {
		if (id && properties.length > 0) {
			const foundProperty = properties.find((p) => p.id === id);
			if (foundProperty) {
				setProperty(foundProperty);
			} else {
				setError('Property not found');
			}
		}
	}, [id, properties]);

	const handleDelete = async () => {
		if (!property) return;

		if (
			window.confirm(
				'Are you sure you want to delete this property? This action cannot be undone.',
			)
		) {
			try {
				await deleteProperty(property.id);
				showToast.success('Property deleted successfully');
				navigate('/agent/properties');
			} catch (err) {
				showToast.error(`Failed to delete property: ${err.message}`);
			}
		}
	};

	const handleGenerateLink = async () => {
		if (!property) return;

		try {
			const link = await generateApplicationLink(property.id);
			showToast.success('Application link generated successfully');
			setProperty((prev) =>
				prev ? { ...prev, application_link: link } : null,
			);
		} catch (err) {
			showToast.error(`Failed to generate application link: ${err.message}`);
		}
	};

	const handleCopyLink = () => {
		if (!property?.application_link) return;

		navigator.clipboard.writeText(property.application_link);
		setCopiedLink(true);
		showToast.success('Link copied to clipboard');

		setTimeout(() => setCopiedLink(false), 2000);
	};

	if (isLoading) {
		return (
			<div className='flex justify-center items-center h-64'>
				<Spinner size='lg' />
			</div>
		);
	}

	if (error || !property) {
		return (
			<div className='mb-6'>
				<Button
					variant='outline'
					size='sm'
					onClick={() => navigate('/agent/properties')}
					className='mb-4'
				>
					<ArrowLeft size={16} className='mr-2' />
					Back to Properties
				</Button>
				<Alert variant='error'>{error || 'Property not found'}</Alert>
			</div>
		);
	}

	return (
		<div>
			<div className='mb-6'>
				<Button
					variant='outline'
					size='sm'
					onClick={() => navigate('/agent/properties')}
					className='mb-4'
				>
					<ArrowLeft size={16} className='mr-2' />
					Back to Properties
				</Button>

				<div className='flex items-center justify-between'>
					<div>
						<h1 className='text-2xl font-bold text-gray-900'>
							{property.address}
						</h1>
						<p className='text-gray-600 mt-1'>
							{property.city}, {property.state} {property.zip}
						</p>
					</div>
					<Badge
						variant={
							property.status === 'available'
								? 'success'
								: property.status === 'rented'
								? 'info'
								: property.status === 'maintenance'
								? 'warning'
								: 'danger'
						}
					>
						{property.status.charAt(0).toUpperCase() + property.status.slice(1)}
					</Badge>
				</div>
			</div>

			{/* Property Images */}
			<div className='mb-8'>
				{property.images && property.images.length > 0 ? (
					<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
						{property.images.map((image, index) => (
							<img
								key={index}
								src={image}
								alt={`Property ${index + 1}`}
								className='w-full h-64 object-cover rounded-lg'
							/>
						))}
					</div>
				) : (
					<div className='bg-gray-100 h-64 rounded-lg flex items-center justify-center'>
						<Home size={48} className='text-gray-400' />
					</div>
				)}
			</div>

			{/* Quick Stats */}
			<div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-8'>
				<Card>
					<CardContent className='p-4'>
						<div className='flex items-center justify-between'>
							<div>
								<p className='text-sm text-gray-500'>Monthly Rent</p>
								<p className='text-xl font-bold'>
									R{property.rent.toLocaleString()}
								</p>
							</div>
							<DollarSign className='h-8 w-8 text-blue-500' />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className='p-4'>
						<div className='flex items-center justify-between'>
							<div>
								<p className='text-sm text-gray-500'>Bedrooms</p>
								<p className='text-xl font-bold'>{property.bedrooms}</p>
							</div>
							<Bed className='h-8 w-8 text-blue-500' />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className='p-4'>
						<div className='flex items-center justify-between'>
							<div>
								<p className='text-sm text-gray-500'>Bathrooms</p>
								<p className='text-xl font-bold'>{property.bathrooms}</p>
							</div>
							<Bath className='h-8 w-8 text-blue-500' />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className='p-4'>
						<div className='flex items-center justify-between'>
							<div>
								<p className='text-sm text-gray-500'>Square Feet</p>
								<p className='text-xl font-bold'>{property.square_feet}</p>
							</div>
							<Square className='h-8 w-8 text-blue-500' />
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Property Details */}
			<div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-8'>
				<Card>
					<CardHeader>
						<h2 className='text-lg font-semibold'>Property Details</h2>
					</CardHeader>
					<CardContent>
						<div className='space-y-4'>
							<div>
								<p className='text-sm text-gray-500'>Property Type</p>
								<p className='font-medium capitalize'>
									{property.property_type.replace('_', ' ')}
								</p>
							</div>

							<div>
								<p className='text-sm text-gray-500'>Address</p>
								<div className='flex items-start'>
									<MapPin size={16} className='text-gray-400 mr-2 mt-1' />
									<p className='font-medium'>
										{property.address}
										<br />
										{property.city}, {property.state} {property.zip}
									</p>
								</div>
							</div>

							<div>
								<p className='text-sm text-gray-500'>Available From</p>
								<div className='flex items-center'>
									<Calendar size={16} className='text-gray-400 mr-2' />
									<p className='font-medium'>
										{new Date(property.available_from).toLocaleDateString()}
									</p>
								</div>
							</div>

							<div>
								<p className='text-sm text-gray-500'>Description</p>
								<p className='mt-1'>{property.description}</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<h2 className='text-lg font-semibold'>Amenities</h2>
					</CardHeader>
					<CardContent>
						{property.amenities && property.amenities.length > 0 ? (
							<div className='grid grid-cols-2 gap-2'>
								{property.amenities.map((amenity, index) => (
									<div key={index} className='flex items-center'>
										<CheckSquare size={16} className='text-green-500 mr-2' />
										<span>{amenity}</span>
									</div>
								))}
							</div>
						) : (
							<p className='text-gray-500'>No amenities listed</p>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Application Link */}
			<Card className='mb-8'>
				<CardHeader>
					<h2 className='text-lg font-semibold'>Application Link</h2>
				</CardHeader>
				<CardContent>
					{property.application_link ? (
						<div className='flex items-center justify-between bg-gray-50 p-4 rounded-lg'>
							<div className='flex-1 font-mono text-sm truncate mr-4'>
								{property.application_link}
							</div>
							<Button variant='outline' size='sm' onClick={handleCopyLink}>
								{copiedLink ? (
									<Check size={16} className='mr-2' />
								) : (
									<Copy size={16} className='mr-2' />
								)}
								{copiedLink ? 'Copied!' : 'Copy Link'}
							</Button>
						</div>
					) : (
						<div className='text-center py-6'>
							<p className='text-gray-500 mb-4'>
								No application link generated yet
							</p>
							<Button onClick={handleGenerateLink}>
								Generate Application Link
							</Button>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Actions */}
			<div className='flex justify-end space-x-4'>
				<Button variant='outline' onClick={handleDelete}>
					<Trash2 size={16} className='mr-2' />
					Delete Property
				</Button>
				<Link to={`/agent/properties/${property.id}/edit`}>
					<Button variant='primary'>
						<Edit size={16} className='mr-2' />
						Edit Property
					</Button>
				</Link>
			</div>
		</div>
	);
};

export default PropertyDetail;
