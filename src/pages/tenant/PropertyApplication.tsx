/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, createContext, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTenantStore } from '@/stores/tenantStore';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import { Property, Application, TenantProfile } from '@/types';
import { showToast } from '@/utils/toast';

import LoginComponent from '../auth/Login';
import RegisterComponent from '../auth/Register';
import { ApplicationFormStep } from '@/components/tenant/PropertyApplication/ApplicationFormStep';
import { ApplicationProgress } from '@/components/tenant/PropertyApplication/ApplicationProgress';
import { ApplicationSteps } from '@/components/tenant/PropertyApplication/ApplicationSteps';
import { AuthStep } from '@/components/tenant/PropertyApplication/AuthStep';
import { DocumentsStep } from '@/components/tenant/PropertyApplication/DocumentsStep';
import { PropertyDetailsCard } from '@/components/tenant/PropertyApplication/PropertyDetailsCard.tsx';
import { WelcomeStep } from '@/components/tenant/PropertyApplication/WelcomeStep';

// Context for auth flow type
export const AuthFlowContext = createContext<{ isPropertyFlow: boolean }>({
	isPropertyFlow: false,
});

export const useAuthFlowContext = () => useContext(AuthFlowContext);

// Wrapper components that provide context
export const Login = () => (
	<AuthFlowContext.Provider value={{ isPropertyFlow: true }}>
		<LoginComponent />
	</AuthFlowContext.Provider>
);

export const Register = () => (
	<AuthFlowContext.Provider value={{ isPropertyFlow: true }}>
		<RegisterComponent />
	</AuthFlowContext.Provider>
);

interface PropertyApplicationState {
	loading: boolean;
	property: Property | null;
	error: string | null;
	step:
		| 'loading'
		| 'welcome'
		| 'auth'
		| 'application'
		| 'documents'
		| 'complete';
	existingApplication: Application | null;
}

interface TenantProfileWithEmployment extends TenantProfile {
	employer: string | null;
	employment_duration: number;
}

const PropertyApplication: React.FC = () => {
	const { token } = useParams<{ token: string }>();
	const navigate = useNavigate();
	const { user, hasSubmittedApplication, setHasSubmittedApplication }: any =
		useAuthStore(); // Access hasSubmittedApplication from AuthStore
	const { fetchPropertyByToken, submitApplication } = useTenantStore();
	const [returnedFromProfileCompletion, setReturnedFromProfileCompletion] =
		useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [authStep, setAuthStep] = useState<'login' | 'register'>('login');
	const [applicationForm, setApplicationForm] = useState({
		employer: '',
		employment_duration: 0,
		monthly_income: 0,
		notes: '',
	});

	const [state, setState] = useState<PropertyApplicationState>({
		loading: true,
		property: null,
		error: null,
		step: 'loading',
		existingApplication: null,
	});

	const [hasFetchedProperty, setHasFetchedProperty] = useState(false); // New flag to avoid duplicate fetches

	// Set post_profile_redirect on mount
	useEffect(() => {
		const redirectPath = window.location.pathname + window.location.search;
		sessionStorage.setItem('post_profile_redirect', redirectPath);
	}, []);

	// Check if returning from profile completion
	useEffect(() => {
		const justReturned = sessionStorage.getItem(
			'returning_from_profile_completion',
		);
		if (justReturned === 'true') {
			sessionStorage.removeItem('returning_from_profile_completion');
			setReturnedFromProfileCompletion(true);
		}
	}, []);

	// Fetch property and handle application flow
	useEffect(() => {
		// Prevent rerunning if already fetched
		if (hasFetchedProperty) return;

		const getPropertyByToken = async () => {
			if (!token) {
				setState((prev) => ({
					...prev,
					loading: false,
					error: 'Invalid application link',
					step: 'loading',
				}));
				setHasFetchedProperty(true); // Mark as done
				return;
			}

			try {
				const property = await fetchPropertyByToken(token);
				if (!property) {
					setState((prev) => ({
						...prev,
						loading: false,
						error:
							'Property not found. This application link may be invalid or expired.',
						step: 'loading',
					}));
					setHasFetchedProperty(true);
					return;
				}

				if (user) {
					await handleUserLoggedIn(property);
				} else {
					setState((prev) => ({
						...prev,
						loading: false,
						property,
						step: 'welcome',
					}));
					setHasFetchedProperty(true); // Ensure we mark the fetch as complete
				}
			} catch (error) {
				console.error('Error fetching property:', error);
				setState((prev) => ({
					...prev,
					loading: false,
					error:
						error instanceof Error ? error.message : 'Failed to load property',
					step: 'loading',
				}));
				setHasFetchedProperty(true);
			}
		};

		const handleUserLoggedIn = async (property: Property) => {
			try {
				const hasCompletedProfile = returnedFromProfileCompletion
					? true
					: await checkProfileCompletion(user.id);
				if (!hasCompletedProfile) {
					handleProfileCompletionRedirect();
					return;
				}

				const tenantProfileId = await ensureTenantProfile(user.id);
				const existingApplication = await checkForExistingApplications(
					tenantProfileId,
					property.id,
				);

				if (existingApplication) {
					console.log('Existing application found, moving to documents step');
					setState((prev) => ({
						...prev,
						loading: false,
						property,
						existingApplication,
						step: 'documents',
					}));
					setHasFetchedProperty(true); // Mark fetch as complete
					return; // Exit the function here
				}

				// Only get here if no existing application was found
				const profile: any = await fetchTenantProfile(user.id);

				// Pre-fill the form with profile data regardless of completeness
				setApplicationForm({
					employer: profile?.employer || '',
					employment_duration: profile?.employment_duration || 0,
					monthly_income: profile?.monthly_income || 0,
					notes: '',
				});

				// Check if profile has enough data to auto-submit
				if (
					(profile?.monthly_income ?? 0) > 0 &&
					profile?.employment_status &&
					profile?.employer &&
					profile?.employment_duration &&
					!hasSubmittedApplication // Prevent duplicate submission
				) {
					console.log('Complete profile found, auto-submitting application');
					setHasSubmittedApplication(true); // Set the flag to prevent re-submission

					try {
						const applicationData = {
							property_id: property.id,
							agent_id: property.agent_id,
							tenant_id: profile.id,
							employer: profile.employer || 'Not specified',
							employment_duration: profile.employment_duration || 0,
							monthly_income: profile.monthly_income || 0,
							notes: '',
						};

						const application = await submitApplication(applicationData);
						if (!application) throw new Error('Failed to create application');

						showToast.success('Application created based on your profile');
						setState((prev) => ({
							...prev,
							loading: false,
							property,
							existingApplication: application,
							step: 'documents',
						}));
					} catch (error) {
						console.error('Auto-submission failed:', error);
						// Fall back to showing the application form
						setState((prev) => ({
							...prev,
							loading: false,
							property,
							step: 'application',
						}));
					}
				} else {
					// Incomplete profile, show application form
					console.log('Incomplete profile, showing application form');
					setState((prev) => ({
						...prev,
						loading: false,
						property,
						step: 'application',
					}));
				}

				setHasFetchedProperty(true); // Mark fetch as complete
			} catch (error) {
				console.error('Error with tenant profile:', error);
				setState((prev) => ({
					...prev,
					loading: false,
					property: property,
					step: 'application',
				}));
				setHasFetchedProperty(true); // Ensure we mark as complete even on error
			}
		};

		const handleProfileCompletionRedirect = () => {
			sessionStorage.setItem('returning_from_profile_completion', 'true');
			navigate('/profile-completion');
		};

		getPropertyByToken();
	}, [
		token,
		user,
		fetchPropertyByToken,
		navigate,
		returnedFromProfileCompletion,
		hasFetchedProperty,
		submitApplication,
	]);

	// cleanup in useEffect
	useEffect(() => {
		return () => {
			if (!sessionStorage.getItem('returning_from_profile_completion')) {
				sessionStorage.removeItem('post_profile_redirect');
				sessionStorage.removeItem('returning_from_profile_completion');
			}
		};
	}, []);

	// Helper functions
	const checkForExistingApplications = async (
		tenantProfileId: string,
		propertyId: string,
	) => {
		try {
			const { data: applicationId, error: idError } = await supabase.rpc<
				string | null
			>('get_application_id_if_exists', {
				tenant_id_param: tenantProfileId,
				property_id_param: propertyId,
			});

			if (!idError && applicationId) {
				const { data: applicationData, error: appError } = await supabase
					.from('applications')
					.select('*')
					.eq('id', applicationId)
					.single();

				if (!appError && applicationData) return applicationData as Application;
				if (applicationId)
					return createPlaceholderApplication(
						tenantProfileId,
						propertyId,
						applicationId,
					);
			}

			if (idError) {
				const { data: applicationExists } = await supabase.rpc<boolean>(
					'check_application_exists',
					{
						tenant_id_param: tenantProfileId,
						property_id_param: propertyId,
					},
				);

				if (applicationExists === true) {
					const { data: rpcData } = await supabase.rpc<Application[]>(
						'get_tenant_applications_for_property',
						{
							tenant_id_param: tenantProfileId,
							property_id_param: propertyId,
						},
					);

					if (rpcData && rpcData.length > 0) return rpcData[0];
					return createPlaceholderApplication(tenantProfileId, propertyId);
				}
			}

			return null;
		} catch (error) {
			console.error('Unexpected error checking applications:', error);
			return null;
		}
	};

	const createPlaceholderApplication = (
		tenantId: string,
		propertyId: string,
		id = 'placeholder',
	): Application => ({
		id,
		tenant_id: tenantId,
		property_id: propertyId,
		agent_id: '',
		team_id: '',
		created_at: '',
		updated_at: '',
		employer: '',
		employment_duration: 0,
		monthly_income: 0,
		status: 'pending',
		notes: null,
		decision_at: null,
	});

	const ensureTenantProfile = async (userId: string): Promise<string> => {
		try {
			const { data: userData } = await supabase
				.from('users')
				.select('first_name, last_name, email, phone')
				.eq('id', userId)
				.single();

			if (!userData)
				throw new Error('Could not retrieve user data for profile creation');

			try {
				const { data: profileId } = await supabase.rpc<string>(
					'create_tenant_profile',
					{
						p_tenant_id: userId,
						p_first_name: userData.first_name,
						p_last_name: userData.last_name,
						p_email: userData.email,
						p_phone: userData.phone || '',
						p_current_address: '',
						p_id_number: '',
						p_employment_status: 'employed',
						p_monthly_income: 0,
					},
				);
				return profileId as string;
			} catch (funcError) {
				console.error(
					'Stored function unavailable, falling back to direct query:',
					funcError,
				);
				return await fallbackTenantProfileCreation(userId, userData);
			}
		} catch (error) {
			console.error('Error in ensureTenantProfile:', error);
			throw error;
		}
	};

	const fallbackTenantProfileCreation = async (
		userId: string,
		userData: any,
	) => {
		const { data: existingProfiles } = await supabase
			.from('tenant_profiles')
			.select('id')
			.eq('tenant_id', userId);

		if (existingProfiles && existingProfiles.length > 0)
			return existingProfiles[0].id;

		const newProfile = {
			tenant_id: userId,
			first_name: userData.first_name,
			last_name: userData.last_name,
			email: userData.email,
			phone: userData.phone || '',
			current_address: '',
			id_number: '',
			employment_status: 'employed',
			monthly_income: 0,
		};

		const { data: createdProfile }: any = await supabase
			.from('tenant_profiles')
			.insert(newProfile)
			.select('id')
			.single();

		return createdProfile.id;
	};

	const checkProfileCompletion = async (userId: string): Promise<boolean> => {
		try {
			const { data: profile } = await supabase
				.from('tenant_profiles')
				.select('id, employment_status, monthly_income')
				.eq('tenant_id', userId)
				.maybeSingle();

			return !!(
				profile &&
				profile.employment_status &&
				profile.monthly_income > 0
			);
		} catch (error) {
			console.error('Error in checkProfileCompletion:', error);
			return false;
		}
	};

	const fetchTenantProfile = async (
		userId: string,
	): Promise<TenantProfileWithEmployment | null> => {
		try {
			const { data: profileIds } = await supabase
				.from('tenant_profiles')
				.select('id')
				.eq('tenant_id', userId);

			if (profileIds && profileIds.length > 0) {
				const { data: profile } = await supabase
					.from('tenant_profiles')
					.select('*')
					.eq('id', profileIds[0].id)
					.single();
				return profile as TenantProfileWithEmployment;
			}

			const { data: profile } = await supabase
				.from('tenant_profiles')
				.select('*')
				.eq('tenant_id', userId)
				.maybeSingle();

			return profile as TenantProfileWithEmployment;
		} catch (error) {
			console.error('Error in fetchTenantProfile:', error);
			return null;
		}
	};

	const handleApplicationSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!state.property || !user) {
			showToast.error('Missing property or user information');
			return;
		}

		if (submitting) {
			console.log(
				'Preventing duplicate submission - form is already submitting',
			);
			return;
		}

		if (
			isNaN(applicationForm.employment_duration) ||
			isNaN(applicationForm.monthly_income)
		) {
			showToast.error(
				'Please enter valid numbers for employment duration and monthly income',
			);
			return;
		}

		setSubmitting(true);

		try {
			// Check for existing application first
			const tenantProfileId = await ensureTenantProfile(user.id);
			const existingApp = await checkForExistingApplications(
				tenantProfileId,
				state.property.id,
			);

			if (existingApp) {
				console.log('Found existing application:', existingApp);
				showToast.info('You already have an application for this property');
				setState((prev) => ({
					...prev,
					existingApplication: existingApp,
					step: 'documents',
				}));
				return;
			}

			const applicationData = {
				property_id: state.property.id,
				agent_id: state.property.agent_id,
				tenant_id: tenantProfileId,
				employer: applicationForm.employer,
				employment_duration: applicationForm.employment_duration,
				monthly_income: applicationForm.monthly_income,
				notes: applicationForm.notes || undefined,
			};

			const application = await submitApplication(applicationData);
			if (!application) throw new Error('Failed to create application');

			navigate(`/tenant/documents?application=${application.id}`);
		} catch (error) {
			console.error('Application submission error:', error);
			showToast.error(
				error instanceof Error ? error.message : 'Failed to submit application',
			);
		} finally {
			setSubmitting(false);
		}
	};

	if (state.loading) {
		return (
			<div className='flex flex-col items-center justify-center min-h-screen p-4'>
				<Card className='w-full max-w-md text-center p-8 shadow-lg'>
					<Spinner size='lg' className='mx-auto mb-4' />
					<p className='text-gray-600'>Loading property information...</p>
					<p className='text-xs text-gray-500 mt-4'>
						This may take a few moments
					</p>
				</Card>
			</div>
		);
	}

	if (state.error) {
		return (
			<div className='container mx-auto px-4 py-8 max-w-3xl min-h-screen flex items-center justify-center'>
				<Card className='w-full shadow-lg'>
					<CardHeader>
						<h1 className='text-xl md:text-2xl font-bold text-red-600'>
							Error
						</h1>
					</CardHeader>
					<CardContent className='p-4 md:p-6'>
						<Alert variant='error' className='mb-6'>
							{state.error}
						</Alert>
						<p className='mb-6 text-gray-600'>
							The application link you followed appears to be invalid or
							expired.
						</p>
						<ApplicationSteps />
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className='container mx-auto px-4 py-8 max-w-6xl'>
			<div className='flex flex-col lg:flex-row gap-6'>
				{state.property && <PropertyDetailsCard property={state.property} />}

				<div className='w-full lg:w-7/12 mt-6 lg:mt-0'>
					<ApplicationProgress currentStep={state.step} />

					<Card className='shadow-lg'>
						<CardHeader>
							<h2 className='text-xl font-semibold'>
								{state.step === 'welcome' && 'Property Application'}
								{state.step === 'auth' && 'Sign in or Create Account'}
								{state.step === 'application' && 'Rental Application'}
								{state.step === 'documents' && 'Upload Required Documents'}
							</h2>
						</CardHeader>
						<CardContent className='p-4 md:p-6'>
							{state.step === 'welcome' && (
								<WelcomeStep
									onContinue={() =>
										setState((prev) => ({ ...prev, step: 'auth' }))
									}
								/>
							)}
							{state.step === 'auth' && (
								<AuthStep
									authStep={authStep}
									onToggleAuthStep={() =>
										setAuthStep(authStep === 'login' ? 'register' : 'login')
									}
								/>
							)}
							{state.step === 'application' && (
								<ApplicationFormStep
									formData={applicationForm}
									onFormChange={setApplicationForm}
									onSubmit={handleApplicationSubmit}
									submitting={submitting}
								/>
							)}
							{state.step === 'documents' && state.existingApplication && (
								<DocumentsStep applicationId={state.existingApplication.id} />
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
};

export default PropertyApplication;
