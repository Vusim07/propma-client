/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import Spinner from '../../components/ui/Spinner';
import { supabase } from '../../services/supabase';
import { showToast } from '../../utils/toast';

const AuthCallback: React.FC = () => {
	const { checkAuth } = useAuthStore();
	const [processingOAuth, setProcessingOAuth] = useState(true);
	const navigate = useNavigate();

	useEffect(() => {
		const handleCallback = async () => {
			try {
				// Check for URL hash and query parameters
				const hashParams = new URLSearchParams(
					window.location.hash.substring(1),
				);
				const queryParams = new URLSearchParams(window.location.search);

				console.log('URL hash:', window.location.hash);
				console.log('URL search:', window.location.search);

				// Check for stored return path
				const returnTo = sessionStorage.getItem('auth_return_path');
				console.log('Return path:', returnTo);

				// If we have a access_token or code in the URL, exchange it
				const hasAccessToken = hashParams.has('access_token');
				const hasCode = queryParams.has('code');

				console.log('Has access token:', hasAccessToken);
				console.log('Has code:', hasCode);

				if (hasAccessToken || hasCode) {
					console.log('Attempting to set session from URL');
					// The session should be set automatically by Supabase client
					// We'll just wait a moment for it to process
					await new Promise((resolve) => setTimeout(resolve, 500));
				}

				// Check if we have a session
				const {
					data: { session },
				} = await supabase.auth.getSession();
				console.log('Current session:', session ? 'exists' : 'none');

				if (!session) {
					console.error('No session after OAuth redirect');
					showToast.error('Authentication failed. Please try again.');
					navigate('/login');
					return;
				}

				// We have a valid session, now check for profile
				console.log('Auth successful, checking profile');

				// Check if profile exists for this user
				const { data: profileData, error: profileError } = await supabase
					.from('users')
					.select('*')
					.eq('id', session.user.id)
					.maybeSingle();

				console.log('Profile exists?', !!profileData);

				// Create profile if it doesn't exist
				if (!profileData) {
					console.log('Creating profile using Edge Function');
					try {
						// Extract name data if available
						const fullName = session.user.user_metadata?.full_name || '';
						const nameParts = fullName.split(' ');
						const firstName = nameParts[0] || '';
						const lastName = nameParts.slice(1).join(' ') || '';

						// Ensure we have a valid email - this is critical
						if (!session.user.email) {
							console.error('Missing email from OAuth provider');
							showToast.error(
								'Your account requires an email address. Please try registering with email instead.',
							);
							await supabase.auth.signOut();
							navigate('/register');
							return;
						}

						// Check if a profile was pre-created (from our register function)
						const profileId = session.user.user_metadata?.profile_id;
						if (profileId) {
							// Just update the existing profile
							const { error: updateError } = await supabase
								.from('users')
								.update({
									id: session.user.id,
									email: session.user.email.trim().toLowerCase(),
									first_name: firstName || '',
									last_name: lastName || '',
								})
								.eq('id', profileId);

							if (updateError) {
								console.error('Profile update error:', updateError);
								// Continue to fallback logic
							} else {
								// Profile updated successfully, skip the rest
								await checkAuth();

								// Check if we need to redirect to a specific path
								if (returnTo) {
									console.log('Redirecting to stored return path:', returnTo);
									sessionStorage.removeItem('auth_return_path');
									window.location.href = returnTo;
									return;
								}

								navigate('/profile-completion');
								return;
							}
						}

						// Normalize email
						const normalizedEmail = session.user.email.trim().toLowerCase();

						const { error: edgeFnError } = await supabase.functions.invoke(
							'complete-profile',
							{
								body: JSON.stringify({
									id: session.user.id,
									email: normalizedEmail,
									first_name: firstName,
									last_name: lastName,
									role: 'pending', // Use 'pending' to force profile completion
									phone: null,
									company_name: null,
								}),
							},
						);

						if (edgeFnError) {
							console.error('Edge function error:', edgeFnError);
							// Try direct database insert as fallback
							const { error: directError } = await supabase
								.from('users')
								.insert({
									id: session.user.id,
									email: normalizedEmail,
									first_name: firstName,
									last_name: lastName,
									role: 'pending',
									phone: null,
									company_name: null,
								});

							if (directError) {
								console.error('Direct insert error:', directError);
								throw new Error('Multiple profile creation attempts failed');
							}
						}
					} catch (createError) {
						console.error('Error creating profile:', createError);
						showToast.error(
							'Could not complete registration. Please try again.',
						);
						await supabase.auth.signOut();
						navigate('/login');
						return;
					}

					// Redirect to profile completion for additional details
					await checkAuth();

					// Check if we need to redirect to a specific path after profile completion
					if (returnTo) {
						console.log('Redirecting to stored return path:', returnTo);
						sessionStorage.removeItem('auth_return_path');
						window.location.href = returnTo;
						return;
					}

					console.log('Redirecting to profile completion');
					window.location.href = '/profile-completion';
					return;
				}

				// Check if profile needs completing (if role is pending or empty fields)
				if (
					profileData.role === 'pending' ||
					!profileData.first_name ||
					!profileData.last_name
				) {
					console.log('Profile exists but needs completion');
					await checkAuth();

					// Check if we need to redirect to a specific path after profile completion
					if (returnTo) {
						console.log('Setting redirect path for after profile completion');
						sessionStorage.setItem('post_profile_redirect', returnTo);
					}

					console.log('Redirecting to profile completion');
					window.location.href = '/profile-completion';
					return;
				}

				// Profile exists and is complete, check for return path
				await checkAuth();

				if (returnTo) {
					console.log('Redirecting to stored return path:', returnTo);
					sessionStorage.removeItem('auth_return_path');
					window.location.href = returnTo;
					return;
				}

				// No return path, proceed to the appropriate dashboard
				if (profileData.role === 'tenant') {
					console.log('Redirecting to tenant dashboard');
					window.location.href = '/tenant';
				} else if (
					profileData.role === 'agent' ||
					profileData.role === 'landlord'
				) {
					console.log('Redirecting to agent dashboard');
					window.location.href = '/agent';
				} else {
					console.log('Redirecting to home');
					window.location.href = '/';
				}
			} catch (error) {
				console.error('Auth callback error:', error);
				showToast.error('Authentication error. Please try again.');
				navigate('/login');
			} finally {
				setProcessingOAuth(false);
			}
		};

		handleCallback();
	}, [checkAuth, navigate]);

	return (
		<div className='min-h-screen flex items-center justify-center'>
			<div className='text-center'>
				<Spinner size='lg' />
				<p className='mt-4 text-gray-600'>Completing your sign-in...</p>
				<p className='text-sm text-gray-500 mt-2'>
					Please wait, this may take a moment...
				</p>
			</div>
		</div>
	);
};

export default AuthCallback;
