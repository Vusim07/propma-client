/* eslint-disable @typescript-eslint/no-explicit-any */
import { CheckCircle, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlanCardProps {
	plan: any;
	isSelected: boolean;
	onClick: () => void;
	buttonText: string;
	onButtonClick: (e: React.MouseEvent) => void;
	type: 'monthly' | 'paygo';
}

export const PlanCard = ({
	plan,
	isSelected,
	onClick,
	buttonText,
	onButtonClick,
	type,
}: PlanCardProps) => {
	return (
		<div
			className={`border rounded-lg p-6 cursor-pointer transition-all relative ${
				isSelected
					? 'border-blue-500 ring-2 ring-blue-200'
					: 'border-gray-200 hover:border-blue-200'
			}`}
			onClick={onClick}
		>
			{plan.popular && (
				<div className='absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-xs font-bold py-1 px-3 rounded-full'>
					{type === 'monthly' ? 'Popular' : 'Best Value'}
				</div>
			)}

			{type === 'monthly' ? (
				<>
					<h3 className='text-xl font-bold mb-2'>{plan.name}</h3>
					<p className='text-2xl font-bold mb-1'>
						R{plan.price}
						<span className='text-sm font-normal text-gray-500'>/month</span>
					</p>
					<p className='text-sm text-gray-600 mb-4'>{plan.description}</p>
					{plan.extra_usage && (
						<p className='text-xs text-gray-500 mb-4'>{plan.extra_usage}</p>
					)}
					<ul className='space-y-2 mb-6'>
						{plan.features.map((feature: string, index: number) => (
							<li key={index} className='flex items-start'>
								<CheckCircle className='h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5' />
								<span className='text-sm'>{feature}</span>
							</li>
						))}
					</ul>
					{plan.is_team_plan && (
						<p className='text-sm text-gray-600 mt-2'>
							Up to {plan.max_team_size} team members
						</p>
					)}
				</>
			) : (
				<>
					<div className='flex items-center mb-2'>
						{plan.popular && (
							<Star className='text-yellow-500 mr-2' size={20} />
						)}
						<h3 className='text-lg font-bold'>{plan.name}</h3>
					</div>
					<p className='text-2xl font-bold mb-2'>R{plan.price}</p>
					<p className='text-sm text-gray-600 mb-4'>
						{plan.price_per_screening || ''}
					</p>
				</>
			)}

			<Button variant='default' className='w-full mt-4' onClick={onButtonClick}>
				{buttonText}
			</Button>
		</div>
	);
};
