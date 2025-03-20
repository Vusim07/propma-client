import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import Spinner from '../../components/ui/Spinner';

const AuthCallback: React.FC = () => {
	const { checkAuth, isLoading, user } = useAuthStore();
	const navigate = useNavigate();

	useEffect(() => {
		const handleCallback = async () => {
			await checkAuth();

			// Wait for auth check to complete
			if (!isLoading && user) {
				// Redirect based on user role
				if (user.role === 'tenant') {
					navigate('/tenant');
				} else if (user.role === 'agent' || user.role === 'landlord') {
					navigate('/agent');
				} else {
					// Default redirect
					navigate('/');
				}
			} else if (!isLoading && !user) {
				// Auth failed or no user
				navigate('/login');
			}
		};

		handleCallback();
	}, [checkAuth, isLoading, user, navigate]);

	return (
		<div className='min-h-screen flex items-center justify-center'>
			<div className='text-center'>
				<Spinner size='lg' />
				<p className='mt-4 text-gray-600'>Completing your sign-in...</p>
			</div>
		</div>
	);
};

export default AuthCallback;
