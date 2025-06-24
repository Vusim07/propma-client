/* eslint-disable @typescript-eslint/no-explicit-any */
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useTeamStore } from '@/stores/teamStore';
import { supabase } from '@/services/supabase';
import { showToast } from '@/utils/toast';
import { ProfileCompletionValues } from '../schemas/profileCompletionSchema';
import { createSubscription } from '@/services/subscriptionService';

export const useProfileCompletion = (session: any) => {
	const { checkAuth, updateProfile, setHasSubmittedApplication } =
		useAuthStore();
	const { createTeam } = useTeamStore();
	const navigate = useNavigate();

	const onSubmit = async (values: ProfileCompletionValues) => {
		try {
			if (!session) {
				showToast.error('No active session found');
				navigate('/login');
				return;
			}

			showToast.info('Updating your profile...');

			const userData = {
				first_name: values.firstName,
				last_name: values.lastName,
				role: values.role,
				phone: values.phone || null,
				company_name: values.companyName,
				is_individual: !values.isTeamSetup,
			};

			await updateProfile(userData);

			if (
				(values.role === 'agent' || values.role === 'landlord') &&
				values.isTeamSetup &&
				values.teamName
			) {
				try {
					const team = await createTeam(
						values.teamName,
						values.teamPlanType || 'starter',
					);
					if (!team) {
						throw new Error('Failed to create team');
					}
					showToast.success('Team created successfully!');

					const { data: userData, error: userError } = await supabase
						.from('users')
						.select('active_team_id')
						.eq('id', session.user.id)
						.single();

					if (userError) {
						console.error(
							'Error fetching user data after team creation:',
							userError,
						);
					} else if (!userData?.active_team_id) {
						console.error('Active team ID not set after team creation');
						if (team.id) {
							await supabase
								.from('users')
								.update({ active_team_id: team.id })
								.eq('id', session.user.id);
							await supabase.auth.refreshSession();
						}
					}

					await new Promise((resolve) => setTimeout(resolve, 800));
				} catch (teamError: any) {
					console.error('Team creation error:', teamError);
					showToast.error(
						'Failed to create team. You can create one later in settings.',
					);
				}
			}

			let tenantProfileId: string | undefined;
			if (values.role === 'tenant') {
				const userEmail = session.user.email;
				if (!userEmail) {
					showToast.error('User email not found');
					return;
				}

				const { data: tenantProfileData } = await supabase
					.from('tenant_profiles')
					.select('id')
					.eq('tenant_id', session.user.id)
					.maybeSingle();
				tenantProfileId = tenantProfileData?.id;

				if (!tenantProfileId) {
					const { data: newProfile, error: createError } = await supabase
						.from('tenant_profiles')
						.insert({
							tenant_id: session.user.id,
							first_name: values.firstName,
							last_name: values.lastName,
							email: userEmail,
							phone: values.phone,
							employer: values.employer,
							current_address: values.current_address,
							id_number: values.id_number,
							employment_status: values.employment_status,
							monthly_income: values.monthly_income ?? 0,
							employment_duration: values.employment_duration ?? 0, // Include employment_duration
						})
						.select('id')
						.single();
					if (createError) {
						showToast.error(createError.message);
						return;
					}
					tenantProfileId = newProfile.id;
				}
			}

			useAuthStore.setState((state: any) => ({
				user: {
					...state.user,
					role: values.role,
					first_name: values.firstName,
					last_name: values.lastName,
					phone: values.phone,
					company_name: values.companyName,
				},
			}));

			await checkAuth();

			const { data: sessionData } = await supabase.auth.getSession();
			if (!sessionData.session) {
				throw new Error('Session lost during profile completion');
			}

			if (values.role === 'agent') {
				// Auto-subscribe new agents to free-plan
				const subResult = await createSubscription({
					userId: session.user.id,
					planId: 'free-plan',
				});
				if (!subResult.success) {
					showToast.error(
						subResult.message || 'Failed to assign free plan subscription',
					);
				}
			}

			if (values.role === 'agent' || values.role === 'landlord') {
				if (values.isTeamSetup && values.teamPlanType) {
					localStorage.setItem('selectedPlanType', values.teamPlanType);
					localStorage.setItem('isTeamPlan', 'true');
				} else {
					localStorage.setItem('selectedPlanType', 'starter');
					localStorage.setItem('isTeamPlan', 'false');
				}

				window.location.href = '/agent/subscription?onboarding=true';
				return;
			}

			const redirectPath = sessionStorage.getItem('post_profile_redirect');

			if (redirectPath) {
				sessionStorage.removeItem('post_profile_redirect');
				sessionStorage.removeItem('returning_from_profile_completion');

				// Check if we're coming from a property application
				if (redirectPath.includes('/apply/')) {
					navigate(redirectPath, { replace: true });
					window.location.reload(); // Force full page reload
				} else {
					// Default tenant redirect
					navigate(
						`/tenant/documents${
							tenantProfileId ? `?profileId=${tenantProfileId}` : ''
						}`,
					);
					window.location.reload(); // Force full page reload
				}
				return;
			}

			// Default redirect if no stored path
			navigate(
				values.role === 'tenant'
					? `/tenant/documents${
							tenantProfileId ? `?profileId=${tenantProfileId}` : ''
					  }`
					: '/agent',
			);
			window.location.reload(); // Force full page reload
		} catch (error: any) {
			console.error('Profile completion error:', error);
			showToast.error(error.message || 'Failed to complete your profile');
		} finally {
			// Reset the hasSubmittedApplication flag
			setHasSubmittedApplication(false);
		}
	};

	return { onSubmit };
};
