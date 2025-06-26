import React from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import SubscriptionHistory from '@/components/agent/SubscriptionHistory';
import { AlertCircle, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlanCard } from '@/components/subscription/PlanCard';
import { SubscriptionStatus } from '@/components/subscription/SubscriptionStatus';
import { useNavigate } from 'react-router-dom';

const SubscriptionPage: React.FC = () => {
	const navigate = useNavigate();
	const {
		state: {
			subscription,
			selectedPlanId,
			isProcessing,
			error,
			subscriptionType,
			showTeamPlans,
			isOnboarding,

			storeLoading,
			availablePlans,
		},
		actions: {
			setSubscriptionType,
			setShowTeamPlans,
			handleSelectPlan,
			handleSubscribe,
			handleCancelSubscription,
			handleUpgrade,
			getPlanButtonText,
			navigateToTeams,
		},
	} = useSubscription();

	if (storeLoading) {
		return (
			<div className='flex items-center justify-center h-64'>
				<Loader2 className='h-8 w-8 animate-spin text-blue-600' />
			</div>
		);
	}

	return (
		<div className='max-w-5xl mx-auto'>
			{isOnboarding && (
				<div className='bg-blue-50 text-blue-800 rounded-lg p-4 mb-4 flex items-start'>
					<AlertCircle className='h-5 w-5 mr-2 flex-shrink-0 mt-0.5' />
					<div>
						<p className='font-medium'>Complete your account setup</p>
						<p>
							Choose a subscription plan to continue using Amara for property
							management.
						</p>
					</div>
				</div>
			)}

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
				<h2 className='text-lg font-semibold mb-6'>Subscription Status</h2>

				{error && (
					<div className='bg-red-50 text-red-800 rounded-md p-4 mb-6 flex items-start'>
						<AlertCircle className='h-5 w-5 mr-2 flex-shrink-0 mt-0.5' />
						<span>{error}</span>
					</div>
				)}

				{subscription ? (
					<>
						<SubscriptionStatus
							subscription={subscription}
							isProcessing={isProcessing}
							onCancel={handleCancelSubscription}
							onManageTeam={navigateToTeams}
						/>
						<SubscriptionHistory subscriptionId={subscription.id} />
					</>
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
				<div className='flex flex-col md:flex-row justify-between items-center mb-6'>
					<h2 className='text-lg font-semibold order-1'>
						{subscription
							? 'Upgrade Your Plan'
							: showTeamPlans
							? 'Choose a Team Plan'
							: 'Choose an Individual Plan'}
					</h2>

					<div className='order-2 mt-4 md:mt-0 flex items-center bg-gray-100 rounded-lg p-1'>
						<button
							className={`py-2 px-4 rounded-md text-sm font-medium ${
								subscriptionType === 'monthly'
									? 'bg-white shadow-sm text-blue-700'
									: 'text-gray-600'
							}`}
							onClick={() => setSubscriptionType('monthly')}
						>
							{showTeamPlans
								? 'Teams Monthly Plans'
								: 'Individual Monthly Plans'}
						</button>
						<button
							className={`py-2 px-4 rounded-md text-sm font-medium ${
								subscriptionType === 'paygo'
									? 'bg-white shadow-sm text-blue-700'
									: 'text-gray-600'
							}`}
							onClick={() => setSubscriptionType('paygo')}
						>
							Credits
						</button>
					</div>
				</div>

				{subscriptionType === 'monthly' ? (
					<div className='grid md:grid-cols-3 gap-6 mb-8'>
						{availablePlans.map((plan) => (
							<PlanCard
								key={plan.id}
								plan={plan}
								isSelected={selectedPlanId === plan.id}
								onClick={() => handleSelectPlan(plan.id)}
								buttonText={getPlanButtonText(plan)}
								onButtonClick={(e) => {
									e.stopPropagation();
									if (subscription) {
										handleUpgrade(plan.id);
									} else {
										handleSelectPlan(plan.id);
									}
								}}
								type='monthly'
							/>
						))}
					</div>
				) : (
					<div className='mb-8'>
						<p className='text-gray-600 mb-6'>
							Purchase credits to include Experian credit checks with your
							subscription.
						</p>

						<div className='grid md:grid-cols-3 gap-6'>
							{availablePlans.map((bundle) => (
								<PlanCard
									key={bundle.id}
									plan={bundle}
									isSelected={selectedPlanId === bundle.id}
									onClick={() => handleSelectPlan(bundle.id)}
									buttonText={getPlanButtonText(bundle)}
									onButtonClick={(e) => {
										e.stopPropagation();
										if (subscription) {
											handleUpgrade(bundle.id);
										} else {
											handleSelectPlan(bundle.id);
										}
									}}
									type='paygo'
								/>
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
								: isOnboarding
								? 'Complete Account Setup'
								: subscriptionType === 'monthly'
								? 'Subscribe Now'
								: 'Purchase Credits'}
						</Button>
					</div>
				)}
			</div>

			{isOnboarding && (
				<div className='mt-4 text-center'>
					<button
						onClick={() => navigate('/agent')}
						className='text-gray-500 hover:text-gray-700 text-sm'
					>
						Skip for now (You can subscribe later)
					</button>
				</div>
			)}
		</div>
	);
};

export default SubscriptionPage;
