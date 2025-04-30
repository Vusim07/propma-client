import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useAgentStore } from '../../stores/agentStore';
import { useTeamStore } from '../../stores/teamStore';
import paystackService from '../../services/paystackService';
import { Subscription } from '../../types';
import {
	CheckCircle,
	AlertCircle,
	CreditCard,
	Loader2,
	Star,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import SubscriptionHistory from '../../components/agent/SubscriptionHistory';
import { showToast } from '../../utils/toast';

interface PlanOption {
	id: string;
	name: string;
	price: number;
	usageLimit: number;
	features: string[];
	popular?: boolean;
	description?: string;
	extraUsage?: string;
	isTeamPlan?: boolean;
	maxTeamSize?: number;
}

const planOptions: PlanOption[] = [
	{
		id: 'starter-individual',
		name: 'Individual Starter',
		price: 500,
		usageLimit: 20,
		description: '20 screening credits included',
		extraUsage: 'R65 per additional screening',
		isTeamPlan: false,
		features: [
			'R25 effective cost per screening',
			'Advanced tenant verification',
			'Document automation',
			'Smart scheduling system',
			'Email & chat support',
		],
	},
	{
		id: 'growth-individual',
		name: 'Individual Growth',
		price: 950,
		usageLimit: 40,
		description: '40 screening credits included',
		extraUsage: 'R65 per additional screening',
		isTeamPlan: false,
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
		id: 'starter-team',
		name: 'Team Starter',
		price: 1500,
		usageLimit: 60,
		description: '60 screening credits included',
		extraUsage: 'R65 per additional screening',
		isTeamPlan: true,
		maxTeamSize: 3,
		features: [
			'R25 effective cost per screening',
			'Up to 3 team members',
			'Team dashboard & analytics',
			'Shared document library',
			'Team workflow automation',
			'Priority support',
		],
	},
	{
		id: 'growth-team',
		name: 'Team Growth',
		price: 2850,
		usageLimit: 120,
		description: '120 screening credits included',
		extraUsage: 'R65 per additional screening',
		isTeamPlan: true,
		maxTeamSize: 10,
		popular: true,
		features: [
			'R23.75 effective cost per screening',
			'Up to 10 team members',
			'Everything in Team Starter, plus:',
			'Advanced team analytics',
			'Custom workflow templates',
			'API integrations',
			'Premium support',
		],
	},
	{
		id: 'enterprise-team',
		name: 'Team Enterprise',
		price: 5700,
		usageLimit: 240,
		description: '240 screening credits included',
		extraUsage: 'Volume discounts available',
		isTeamPlan: true,
		maxTeamSize: 25,
		features: [
			'Volume-based discounts',
			'Up to 25 team members',
			'Everything in Team Growth, plus:',
			'Dedicated account manager',
			'Custom API integrations',
			'Advanced team analytics',
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

const progressBarClass = (percentage: number) =>
	`bg-blue-600 h-full w-[${Math.min(100, percentage)}%]`;

const SubscriptionPage: React.FC = () => {
	const { user } = useAuthStore();
	const { currentTeam } = useTeamStore();
	const {
		fetchSubscriptions,
		isLoading: storeLoading,
		error: storeError,
	} = useAgentStore();
	const [subscription, setSubscription] = useState<Subscription | null>(null);
	const [selectedPlanId, setSelectedPlanId] = useState<string>('');
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [subscriptionType, setSubscriptionType] = useState<'monthly' | 'paygo'>(
		'monthly',
	);
	const [showTeamPlans, setShowTeamPlans] = useState(false);

	// Consolidate subscription fetching logic into a single function
	const fetchCurrentSubscription = useCallback(async () => {
		if (!user) return;

		try {
			const subscriptionData = await fetchSubscriptions(user.id);
			setSubscription(subscriptionData);

			if (!subscriptionData && !selectedPlanId) {
				setSelectedPlanId('starter-individual');
			}

			if (storeError) {
				setError(storeError);
			}
		} catch (err: unknown) {
			console.error('Error fetching subscription:', err);
			setError('Failed to load subscription information');
		}
	}, [user, fetchSubscriptions, selectedPlanId, storeError]);

	// Handle payment callback verification
	const handlePaymentCallback = useCallback(
		async (reference: string, isUpgrade = false) => {
			setIsProcessing(true);
			try {
				const updatedSubscription = await paystackService.handlePaymentCallback(
					reference,
				);
				setSubscription(updatedSubscription);
				if (isUpgrade) {
					showToast.success('Plan upgraded successfully');
				}
			} catch {
				setError('Payment verification failed. Please contact support.');
				if (isUpgrade) {
					showToast.error('Failed to verify upgrade payment');
				}
			} finally {
				setIsProcessing(false);
				if (isUpgrade) {
					sessionStorage.removeItem('upgrading_from_plan');
					sessionStorage.removeItem('upgrading_to_plan');
				}
				await fetchCurrentSubscription();
			}
		},
		[fetchCurrentSubscription],
	);

	// Initial setup and subscription fetch
	useEffect(() => {
		if (!user) return;

		setShowTeamPlans(!user.is_individual && currentTeam !== null);

		const searchParams = new URLSearchParams(window.location.search);
		const reference =
			searchParams.get('reference') || searchParams.get('trxref');

		if (reference) {
			sessionStorage.setItem('paystack_reference', reference);
			window.history.replaceState({}, document.title, window.location.pathname);
			handlePaymentCallback(reference);
		} else {
			const storedReference = sessionStorage.getItem('paystack_reference');
			if (storedReference) {
				sessionStorage.removeItem('paystack_reference');
				handlePaymentCallback(storedReference);
			}

			const upgradeRef = sessionStorage.getItem('paystack_upgrade_reference');
			if (upgradeRef) {
				sessionStorage.removeItem('paystack_upgrade_reference');
				handlePaymentCallback(upgradeRef, true);
			} else {
				// Only fetch subscription if there's no payment verification in progress
				fetchCurrentSubscription();
			}
		}
	}, [user, currentTeam, handlePaymentCallback, fetchCurrentSubscription]);

	// Set default plan only if no subscription and no selectedPlanId
	useEffect(() => {
		if (!subscription && !selectedPlanId) {
			setSelectedPlanId('starter-individual');
		}
	}, [subscription, selectedPlanId]);

	const handleSelectPlan = async (planId: string) => {
		if (!user) return;

		const selectedPlan = planOptions.find((plan) => plan.id === planId);
		if (selectedPlan?.isTeamPlan && user.is_individual) {
			showToast.error(
				'You need to create a team before selecting a team plan. Go to Teams to create one.',
			);
			return;
		}

		setSelectedPlanId(planId);
		setError(null);
	};

	const handleSubscribe = async () => {
		if (!user || !selectedPlanId) return;

		const selectedPlan = planOptions.find((plan) => plan.id === selectedPlanId);
		if (!selectedPlan) return;

		if (selectedPlan.isTeamPlan && !currentTeam) {
			showToast.error(
				'Please create or join a team before purchasing a team plan',
			);
			return;
		}

		setIsProcessing(true);
		setError(null);

		try {
			const { authorizationUrl } = await paystackService.createSubscription({
				userId: user.id,
				planName: selectedPlan.name,
				planPrice: subscriptionType === 'monthly' ? selectedPlan.price : 0,
				email: user.email,
				usageLimit: selectedPlan.usageLimit,
				isOneTime: subscriptionType === 'paygo',
			});

			window.location.href = authorizationUrl;
		} catch {
			showToast.error('Failed to create subscription. Please try again.');
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
		} catch {
			setError('Failed to cancel subscription. Please try again.');
		} finally {
			setIsProcessing(false);
		}
	};

	const handleUpgrade = async (newPlanId: string) => {
		if (!user || !subscription) return;

		const selectedPlan = planOptions.find((plan) => plan.id === newPlanId);
		if (!selectedPlan) return;

		if (selectedPlan.isTeamPlan && !currentTeam) {
			showToast.error(
				'Please create or join a team before upgrading to a team plan',
			);
			return;
		}

		setIsProcessing(true);
		setError(null);

		try {
			const { authorizationUrl, proratedAmount } =
				await paystackService.upgradeSubscription({
					subscriptionId: subscription.id,
					newPlanId,
					userId: user.id,
					teamId: currentTeam?.id,
				});

			if (confirm(`Upgrade cost: R${proratedAmount}. Continue with upgrade?`)) {
				sessionStorage.setItem('upgrading_from_plan', subscription.plan_name);
				sessionStorage.setItem('upgrading_to_plan', newPlanId);

				window.location.href = authorizationUrl;
			} else {
				setIsProcessing(false);
			}
		} catch {
			showToast.error('Failed to process upgrade. Please try again.');
			setIsProcessing(false);
		}
	};

	const availablePlans = planOptions.filter(
		(plan) => plan.isTeamPlan === showTeamPlans,
	);

	if (storeLoading) {
		return (
			<div className='flex items-center justify-center h-64'>
				<Loader2 className='h-8 w-8 animate-spin text-blue-600' />
			</div>
		);
	}

	return (
		<div className='max-w-5xl mx-auto'>
			{!subscription && (
				<div className='bg-white rounded-lg shadow-sm p-6 mb-4'>
					<div className='flex justify-between items-center'>
						<h3 className='text-lg font-medium'>Plan Type</h3>
						<div className='flex items-center space-x-4'>
							<button
								className={`px-4 py-2 rounded-md ${
									!showTeamPlans ? 'bg-blue-100 text-blue-700' : 'text-gray-600'
								}`}
								onClick={() => setShowTeamPlans(false)}
							>
								Individual
							</button>
							<button
								className={`px-4 py-2 rounded-md ${
									showTeamPlans ? 'bg-blue-100 text-blue-700' : 'text-gray-600'
								}`}
								onClick={() => setShowTeamPlans(true)}
							>
								Team
							</button>
						</div>
					</div>
				</div>
			)}

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
									className={progressBarClass(
										(subscription.current_usage / subscription.usage_limit) *
											100,
									)}
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

						<SubscriptionHistory subscriptionId={subscription.id} />
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
						{subscription
							? 'Upgrade Your Plan'
							: showTeamPlans
							? 'Choose a Team Plan'
							: 'Choose an Individual Plan'}
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
						{availablePlans.map((plan) => (
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

								{plan.isTeamPlan && (
									<p className='text-sm text-gray-600 mt-2'>
										Up to {plan.maxTeamSize} team members
									</p>
								)}

								<Button
									variant='primary'
									className='w-full'
									onClick={(e) => {
										e.stopPropagation();
										if (subscription && plan.id !== subscription.plan_name) {
											handleUpgrade(plan.id);
										} else {
											handleSelectPlan(plan.id);
										}
									}}
									disabled={isProcessing || subscription?.plan_name === plan.id}
								>
									{subscription
										? subscription.plan_name === plan.id
											? 'Current Plan'
											: 'Upgrade'
										: selectedPlanId === plan.id
										? 'Selected'
										: 'Select'}
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
