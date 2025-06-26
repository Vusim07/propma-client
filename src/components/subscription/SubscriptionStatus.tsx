/* eslint-disable @typescript-eslint/no-explicit-any */
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SubscriptionStatusProps {
	subscription: any;
	isProcessing: boolean;
	onCancel: () => void;
	onManageTeam: () => void;
}

export const SubscriptionStatus = ({
	subscription,
	isProcessing,
	onCancel,
	onManageTeam,
}: SubscriptionStatusProps) => {
	const progressPercentage = Math.min(
		(subscription.current_usage / subscription.usage_limit) * 100,
		100,
	);

	return (
		<div className='border border-gray-200 rounded-lg p-6'>
			<div className='flex flex-col md:flex-row md:justify-between items-start mb-4'>
				<div>
					<span className='inline-flex items-center bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full mb-2'>
						<CheckCircle className='h-4 w-4 mr-1' />
						Active
					</span>
					<h3 className='text-xl font-bold'>{subscription.plan_name} Plan</h3>
					<p className='text-gray-500'>R{subscription.plan_price} / month</p>
				</div>
				<div className='mt-4 md:mt-0'>
					<Button
						variant='outline'
						onClick={onCancel}
						disabled={isProcessing}
						size='sm'
						className='text-sm'
					>
						Cancel Subscription
					</Button>
				</div>
			</div>

			<div className='mt-6 border-t border-gray-200 pt-6'>
				<h4 className='font-medium mb-2'>Usage</h4>
				<div className='bg-gray-100 rounded-full h-4 w-full overflow-hidden'>
					<div
						className='bg-blue-600 h-full'
						style={{ width: `${progressPercentage}%` }}
					></div>
				</div>
				<p className='text-sm mt-2 text-gray-600'>
					{subscription.current_usage} / {subscription.usage_limit} screenings
					used this month
				</p>
			</div>

			<div className='mt-6 border-t border-gray-200 pt-6'>
				<h4 className='font-medium mb-2'>Next Billing Date</h4>
				<p>
					{subscription.end_date
						? new Date(subscription.end_date).toLocaleDateString()
						: 'Not available'}
				</p>
			</div>

			{subscription.team_id && (
				<div className='mt-6 flex justify-center'>
					<Button variant='outline' onClick={onManageTeam}>
						Manage Team
					</Button>
				</div>
			)}
		</div>
	);
};
