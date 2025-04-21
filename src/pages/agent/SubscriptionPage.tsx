import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import paystackService from '../../services/paystackService';
import { supabase } from '../../services/supabase';
import { Subscription } from '../../types';
import { usePageTitle } from '../../context/PageTitleContext';
import {
	CheckCircle,
	AlertCircle,
	CreditCard,
	Loader2,
	Star,
} from 'lucide-react';
import Button from '../../components/ui/Button';

interface PlanOption {
	id: string;
	name: string;
	price: number;
	usageLimit: number;
	features: string[];
	popular?: boolean;
	description?: string;
	extraUsage?: string;
}

const planOptions: PlanOption[] = [
	{
		id: 'starter',
		name: 'Starter',
		price: 500,
		usageLimit: 20,
		description: '20 screening credits included',
		extraUsage: 'R65 per additional screening',
		features: [
			'R25 effective cost per screening',
			'Advanced tenant verification',
			'Document automation',
			'Smart scheduling system',
			'Email & chat support',
		],
	},
	{
		id: 'growth',
		name: 'Growth',
		price: 950,
		usageLimit: 40,
		description: '40 screening credits included',
		extraUsage: 'R65 per additional screening',
		popular: true,
		features: [
			'R23.75 effective cost per screening',
			'Everything in Starter, plus:',
			'Priority tenant verification',
			'Analytics dashboard',
			'API integration with listing sites',
			'Priority support',
		],
	},
	{
		id: 'enterprise',
		name: 'Enterprise',
		price: 1900,
		usageLimit: 80,
		description: '80 screening credits included',
		extraUsage: 'Volume discounts available',
		features: [
			'Volume-based discounts',
			'Everything in Growth, plus:',
			'Dedicated account manager',
			'Custom API integrations',
			'Advanced analytics',
			'Custom reporting',
			'24/7 premium support',
		],
	},
];

const creditBundles = [
	{
		id: 'single',
		name: 'Single Credit',
		price: 65,
		credits: 1,
		pricePerCredit: 'R65 per screening',
	},
	{
		id: 'bundle-50',
		name: '50 Credit Bundle',
		price: 3000,
		credits: 50,
		pricePerCredit: 'R60 per screening',
		popular: true,
	},
	{
		id: 'bundle-100',
		name: '100 Credit Bundle',
		price: 5500,
		credits: 100,
		pricePerCredit: 'R55 per screening',
	},
];

const SubscriptionPage: React.FC = () => {
	const { user } = useAuthStore();
	const { setPageTitle } = usePageTitle();
	const [subscription, setSubscription] = useState<Subscription | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [selectedPlanId, setSelectedPlanId] = useState<string>('');
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [subscriptionType, setSubscriptionType] = useState<'monthly' | 'paygo'>(
		'monthly',
	);

	useEffect(() => {
		setPageTitle('Manage Subscription');
		fetchCurrentSubscription();
	}, [setPageTitle]);

	const fetchCurrentSubscription = async () => {
		if (!user) return;

		setIsLoading(true);
		try {
			const { data, error } = await supabase
				.from('subscriptions')
				.select('*')
				.eq('user_id', user.id)
				.eq('status', 'active')
				.order('created_at', { ascending: false })
				.limit(1)
				.single();

			if (error && error.code !== 'PGRST116') {
				// PGRST116 is the "no rows returned" error
				throw error;
			}

			setSubscription(data || null);

			// If no active subscription, default to the Starter plan
			if (!data && !selectedPlanId) {
				setSelectedPlanId('starter');
			}
		} catch (error) {
			console.error('Error fetching subscription:', error);
			setError('Failed to load subscription information');
		} finally {
			setIsLoading(false);
		}
	};

	const handleSelectPlan = (planId: string) => {
		setSelectedPlanId(planId);
	};

	const handleSubscribe = async () => {
		if (!user || !selectedPlanId) return;

		let selectedPlan;
		let planName;
		let planPrice;
		let usageLimit;

		if (subscriptionType === 'monthly') {
			selectedPlan = planOptions.find((plan) => plan.id === selectedPlanId);
			if (!selectedPlan) return;

			planName = selectedPlan.name;
			planPrice = selectedPlan.price;
			usageLimit = selectedPlan.usageLimit;
		} else {
			selectedPlan = creditBundles.find(
				(bundle) => bundle.id === selectedPlanId,
			);
			if (!selectedPlan) return;

			planName = `Credit Bundle: ${selectedPlan.name}`;
			planPrice = selectedPlan.price;
			usageLimit = selectedPlan.credits;
		}

		setIsProcessing(true);
		setError(null);

		try {
			const { authorizationUrl } = await paystackService.createSubscription({
				userId: user.id,
				planName,
				planPrice,
				email: user.email,
				usageLimit,
			});

			// Redirect to Paystack payment page
			window.location.href = authorizationUrl;
		} catch (err) {
			console.error('Error creating subscription:', err);
			setError('Failed to create subscription. Please try again.');
			setIsProcessing(false);
		}
	};

	const handleCancelSubscription = async () => {
		if (!subscription) return;

		setIsProcessing(true);
		try {
			await paystackService.cancelSubscription(
				subscription.id,
				subscription.paystack_subscription_id,
			);
			await fetchCurrentSubscription();
		} catch (err) {
			console.error('Error cancelling subscription:', err);
			setError('Failed to cancel subscription. Please try again.');
		} finally {
			setIsProcessing(false);
		}
	};

	if (isLoading) {
		return (
			<div className='flex items-center justify-center h-64'>
				<Loader2 className='h-8 w-8 animate-spin text-blue-600' />
			</div>
		);
	}

	return (
		<div className='max-w-5xl mx-auto'>
			<div className='bg-white rounded-lg shadow-sm p-6 mb-8'>
				<h2 className='text-2xl font-semibold mb-6'>Subscription Status</h2>

				{error && (
					<div className='bg-red-50 text-red-800 rounded-md p-4 mb-6 flex items-start'>
						<AlertCircle className='h-5 w-5 mr-2 flex-shrink-0 mt-0.5' />
						<span>{error}</span>
					</div>
				)}

				{subscription ? (
					<div className='border border-gray-200 rounded-lg p-6'>
						<div className='flex justify-between items-start mb-4'>
							<div>
								<span className='inline-flex items-center bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full mb-2'>
									<CheckCircle className='h-4 w-4 mr-1' />
									Active
								</span>
								<h3 className='text-xl font-bold'>
									{subscription.plan_name} Plan
								</h3>
								<p className='text-gray-500'>
									R{subscription.plan_price} / month
								</p>
							</div>
							<Button
								variant='outline'
								onClick={handleCancelSubscription}
								disabled={isProcessing}
							>
								{isProcessing ? (
									<Loader2 className='h-4 w-4 mr-2 animate-spin' />
								) : null}
								Cancel Subscription
							</Button>
						</div>

						<div className='mt-6 border-t border-gray-200 pt-6'>
							<h4 className='font-medium mb-2'>Usage</h4>
							<div className='bg-gray-100 rounded-full h-4 w-full overflow-hidden'>
								<div
									className='bg-blue-600 h-full'
									style={{
										width: `${Math.min(
											100,
											(subscription.current_usage / subscription.usage_limit) *
												100,
										)}%`,
									}}
								></div>
							</div>
							<p className='text-sm mt-2 text-gray-600'>
								{subscription.current_usage} / {subscription.usage_limit}{' '}
								screenings used this month
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
					</div>
				) : (
					<div className='bg-yellow-50 text-yellow-800 rounded-md p-4 flex items-start mb-6'>
						<AlertCircle className='h-5 w-5 mr-2 flex-shrink-0 mt-0.5' />
						<div>
							<p className='font-medium'>No active subscription</p>
							<p className='mt-1'>
								Select a plan below to get started with tenant screening.
							</p>
						</div>
					</div>
				)}
			</div>

			<div className='bg-white rounded-lg shadow-sm p-6 mb-8'>
				<div className='flex justify-between items-center mb-6'>
					<h2 className='text-2xl font-semibold'>
						{subscription ? 'Upgrade Your Plan' : 'Choose a Plan'}
					</h2>

					<div className='flex items-center bg-gray-100 rounded-lg p-1'>
						<button
							className={`py-2 px-4 rounded-md text-sm font-medium ${
								subscriptionType === 'monthly'
									? 'bg-white shadow-sm text-blue-700'
									: 'text-gray-600'
							}`}
							onClick={() => setSubscriptionType('monthly')}
						>
							Monthly Plans
						</button>
						<button
							className={`py-2 px-4 rounded-md text-sm font-medium ${
								subscriptionType === 'paygo'
									? 'bg-white shadow-sm text-blue-700'
									: 'text-gray-600'
							}`}
							onClick={() => setSubscriptionType('paygo')}
						>
							Pay-As-You-Go
						</button>
					</div>
				</div>

				{subscriptionType === 'monthly' ? (
					<div className='grid md:grid-cols-3 gap-6 mb-8'>
						{planOptions.map((plan) => (
							<div
								key={plan.id}
								className={`border rounded-lg p-6 cursor-pointer transition-all relative ${
									selectedPlanId === plan.id
										? 'border-blue-500 ring-2 ring-blue-200'
										: 'border-gray-200 hover:border-blue-200'
								}`}
								onClick={() => handleSelectPlan(plan.id)}
							>
								{plan.popular && (
									<div className='absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-xs font-bold py-1 px-3 rounded-full'>
										Popular
									</div>
								)}
								<h3 className='text-xl font-bold mb-2'>{plan.name}</h3>
								<p className='text-2xl font-bold mb-1'>
									R{plan.price}
									<span className='text-sm font-normal text-gray-500'>
										/month
									</span>
								</p>
								<p className='text-sm text-gray-600 mb-4'>{plan.description}</p>
								<p className='text-xs text-gray-500 mb-4'>{plan.extraUsage}</p>

								<ul className='space-y-2 mb-6'>
									{plan.features.map((feature, index) => (
										<li key={index} className='flex items-start'>
											<CheckCircle className='h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5' />
											<span className='text-sm'>{feature}</span>
										</li>
									))}
								</ul>

								<Button
									variant='primary'
									className='w-full'
									onClick={(e) => {
										e.stopPropagation();
										handleSelectPlan(plan.id);
									}}
								>
									{selectedPlanId === plan.id ? 'Selected' : 'Select'}
								</Button>
							</div>
						))}
					</div>
				) : (
					<div className='mb-8'>
						<p className='text-gray-600 mb-6'>
							Purchase screening credits as needed for your agency. No monthly
							commitments.
						</p>

						<div className='grid md:grid-cols-3 gap-6'>
							{creditBundles.map((bundle) => (
								<div
									key={bundle.id}
									className={`border rounded-lg p-6 cursor-pointer transition-all relative ${
										selectedPlanId === bundle.id
											? 'border-blue-500 ring-2 ring-blue-200'
											: 'border-gray-200 hover:border-blue-200'
									}`}
									onClick={() => handleSelectPlan(bundle.id)}
								>
									{bundle.popular && (
										<div className='absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-xs font-bold py-1 px-3 rounded-full'>
											Best Value
										</div>
									)}
									<div className='flex items-center mb-2'>
										{bundle.popular && (
											<Star className='text-yellow-500 mr-2' size={20} />
										)}
										<h3 className='text-lg font-bold'>{bundle.name}</h3>
									</div>
									<p className='text-2xl font-bold mb-2'>R{bundle.price}</p>
									<p className='text-sm text-gray-600 mb-4'>
										{bundle.pricePerCredit}
									</p>

									<Button
										variant='primary'
										className='w-full'
										onClick={(e) => {
											e.stopPropagation();
											handleSelectPlan(bundle.id);
										}}
									>
										{selectedPlanId === bundle.id ? 'Selected' : 'Select'}
									</Button>
								</div>
							))}
						</div>
					</div>
				)}

				{selectedPlanId && (
					<div className='flex justify-center'>
						<Button
							size='lg'
							disabled={isProcessing || !selectedPlanId}
							onClick={handleSubscribe}
							className='flex items-center'
						>
							{isProcessing ? (
								<Loader2 className='h-5 w-5 mr-2 animate-spin' />
							) : (
								<CreditCard className='h-5 w-5 mr-2' />
							)}
							{subscription
								? 'Upgrade Subscription'
								: subscriptionType === 'monthly'
								? 'Subscribe Now'
								: 'Purchase Credits'}
						</Button>
					</div>
				)}
			</div>
		</div>
	);
};

export default SubscriptionPage;
