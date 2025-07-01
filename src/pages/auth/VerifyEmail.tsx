import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import VerifyEmailPrompt from '@/components/ui/VerifyEmailPrompt';
import { showToast } from '@/utils/toast';

const VerifyEmail: React.FC = () => {
	const [isResending, setIsResending] = useState(false);
	const location = useLocation();
	const searchParams = new URLSearchParams(location.search);
	const email =
		(location.state && (location.state as { email?: string })?.email) ||
		searchParams.get('email') ||
		'';

	const handleResend = async () => {
		if (!email) {
			showToast.error(
				'No email address found. Please return to registration or login.',
			);
			return;
		}
		setIsResending(true);
		try {
			const { error } = await supabase.auth.resend({ type: 'signup', email });
			if (error) {
				console.error('Supabase resend error:', error);
				showToast.error('Failed to resend verification email.');
			} else {
				showToast.success(
					'Verification email resent! Please check your inbox.',
				);
			}
		} catch (err) {
			console.error('Resend error:', err);
			showToast.error('An error occurred. Please try again.');
		} finally {
			setIsResending(false);
		}
	};

	return (
		<div className='min-h-screen flex items-center justify-center bg-gray-50'>
			<VerifyEmailPrompt
				onResend={handleResend}
				email={email}
				disabled={!email || isResending}
			/>
			{!email && (
				<p className='text-red-500 mt-4'>
					No email address found. Please return to registration or login.
				</p>
			)}
		</div>
	);
};

export default VerifyEmail;
