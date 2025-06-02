import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { User, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface BackgroundCheckCardProps {
	backgroundCheckStatus?: string | null;
	backgroundCheck?: {
		criminal_record: boolean;
		eviction_history: boolean;
		verification_date: string;
	} | null;
	idVerificationStatus?: string | null;
}

const BackgroundCheckCard = ({
	backgroundCheckStatus,
	backgroundCheck,
	idVerificationStatus,
}: BackgroundCheckCardProps) => {
	return (
		<Card>
			<CardHeader>
				<h2 className='text-lg font-semibold flex items-center'>
					<User className='h-5 w-5 text-dusty_grey mr-2' />
					Background Check
				</h2>
			</CardHeader>
			<CardContent>
				<div className='flex items-center mb-4'>
					{backgroundCheckStatus === 'passed' ? (
						<div className='bg-green-100 text-green-800 p-3 rounded-full mr-4'>
							<CheckCircle className='h-6 w-6' />
						</div>
					) : backgroundCheckStatus === 'failed' ? (
						<div className='bg-red-100 text-red-800 p-3 rounded-full mr-4'>
							<XCircle className='h-6 w-6' />
						</div>
					) : (
						<div className='bg-yellow-100 text-yellow-800 p-3 rounded-full mr-4'>
							<AlertCircle className='h-6 w-6' />
						</div>
					)}
					<div>
						<p className='font-medium text-lg'>
							{backgroundCheckStatus === 'passed'
								? 'Passed'
								: backgroundCheckStatus === 'failed'
								? 'Failed'
								: 'Pending/Unavailable'}
						</p>
						{backgroundCheck && (
							<p className='text-sm text-gray-500'>
								Verified on{' '}
								{new Date(
									backgroundCheck.verification_date,
								).toLocaleDateString()}
							</p>
						)}
					</div>
				</div>

				{backgroundCheck ? (
					<div className='grid grid-cols-1 gap-4 mt-6'>
						<div className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'>
							<div className='flex items-center'>
								<span className='font-medium'>Criminal Record</span>
							</div>
							{backgroundCheck.criminal_record ? (
								<Badge variant='destructive'>Found</Badge>
							) : (
								<Badge variant='outline'>None</Badge>
							)}
						</div>

						<div className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'>
							<div className='flex items-center'>
								<span className='font-medium'>Eviction History</span>
							</div>
							{backgroundCheck.eviction_history ? (
								<Badge variant='destructive'>Found</Badge>
							) : (
								<Badge variant='outline'>None</Badge>
							)}
						</div>

						<div className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'>
							<div className='flex items-center'>
								<span className='font-medium'>Identity Verification</span>
							</div>
							<Badge
								variant={
									idVerificationStatus === 'verified'
										? 'default'
										: idVerificationStatus === 'failed'
										? 'destructive'
										: 'secondary'
								}
							>
								{idVerificationStatus?.toUpperCase() ?? 'PENDING'}
							</Badge>
						</div>
					</div>
				) : (
					<Alert variant='default'>
						Detailed background check information not available.
					</Alert>
				)}
			</CardContent>
		</Card>
	);
};

export default BackgroundCheckCard;
