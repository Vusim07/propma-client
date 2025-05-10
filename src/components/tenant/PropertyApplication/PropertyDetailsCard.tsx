// PropertyApplicationComponents/PropertyDetailsCard.tsx
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Property } from '@/types';
import { Home, MapPin, DollarSign, Calendar } from 'lucide-react';

interface PropertyDetailsCardProps {
	property: Property;
}

export const PropertyDetailsCard = ({ property }: PropertyDetailsCardProps) => (
	<div className='w-full lg:w-5/12'>
		<Card className='sticky top-6'>
			<CardHeader>
				<h2 className='text-xl font-semibold'>Property Details</h2>
			</CardHeader>
			<CardContent className='p-4 md:p-6'>
				<div className='mb-6'>
					{property.images && property.images.length > 0 ? (
						<img
							src={property.images[0]}
							alt={property.address}
							className='w-full h-48 md:h-56 object-cover rounded-md'
						/>
					) : (
						<div className='w-full h-48 md:h-56 bg-gray-200 flex items-center justify-center rounded-md'>
							<Home size={64} className='text-gray-400' />
						</div>
					)}
				</div>

				<div>
					<h1 className='text-xl md:text-2xl font-bold text-gray-900 mb-2'>
						{property.address}
					</h1>
					<div className='flex items-start mb-4'>
						<MapPin
							size={18}
							className='text-gray-500 mr-2 mt-1 flex-shrink-0'
						/>
						<p className='text-gray-600'>
							{property.city}, {property.province} {property.postal_code}
						</p>
					</div>
					<div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4'>
						<div className='flex items-center'>
							<DollarSign className='h-5 w-5 text-blue-500 mr-2 flex-shrink-0' />
							<div>
								<p className='text-sm text-gray-500'>Monthly Rent</p>
								<p className='font-semibold'>
									R{property.monthly_rent.toLocaleString()}
								</p>
							</div>
						</div>
						<div className='flex items-center'>
							<Calendar className='h-5 w-5 text-blue-500 mr-2 flex-shrink-0' />
							<div>
								<p className='text-sm text-gray-500'>Available From</p>
								<p className='font-semibold'>
									{new Date(property.available_from).toLocaleDateString()}
								</p>
							</div>
						</div>
						<div className='flex items-center'>
							<Home className='h-5 w-5 text-blue-500 mr-2 flex-shrink-0' />
							<div>
								<p className='text-sm text-gray-500'>Property Type</p>
								<p className='font-semibold capitalize'>
									{property.property_type.replace('_', ' ')}
								</p>
							</div>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	</div>
);
