import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Alert } from '@/components/ui/alert';
import { User } from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';

interface TenantInfoCardProps {
	tenantProfile: {
		first_name?: string | null;
		last_name?: string | null;
		phone?: string | null;
		current_address?: string | null;
		employment_status?: string | null;
		monthly_income?: number | null;
	} | null;
	createdAt: string;
}

const TenantInfoCard = ({ tenantProfile, createdAt }: TenantInfoCardProps) => {
	return (
		<Card className='mb-6'>
			<CardHeader>
				<h2 className='text-lg font-semibold flex items-center'>
					<User className='h-5 w-5 text-blue-600 mr-2' />
					Tenant Information
				</h2>
			</CardHeader>
			<CardContent>
				{tenantProfile ? (
					<div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
						<div>
							<p className='text-sm text-gray-500'>Full Name</p>
							<p className='font-medium'>
								{tenantProfile.first_name} {tenantProfile.last_name}
							</p>
						</div>
						<div>
							<p className='text-sm text-gray-500'>Phone</p>
							<p className='font-medium'>
								{tenantProfile.phone ?? 'Not Provided'}
							</p>
						</div>
						<div>
							<p className='text-sm text-gray-500'>Current Address</p>
							<p className='font-medium'>
								{tenantProfile.current_address ?? 'Not Provided'}
							</p>
						</div>
						<div>
							<p className='text-sm text-gray-500'>Employment Status</p>
							<p className='font-medium'>
								{tenantProfile.employment_status ?? 'Not Provided'}
							</p>
						</div>
						<div>
							<p className='text-sm text-gray-500'>Monthly Income</p>
							<p className='font-medium'>
								{tenantProfile.monthly_income != null
									? formatCurrency(tenantProfile.monthly_income)
									: 'Not Provided'}
							</p>
						</div>
						<div>
							<p className='text-sm text-gray-500'>Application Date</p>
							<p className='font-medium'>
								{new Date(createdAt).toLocaleDateString()}
							</p>
						</div>
					</div>
				) : (
					<Alert variant='default'>
						Tenant profile information not available.
					</Alert>
				)}
			</CardContent>
		</Card>
	);
};

export default TenantInfoCard;
