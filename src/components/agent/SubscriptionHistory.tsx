import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import {
	History,
	ChevronUp,
	ChevronDown,
	ArrowUpRight,
	ArrowDownRight,
} from 'lucide-react';
import { formatZAR } from '../../utils/currency';

interface SubscriptionChange {
	id: string;
	subscription_id: string;
	previous_plan_name: string;
	new_plan_name: string;
	prorated_amount: number;
	unused_credits: number;
	credit_value: number;
	final_amount: number;
	created_at: string;
}

interface SubscriptionHistoryProps {
	subscriptionId: string;
}

const SubscriptionHistory: React.FC<SubscriptionHistoryProps> = ({
	subscriptionId,
}) => {
	const [changes, setChanges] = useState<SubscriptionChange[]>([]);
	const [isExpanded, setIsExpanded] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchChanges = async () => {
			try {
				const { data, error: fetchError } = await supabase
					.from('subscription_changes')
					.select('*')
					.eq('subscription_id', subscriptionId)
					.order('created_at', { ascending: false });

				if (fetchError) throw fetchError;
				setChanges(data || []);
			} catch (err) {
				setError('Failed to load subscription history');
				console.error('Error fetching subscription changes:', err);
			} finally {
				setIsLoading(false);
			}
		};

		fetchChanges();
	}, [subscriptionId]);

	if (isLoading) return null;
	if (error) return null;
	if (changes.length === 0) return null;

	return (
		<div className='mt-6 border-t border-gray-200 pt-6'>
			<button
				onClick={() => setIsExpanded(!isExpanded)}
				className='flex items-center justify-between w-full'
			>
				<div className='flex items-center'>
					<History className='h-5 w-5 mr-2 text-gray-500' />
					<h4 className='font-medium'>Plan Change History</h4>
				</div>
				{isExpanded ? (
					<ChevronUp className='h-5 w-5 text-gray-500' />
				) : (
					<ChevronDown className='h-5 w-5 text-gray-500' />
				)}
			</button>

			{isExpanded && (
				<div className='mt-4 space-y-4'>
					{changes.map((change) => (
						<div
							key={change.id}
							className='bg-gray-50 rounded-lg p-4 border border-gray-200'
						>
							<div className='flex items-start justify-between'>
								<div>
									<div className='flex items-center'>
										{change.final_amount > 0 ? (
											<ArrowUpRight className='h-4 w-4 text-blue-600 mr-1.5' />
										) : (
											<ArrowDownRight className='h-4 w-4 text-green-600 mr-1.5' />
										)}
										<h5 className='font-medium text-sm'>
											{change.previous_plan_name} → {change.new_plan_name}
										</h5>
									</div>
									<p className='text-sm text-gray-600 mt-1'>
										{new Date(change.created_at).toLocaleDateString()}
									</p>
								</div>
								<div className='text-right'>
									<p className='text-sm font-medium'>
										Final Amount: {formatZAR(change.final_amount)}
									</p>
									<div className='text-xs text-gray-500 mt-1'>
										<p>Prorated: {formatZAR(change.prorated_amount)}</p>
										<p>Credits: {change.unused_credits}</p>
										<p>Credit Value: {formatZAR(change.credit_value)}</p>
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
};

export default SubscriptionHistory;
