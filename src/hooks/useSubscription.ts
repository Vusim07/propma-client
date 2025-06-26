/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useAgentStore } from '@/stores/agentStore';
import { useTeamStore } from '@/stores/teamStore';
import paystackService from '@/services/paystackService';
import { Subscription } from '@/types';
import { supabase } from '@/services/supabase';
import { showToast } from '@/utils/toast';
import { plansService } from '@/services/plansService';

export const useSubscription = () => {
	const hasInitialized = useRef(false);
	const { user } = useAuthStore();
	const { currentTeam, refreshTeamData } = useTeamStore();
	const navigate = useNavigate();
	const location = useLocation();
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
	const [isOnboarding, setIsOnboarding] = useState(false);
	const [monthlyPlans, setMonthlyPlans] = useState<any[]>([]);
	const [paygoPlans, setPaygoPlans] = useState<any[]>([]);

	const fetchCurrentSubscription = useCallback(async () => {
		if (!user || isProcessing) return;

		try {
			const subscriptionData = await fetchSubscriptions(user.id);
			setSubscription(subscriptionData);

			if (!subscriptionData && !selectedPlanId) {
				const storedPlanType = localStorage.getItem('selectedPlanType');
				const isTeamPlan = localStorage.getItem('isTeamPlan') === 'true';

				if (isOnboarding && storedPlanType) {
					setShowTeamPlans(isTeamPlan);
					const planPrefix = storedPlanType || 'free';
					const planSuffix = isTeamPlan ? 'team' : 'individual';
					const planId = `${planPrefix}-${planSuffix}`;
					setSelectedPlanId(planId);
				} else {
					setSelectedPlanId('free');
				}
			}

			if (storeError) {
				setError(storeError);
			}
		} catch (err: unknown) {
			console.error('Error fetching subscription:', err);
			setError('Failed to load subscription information');
		}
	}, [
		user,
		fetchSubscriptions,
		selectedPlanId,
		storeError,
		isOnboarding,
		isProcessing,
	]);

	const handlePaymentCallback = useCallback(
		async (reference: string, isUpgrade = false) => {
			setIsProcessing(true);
			try {
				const updatedSubscription = await paystackService.handlePaymentCallback(
					reference,
				);
				setSubscription(updatedSubscription);

				if (updatedSubscription.team_id) {
					try {
						await refreshTeamData(updatedSubscription.team_id);
					} catch (teamError) {
						console.error('Error refreshing team data:', teamError);
					}
				}

				await supabase.auth.refreshSession();
				await useAuthStore.getState().getProfile();

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
		[fetchCurrentSubscription, refreshTeamData],
	);

	const navigateToTeams = useCallback(() => {
		navigate('/agent/settings', {
			state: { activeTab: 'team', fromBilling: true },
			replace: true,
		});
	}, [navigate]);

	const handleSelectPlan = async (planId: string) => {
		if (!user) return;
		const selectedPlan = [...monthlyPlans, ...paygoPlans].find(
			(plan) => plan.id === planId,
		);
		if (!selectedPlan) return;

		// If free plan, set selectedPlanId and skip payment
		if (selectedPlan.price === 0) {
			setSelectedPlanId(planId);
			setError(null);
			return;
		}

		if (isOnboarding) {
			const isTeamPlan = localStorage.getItem('isTeamPlan') === 'true';
			if (selectedPlan.is_team_plan === isTeamPlan) {
				setSelectedPlanId(planId);
				setError(null);
				return;
			}
		}

		if (selectedPlan.is_team_plan && user.is_individual) {
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

		const selectedPlan = [...monthlyPlans, ...paygoPlans].find(
			(plan) => plan.id === selectedPlanId,
		);
		if (!selectedPlan) return;

		// If free plan, bypass Paystack and create subscription directly
		if (selectedPlan.price === 0) {
			setIsProcessing(true);
			setError(null);
			try {
				const { createSubscription } = await import(
					'@/services/subscriptionService'
				);
				const result = await createSubscription({
					userId: user.id,
					planId: selectedPlan.id,
				});
				if (!result.success) {
					setError(result.message || 'Failed to subscribe to free plan.');
				} else {
					await fetchCurrentSubscription();
				}
			} catch (err: any) {
				setError(err.message || 'An error occurred while subscribing.');
			} finally {
				setIsProcessing(false);
			}
			return;
		}

		if (selectedPlan.is_team_plan) {
			const isTeamOnboarding =
				isOnboarding && localStorage.getItem('isTeamPlan') === 'true';
			if (!currentTeam && !isTeamOnboarding) {
				showToast.error(
					'Please create or join a team before purchasing a team plan',
				);
				return;
			}
		}

		setIsProcessing(true);
		setError(null);

		try {
			if (selectedPlan.price === 0) {
				const { createSubscription } = await import(
					'@/services/subscriptionService'
				);
				const result = await createSubscription({
					userId: user.id,
					planId: selectedPlan.id,
				});
				if (result.success) {
					showToast.success(
						'You have successfully subscribed to the free plan.',
					);
					await fetchCurrentSubscription();
					setIsProcessing(false);
					return;
				} else {
					showToast.error(
						result.message || 'Failed to subscribe to free plan.',
					);
					setIsProcessing(false);
					return;
				}
			}

			let effectiveTeamId = null;
			if (selectedPlan.is_team_plan) {
				const isTeamOnboarding =
					isOnboarding && localStorage.getItem('isTeamPlan') === 'true';
				if (currentTeam) {
					effectiveTeamId = currentTeam.id;
				} else if (isTeamOnboarding) {
					const { data: userData, error: userError } = await supabase
						.from('users')
						.select('active_team_id')
						.eq('id', user.id)
						.single();

					if (userError) throw userError;
					if (userData?.active_team_id) {
						effectiveTeamId = userData.active_team_id;
					} else {
						console.error('No active team ID found for user during onboarding');
						showToast.error(
							'Unable to find team information. Please try again.',
						);
						setIsProcessing(false);
						return;
					}
				}
			}

			const { authorizationUrl } = await paystackService.createSubscription({
				userId: user.id,
				planName: selectedPlan.name,
				planPrice: selectedPlan.price,
				email: user.email,
				usageLimit: selectedPlan.usage_limit,
				isOneTime: subscriptionType === 'paygo',
				teamId: effectiveTeamId,
			});

			if (isOnboarding) {
				sessionStorage.setItem('completing_onboarding', 'true');
			}

			window.location.href = authorizationUrl;
		} catch (err) {
			console.error('Subscription creation error:', err);
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
		const selectedPlan = [...monthlyPlans, ...paygoPlans].find(
			(plan) => plan.id === newPlanId,
		);
		if (!selectedPlan) return;

		if (selectedPlan.is_team_plan && !currentTeam) {
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

	const getPlanButtonText = (plan: any): string => {
		if (!subscription)
			return selectedPlanId === plan.id ? 'Selected' : 'Select';
		if (plan.is_team_plan !== subscription.is_team) return 'Upgrade';
		if (plan.usage_limit < subscription.usage_limit) return 'Downgrade';
		if (plan.usage_limit > subscription.usage_limit) return 'Upgrade';
		return 'Upgrade';
	};

	useEffect(() => {
		const loadPlans = async () => {
			try {
				if (subscriptionType === 'monthly') {
					const plans = showTeamPlans
						? await plansService.getTeamPlans()
						: await plansService.getIndividualPlans();
					setMonthlyPlans(plans);
					if (!selectedPlanId && plans.length) {
						setSelectedPlanId(plans[0].id);
					}
				} else {
					const bundles = await plansService.getPaygoPlans();
					setPaygoPlans(bundles);
					if (!selectedPlanId && bundles.length) {
						setSelectedPlanId(bundles[0].id);
					}
				}
			} catch (err) {
				console.error('Error loading plans:', err);
				showToast.error('Failed to load plans. Please try again.');
			}
		};
		loadPlans();
	}, [subscriptionType, showTeamPlans, selectedPlanId]);

	useEffect(() => {
		if (subscription?.team_id && !isProcessing) {
			const teamId = subscription.team_id;
			refreshTeamData(teamId);
		}
	}, [subscription?.id, subscription?.team_id, refreshTeamData, isProcessing]);

	useEffect(() => {
		if (hasInitialized.current || !user) return;
		hasInitialized.current = true;

		const searchParams = new URLSearchParams(location.search);
		const onboarding = searchParams.get('onboarding') === 'true';
		setIsOnboarding(onboarding);

		if (
			onboarding &&
			!sessionStorage.getItem('onboarding_notification_shown')
		) {
			showToast.info(
				'Complete your subscription to finish setting up your account',
			);
			sessionStorage.setItem('onboarding_notification_shown', 'true');
		}

		const isTeamPlanOnboarding = localStorage.getItem('isTeamPlan') === 'true';
		setShowTeamPlans(!user.is_individual || isTeamPlanOnboarding);

		if (
			(isTeamPlanOnboarding || !user.is_individual) &&
			!currentTeam &&
			user.active_team_id
		) {
			const fetchTeamData = async () => {
				try {
					await useTeamStore.getState().fetchTeams();
				} catch (teamError) {
					console.error(
						'Error fetching teams during initialization:',
						teamError,
					);
				}
			};
			fetchTeamData();
		} else if (!onboarding) {
			setShowTeamPlans(!user.is_individual && currentTeam !== null);
		}

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
			} else {
				const upgradeRef = sessionStorage.getItem('paystack_upgrade_reference');
				if (upgradeRef) {
					sessionStorage.removeItem('paystack_upgrade_reference');
					handlePaymentCallback(upgradeRef, true);
				} else {
					fetchCurrentSubscription();
				}
			}
		}

		return () => {
			if (onboarding) {
				localStorage.removeItem('selectedPlanType');
				localStorage.removeItem('isTeamPlan');
			}
		};
	}, [
		user,
		currentTeam,
		location.search,
		handlePaymentCallback,
		fetchCurrentSubscription,
	]);

	useEffect(() => {
		if (!subscription && !selectedPlanId) {
			setSelectedPlanId('starter-individual');
		}
	}, [subscription, selectedPlanId]);

	useEffect(() => {
		if (subscription) return;
		const completingOnboarding =
			sessionStorage.getItem('completing_onboarding') === 'true';
		const hasSubscription = subscription !== null;

		if (completingOnboarding && hasSubscription && !isProcessing) {
			sessionStorage.removeItem('completing_onboarding');
			showToast.success('Account setup complete! Welcome to Amara.');

			const refreshAndNavigate = async () => {
				try {
					await supabase.auth.refreshSession();
					await useAuthStore.getState().getProfile();
					window.location.href = '/agent';
				} catch (err) {
					console.error('Error refreshing state before navigation:', err);
					navigate('/agent');
				}
			};
			refreshAndNavigate();
		}
	}, [subscription, navigate, isProcessing]);

	const filteredPlans = subscription
		? (subscriptionType === 'monthly' ? monthlyPlans : paygoPlans).filter(
				(plan: any) => plan.id !== subscription.plan_name,
		  )
		: subscriptionType === 'monthly'
		? monthlyPlans
		: paygoPlans;

	return {
		state: {
			subscription,
			selectedPlanId,
			isProcessing,
			error,
			subscriptionType,
			showTeamPlans,
			isOnboarding,
			monthlyPlans,
			paygoPlans,
			storeLoading,
			availablePlans: filteredPlans,
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
	};
};
