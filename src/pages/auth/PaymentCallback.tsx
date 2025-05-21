import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';
import paystackService from '../../services/paystackService';
import { showToast } from '../../utils/toast';
import Spinner from '@/components/ui/Spinner';

const PaymentCallback: React.FC = () => {
	const [isProcessing, setIsProcessing] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const location = useLocation();
	const navigate = useNavigate();
	const { initialize } = useAuthStore();

	useEffect(() => {
		const handlePaymentCallback = async () => {
			try {
				// Extract reference from URL
				const searchParams = new URLSearchParams(location.search);
				const reference =
					searchParams.get('reference') || searchParams.get('trxref');

				if (!reference) {
					throw new Error('No payment reference found in URL');
				}

				// First, ensure we have a valid session
				const { data: sessionData } = await supabase.auth.getSession();
				if (!sessionData.session) {
					// Try to restore session from localStorage
					await supabase.auth.refreshSession();

					// Check again
					const { data: refreshedSession } = await supabase.auth.getSession();
					if (!refreshedSession.session) {
						throw new Error(
							'Authentication session lost during payment process',
						);
					}
				}

				// Check if this is a regular subscription payment or upgrade
				const isUpgrade =
					sessionStorage.getItem('paystack_upgrade_reference') === reference;

				if (isUpgrade) {
					sessionStorage.removeItem('paystack_upgrade_reference');
				}

				// Now handle the payment
				await paystackService.handlePaymentCallback(reference);

				// Explicit auth refresh to ensure JWT claims are updated
				await supabase.auth.refreshSession();

				// Completely reinitialize auth state
				await initialize();

				// Check if this was part of onboarding
				const isOnboarding =
					sessionStorage.getItem('completing_onboarding') === 'true';
				sessionStorage.removeItem('completing_onboarding');

				// Show appropriate success message
				if (isOnboarding) {
					showToast.success('Account setup complete! Welcome to Amara.');
				} else if (isUpgrade) {
					showToast.success('Plan upgraded successfully!');
				} else {
					showToast.success('Payment processed successfully!');
				}

				// Navigate to the appropriate destination
				setTimeout(() => {
					// Force a reload to ensure fresh state
					window.location.href = '/agent';
				}, 100);
			} catch (err) {
				console.error('Error processing payment:', err);
				setError(
					err instanceof Error ? err.message : 'Failed to process payment',
				);
				showToast.error('Payment verification failed. Please try again.');
			} finally {
				setIsProcessing(false);
			}
		};

		handlePaymentCallback();
	}, [location, initialize, navigate]);

	if (isProcessing) {
		return (
			<div className='min-h-screen flex flex-col items-center justify-center'>
				<Spinner size='lg' />
				<p className='mt-4 text-gray-600'>Completing your payment...</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className='min-h-screen flex flex-col items-center justify-center'>
				<div className='bg-red-50 text-red-800 p-4 rounded-lg max-w-md'>
					<h2 className='text-lg font-semibold mb-2'>Payment Error</h2>
					<p>{error}</p>
					<button
						className='mt-4 bg-blue-600 text-white px-4 py-2 rounded'
						onClick={() => navigate('/agent/subscription')}
					>
						Return to Subscription Page
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className='min-h-screen flex flex-col items-center justify-center'>
			<Spinner size='lg' />
			<p className='mt-4 text-gray-600'>Redirecting to dashboard...</p>
		</div>
	);
};

export default PaymentCallback;
