import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useAgentStore } from '../../stores/agentStore';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import Alert from '../../components/ui/Alert';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { Property } from '../../types';
import { showToast } from '../../utils/toast';

const PropertyForm: React.FC = () => {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const { user } = useAuthStore();
	const {
		properties,
		fetchProperties,
		addProperty,
		updateProperty,
		isLoading,
		error,
	} = useAgentStore();

	const [formData, setFormData] = useState<
		Omit<Property, 'id' | 'created_at' | 'application_link'>
	>({
		agent_id: user?.id || '',
		address: '',
		city: '',
		province: '',
		postal_code: '',
		monthly_rent: 0,
		bedrooms: 1,
		bathrooms: 1,
		square_feet: 0,
		available_from: new Date().toISOString().split('T')[0],
		description: '',
		status: 'available',
		property_type: 'apartment',
		amenities: [],
		images: [],
		suburb: '',
		deposit_amount: 0,
	});

	const [amenity, setAmenity] = useState('');
	const [imageUrl, setImageUrl] = useState('');
	const [formError, setFormError] = useState('');
	const [isEditMode, setIsEditMode] = useState(false);

	useEffect(() => {
		if (user) {
			fetchProperties(user.id);
		}
	}, [user, fetchProperties]);

	useEffect(() => {
		if (id && properties.length > 0) {
			const propertyToEdit = properties.find((p) => p.id === id);
			if (propertyToEdit) {
				setIsEditMode(true);

				// Format the date to YYYY-MM-DD for the input
				const formattedDate = new Date(propertyToEdit.available_from)
					.toISOString()
					.split('T')[0];

				setFormData({
					agent_id: propertyToEdit.agent_id,
					address: propertyToEdit.address,
					city: propertyToEdit.city,
					province: propertyToEdit.province,
					postal_code: propertyToEdit.postal_code,
					monthly_rent: propertyToEdit.monthly_rent,
					bedrooms: propertyToEdit.bedrooms,
					bathrooms: propertyToEdit.bathrooms,
					square_feet: propertyToEdit.square_feet,
					available_from: formattedDate,
					description: propertyToEdit.description,
					status: propertyToEdit.status,
					property_type: propertyToEdit.property_type,
					amenities: propertyToEdit.amenities || [],
					images: propertyToEdit.images || [],
					suburb: propertyToEdit.suburb,
					deposit_amount: propertyToEdit.deposit_amount,
				});
			}
		}
	}, [id, properties]);

	const handleInputChange = (
		e: React.ChangeEvent<
			HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
		>,
	) => {
		const { name, value } = e.target;

		// Handle numeric inputs
		if (
			name === 'monthly_rent' ||
			name === 'bedrooms' ||
			name === 'bathrooms' ||
			name === 'square_feet' ||
			name === 'deposit_amount'
		) {
			setFormData({
				...formData,
				[name]:
					name === 'bedrooms' || name === 'bathrooms'
						? parseInt(value)
						: parseFloat(value),
			});
		} else {
			setFormData({
				...formData,
				[name]: value,
			});
		}
	};

	const handleSelectChange = (name: string, value: string) => {
		setFormData({
			...formData,
			[name]: value,
		});
	};

	const addAmenity = () => {
		if (amenity.trim() && !formData.amenities?.includes(amenity.trim())) {
			setFormData({
				...formData,
				amenities: [...(formData.amenities || []), amenity.trim()],
			});
			setAmenity('');
		}
	};

	const removeAmenity = (index: number) => {
		setFormData({
			...formData,
			amenities: formData.amenities?.filter((_, i) => i !== index),
		});
	};

	const addImage = () => {
		if (imageUrl.trim() && !formData.images?.includes(imageUrl.trim())) {
			setFormData({
				...formData,
				images: [...(formData.images || []), imageUrl.trim()],
			});
			setImageUrl('');
		}
	};

	const removeImage = (index: number) => {
		setFormData({
			...formData,
			images: formData.images?.filter((_, i) => i !== index),
		});
	};

	const validateForm = () => {
		if (!formData.address) {
			setFormError('Address is required');
			return false;
		}
		if (!formData.city) {
			setFormError('City is required');
			return false;
		}
		if (!formData.province) {
			setFormError('Province is required');
			return false;
		}
		if (!formData.postal_code) {
			setFormError('Postal code is required');
			return false;
		}
		if (formData.monthly_rent <= 0) {
			setFormError('Rent must be greater than 0');
			return false;
		}
		if (formData.square_feet <= 0) {
			setFormError('Square feet must be greater than 0');
			return false;
		}

		setFormError('');
		return true;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateForm()) {
			return;
		}

		try {
			if (isEditMode && id) {
				await updateProperty(id, formData);
				showToast.success('Property updated successfully!');
				navigate(`/agent/properties/${id}`);
			} else {
				await addProperty(formData);
				showToast.success('Property added successfully!');
				navigate('/agent/properties');
			}
		} catch (err) {
			console.error('Error saving property:', err);
			setFormError('Failed to save property. Please try again.');
			showToast.error('Failed to save property. Please try again.');
		}
	};

	const propertyTypeOptions = [
		{ value: 'apartment', label: 'Apartment' },
		{ value: 'house', label: 'House' },
		{ value: 'condo', label: 'Condo' },
		{ value: 'townhouse', label: 'Townhouse' },
		{ value: 'other', label: 'Other' },
	];

	const statusOptions = [
		{ value: 'available', label: 'Available' },
		{ value: 'rented', label: 'Rented' },
		{ value: 'maintenance', label: 'Maintenance' },
		{ value: 'inactive', label: 'Inactive' },
	];

	if (isLoading && isEditMode) {
		return (
			<div className='flex justify-center items-center h-64'>
				<Spinner size='lg' />
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

				<h1 className='text-2xl font-bold text-gray-900'>
					{isEditMode ? 'Edit Property' : 'Add New Property'}
				</h1>
				<p className='text-gray-600 mt-1'>
					{isEditMode
						? 'Update the details of your property'
						: 'Fill in the details to add a new rental property'}
				</p>
			</div>

			{(error || formError) && (
				<Alert variant='error' className='mb-6'>
					{formError || error}
				</Alert>
			)}

			<form onSubmit={handleSubmit}>
				<Card className='mb-6'>
					<CardHeader>
						<h2 className='text-lg font-semibold'>Property Details</h2>
					</CardHeader>
					<CardContent>
						<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
							<Input
								placeholder='Address'
								name='address'
								value={formData.address}
								onChange={handleInputChange}
								required
							/>

							<div className='grid grid-cols-3 gap-4'>
								<Input
									placeholder='City'
									name='city'
									value={formData.city}
									onChange={handleInputChange}
									required
								/>

								<Input
									placeholder='Province'
									name='province'
									value={formData.province}
									onChange={handleInputChange}
									required
								/>

								<Input
									placeholder='Postal Code'
									name='postal_code'
									value={formData.postal_code}
									onChange={handleInputChange}
									required
								/>
							</div>

							<div>
								<label
									htmlFor='property_type'
									className='text-sm font-medium text-gray-700 block mb-1'
								>
									Property Type
								</label>
								<Select
									value={formData.property_type}
									onValueChange={(value) =>
										handleSelectChange('property_type', value)
									}
								>
									<SelectTrigger className='w-full'>
										<SelectValue placeholder='Select property type' />
									</SelectTrigger>
									<SelectContent>
										{propertyTypeOptions.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div>
								<label
									htmlFor='status'
									className='text-sm font-medium text-gray-700 block mb-1'
								>
									Status
								</label>
								<Select
									value={formData.status}
									onValueChange={(value) => handleSelectChange('status', value)}
								>
									<SelectTrigger className='w-full'>
										<SelectValue placeholder='Select status' />
									</SelectTrigger>
									<SelectContent>
										{statusOptions.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div>
								<label
									htmlFor='monthly_rent'
									className='text-sm font-medium text-gray-700 block mb-1'
								>
									Montly Rent
								</label>
								<Input
									placeholder='Monthly Rent (R)'
									name='monthly_rent'
									type='number'
									value={formData.monthly_rent.toString()}
									onChange={handleInputChange}
									required
									min='0'
									step='50'
								/>
							</div>

							<div>
								<label
									htmlFor='square_feet'
									className='text-sm font-medium text-gray-700 block mb-1'
								>
									Square Feet
								</label>
								<Input
									name='square_feet'
									type='number'
									value={formData.square_feet.toString()}
									onChange={handleInputChange}
									required
									min='0'
									step='1'
								/>
							</div>
							<div>
								<label
									htmlFor='bedrooms'
									className='text-sm font-medium text-gray-700 block mb-1'
								>
									Bedrooms
								</label>
								<div className='grid grid-cols-2 gap-4'>
									<Input
										placeholder='Bedrooms'
										name='bedrooms'
										type='number'
										value={formData.bedrooms.toString()}
										onChange={handleInputChange}
										required
										min='0'
										step='1'
									/>
								</div>
							</div>

							<div>
								<label
									htmlFor='bathrooms'
									className='text-sm font-medium text-gray-700 block mb-1'
								>
									Bathrooms
								</label>
								<Input
									placeholder='Bathrooms'
									name='bathrooms'
									type='number'
									value={formData.bathrooms.toString()}
									onChange={handleInputChange}
									required
									min='0'
									step='0.5'
								/>
							</div>
							<div>
								<label
									htmlFor='available_from'
									className='text-sm font-medium text-gray-700 block mb-1'
								>
									Available From
								</label>
								<Input
									name='available_from'
									type='date'
									value={formData.available_from}
									onChange={handleInputChange}
									required
								/>
							</div>
						</div>

						<div className='mt-6'>
							<Textarea
								label='Property Description'
								name='description'
								value={formData.description}
								onChange={handleInputChange}
								fullWidth
								required
								rows={4}
							/>
						</div>
					</CardContent>
				</Card>

				<Card className='mb-6'>
					<CardHeader>
						<h2 className='text-lg font-semibold'>Amenities</h2>
					</CardHeader>
					<CardContent>
						<p className='text-sm text-gray-600 mb-4'>
							Add amenities that are included with this property.
						</p>

						<div className='flex space-x-2 mb-4'>
							<Input
								placeholder='e.g., Dishwasher, Parking, etc.'
								value={amenity}
								onChange={(e) => setAmenity(e.target.value)}
								className='flex-1'
							/>
							<Button
								type='button'
								onClick={addAmenity}
								disabled={!amenity.trim()}
							>
								<Plus size={16} className='mr-1' />
								Add
							</Button>
						</div>

						<div className='flex flex-wrap gap-2 mt-4'>
							{formData.amenities?.map((item, index) => (
								<div
									key={index}
									className='bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm flex items-center'
								>
									{item}
									<Button
										onClick={() => removeAmenity(index)}
										className='ml-2 text-blue-500 hover:text-blue-700'
									>
										<X size={14} />
									</Button>
								</div>
							))}
							{formData.amenities?.length === 0 && (
								<p className='text-gray-500 text-sm'>No amenities added yet.</p>
							)}
						</div>
					</CardContent>
				</Card>

				<Card className='mb-6'>
					<CardHeader>
						<h2 className='text-lg font-semibold'>Property Images</h2>
					</CardHeader>
					<CardContent>
						<p className='text-sm text-gray-600 mb-4'>
							Add image URLs for this property. These will be displayed to
							potential tenants.
						</p>

						<div className='flex space-x-2 mb-4'>
							<Input
								placeholder='Enter image URL'
								value={imageUrl}
								onChange={(e) => setImageUrl(e.target.value)}
								className='flex-1'
							/>
							<Button
								type='button'
								onClick={addImage}
								disabled={!imageUrl.trim()}
							>
								<Plus size={16} className='mr-1' />
								Add
							</Button>
						</div>

						<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4'>
							{formData.images?.map((url, index) => (
								<div key={index} className='relative group'>
									<img
										src={url}
										alt={`Property ${index + 1}`}
										className='w-full h-40 object-cover rounded-md'
										onError={(e) => {
											(e.target as HTMLImageElement).src =
												'https://via.placeholder.com/300x200?text=Image+Error';
										}}
									/>
									<Button
										onClick={() => removeImage(index)}
										className='absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity'
									>
										<X size={14} />
									</Button>
								</div>
							))}
							{formData.images?.length === 0 && (
								<p className='text-gray-500 text-sm'>No images added yet.</p>
							)}
						</div>
					</CardContent>
				</Card>

				<div className='flex justify-end space-x-4'>
					<Button
						variant='secondary'
						type='button'
						onClick={() => navigate('/agent/properties')}
					>
						Cancel
					</Button>
					<Button variant='primary' type='submit' isLoading={isLoading}>
						{isEditMode ? 'Update Property' : 'Add Property'}
					</Button>
				</div>
			</form>
		</div>
	);
};

export default PropertyForm;
