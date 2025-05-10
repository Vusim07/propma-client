import React, { useEffect, useState, createContext, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import Alert from '../../components/ui/Alert';
import { Property, Application, TenantProfile } from '../../types';
import { showToast } from '../../utils/toast';
import { Input } from '../../components/ui/Input';
import {
	Calendar,
	Home,
	MapPin,
	User,
	DollarSign,
	FileText,
} from 'lucide-react';

// Import AuthLayout and auth components
import AuthLayout from '../../components/layout/AuthLayout';
import LoginComponent from '../auth/Login';
import RegisterComponent from '../auth/Register';
import { Textarea } from '@/components/ui/Textarea';

// Create context for auth flow type
export const AuthFlowContext = createContext<{ isPropertyFlow: boolean }>({
	isPropertyFlow: false,
});

// Provide a hook to use the context safely
// eslint-disable-next-line react-refresh/only-export-components
export const useAuthFlowContext = () => {
	const context = useContext(AuthFlowContext);
	// If context is used outside the provider, it will return the default value
	return context;
};

// Create wrapper components that provide context
const Login = () => (
	<AuthFlowContext.Provider value={{ isPropertyFlow: true }}>
		<LoginComponent />
	</AuthFlowContext.Provider>
);

const Register = () => (
	<AuthFlowContext.Provider value={{ isPropertyFlow: true }}>
		<RegisterComponent />
	</AuthFlowContext.Provider>
);

// Define property application state type
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

// Add this interface to types
interface TenantProfileWithEmployment extends TenantProfile {
	employer?: string;
	employment_duration?: number;
}

const PropertyApplication: React.FC = () => {
	const { token } = useParams<{ token: string }>();
	const navigate = useNavigate();
	const { user } = useAuthStore();
	const { fetchPropertyByToken, submitApplication } = useTenantStore();
	// Add state to track if we need to check profile again after return from profile completion
	const [returnedFromProfileCompletion, setReturnedFromProfileCompletion] =
		useState(false);

	const [state, setState] = useState<PropertyApplicationState>({
		loading: true,
		property: null,
		error: null,
		step: 'loading',
		existingApplication: null,
	});

	// Add form state variables back
	const [submitting, setSubmitting] = useState(false);
	const [applicationForm, setApplicationForm] = useState({
		employer: '',
		employment_duration: 0,
		monthly_income: 0,
		notes: '',
	});

	// Add authStep state to switch between login and register
	const [authStep, setAuthStep] = useState<'login' | 'register'>('login');

	// Check if the user is returning from profile completion on component mount
	useEffect(() => {
		const justReturned = sessionStorage.getItem(
			'returning_from_profile_completion',
		);
		if (justReturned === 'true') {
			console.log('Detected return from profile completion');
			sessionStorage.removeItem('returning_from_profile_completion');
			setReturnedFromProfileCompletion(true);
		}
	}, []);

	// Fetch property based on the application token
	useEffect(() => {
		const getPropertyByToken = async () => {
			if (!token) {
				setState((prev) => ({
					...prev,
					loading: false,
					error: 'Invalid application link',
					step: 'loading',
				}));
				return;
			}

			try {
				// Use the store function to fetch the property
				const property = await fetchPropertyByToken(token);

				if (!property) {
					setState((prev) => ({
						...prev,
						loading: false,
						error:
							'Property not found. This application link may be invalid or expired.',
						step: 'loading',
					}));
					return;
				}

				// If a user is already logged in
				if (user) {
					try {
						// First check if user has completed their profile
						const hasCompletedProfile = await checkProfileCompletion(user.id);

						if (!hasCompletedProfile) {
							// Store the current application path to return after profile completion
							const redirectPath = window.location.pathname;
							console.log(
								'Storing redirect path in sessionStorage:',
								redirectPath,
							);
							sessionStorage.setItem('post_profile_redirect', redirectPath);
							// Set a flag to indicate we're going to profile completion
							sessionStorage.setItem(
								'returning_from_profile_completion',
								'true',
							);
							// Redirect to profile completion
							console.log('Redirecting to profile completion');
							navigate('/profile-completion');
							return;
						}

						// Get or create tenant profile
						const tenantProfileId = await ensureTenantProfile(user.id);

						// Check if an existing application exists for this property and tenant
						const existingApplication = await checkForExistingApplications(
							tenantProfileId,
							property.id,
						);

						if (existingApplication) {
							console.log('Found existing application');
							// There's an existing application, move to the document upload step
							setState((prev) => ({
								...prev,
								loading: false,
								property,
								existingApplication,
								step: 'documents', // Skip to document upload
							}));
						} else {
							// No existing application, check if we already have all required info
							const profile = await fetchTenantProfile(user.id);

							if (
								profile &&
								profile.monthly_income > 0 &&
								profile.employment_status &&
								profile.employer && // Check if employer is available
								profile.employment_duration // Check if employment_duration is available
							) {
								// We already have all the necessary information from profile
								// Pre-fill the form but skip directly to document upload
								setApplicationForm({
									employer: profile.employer || '',
									employment_duration: profile.employment_duration || 0,
									monthly_income: profile.monthly_income || 0,
									notes: '',
								});

								// Auto-submit the application using profile data
								await handleApplicationSubmitWithProfile(profile, property);
							} else {
								// Still need application form data
								setState((prev) => ({
									...prev,
									loading: false,
									property,
									step: 'application',
								}));
							}
						}
					} catch (profileError) {
						console.error('Error with tenant profile:', profileError);
						// Still proceed to application form even if profile creation fails
						setState((prev) => ({
							...prev,
							loading: false,
							property,
							step: 'application',
						}));
					}
				} else {
					// User not logged in, show welcome screen first
					setState((prev) => ({
						...prev,
						loading: false,
						property,
						step: 'welcome',
					}));
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
			}
		};

		getPropertyByToken();
	}, [
		token,
		user,
		fetchPropertyByToken,
		navigate,
		returnedFromProfileCompletion,
	]); // Add returnedFromProfileCompletion dependency

	// Add this function to check for existing applications
	const checkForExistingApplications = async (
		tenantProfileId: string,
		propertyId: string,
	) => {
		try {
			console.log('Checking for existing applications:', {
				tenantId: tenantProfileId,
				propertyId: propertyId,
			});

			// First try to get the actual application ID using the new function
			const { data: applicationId, error: idError } =
				await supabase.rpc<string>('get_application_id_if_exists', {
					tenant_id_param: tenantProfileId,
					property_id_param: propertyId,
				});

			// If we got an application ID, try to fetch full application details
			if (!idError && applicationId) {
				console.log('Found application ID:', applicationId);

				// Try to get the full application data
				const { data: applicationData, error: appError } = await supabase
					.from('applications')
					.select('*')
					.eq('id', applicationId)
					.single();

				if (!appError && applicationData) {
					console.log('Successfully retrieved full application data');
					return applicationData as Application;
				}

				// If we couldn't get full data but have an ID, create a partial application object
				if (applicationId) {
					console.log('Using application ID with partial data');
					return {
						id: applicationId,
						tenant_id: tenantProfileId,
						property_id: propertyId,
						agent_id: '', // These fields are required by the type but will be filled server-side
						created_at: '',
						updated_at: '',
						employer: '',
						employment_duration: 0,
						monthly_income: 0,
						status: 'pending',
						notes: null,
						decision_at: null,
					} as Application;
				}
			}

			// Fallback to the old check method for backward compatibility
			if (idError) {
				console.log(
					'New RPC method failed, trying alternative',
					idError.message,
				);

				// Try the old boolean check function
				const { data: applicationExists, error: checkError } =
					await supabase.rpc<boolean>('check_application_exists', {
						tenant_id_param: tenantProfileId,
						property_id_param: propertyId,
					});

				if (!checkError && applicationExists === true) {
					console.log('Application exists according to boolean check');

					// If app exists but we couldn't get the ID, try alternative RPC
					const { data: rpcData, error: rpcError } = await supabase.rpc<
						Application[]
					>('get_tenant_applications_for_property', {
						tenant_id_param: tenantProfileId,
						property_id_param: propertyId,
					});

					if (!rpcError && rpcData && rpcData.length > 0) {
						console.log(
							'Found existing application via alternative RPC:',
							rpcData[0],
						);
						return rpcData[0];
					}

					if (rpcError) {
						console.log(
							'All RPC methods failed, skipping direct query due to RLS issues',
						);
					}

					// Last resort - use a placeholder as before
					return {
						id: 'placeholder',
						tenant_id: tenantProfileId,
						property_id: propertyId,
						agent_id: '',
						created_at: '',
						updated_at: '',
						employer: '',
						employment_duration: 0,
						monthly_income: 0,
						status: 'pending',
						notes: null,
						decision_at: null,
					} as Application;
				}
			}

			// If we got here, no application was found or all methods failed
			return null;
		} catch (error) {
			console.error('Unexpected error checking applications:', error);
			return null;
		}
	};

	// Add this function to create a tenant profile if needed
	const ensureTenantProfile = async (userId: string): Promise<string> => {
		try {
			// Try to use our stored function first (this bypasses RLS)
			try {
				// Get the user data first
				const { data: userData, error: userError } = await supabase
					.from('users')
					.select('first_name, last_name, email, phone')
					.eq('id', userId)
					.single();

				if (userError) {
					console.error('Error fetching user data:', userError);
					throw new Error('Could not retrieve user data for profile creation');
				}

				// Use the create_tenant_profile function to safely check/create profile
				const { data: profileId, error } = await supabase.rpc<string>(
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

				if (error) {
					console.error('Error using create_tenant_profile function:', error);
					throw error;
				}

				console.log('Profile created or retrieved with ID:', profileId);
				return profileId as string;
			} catch (funcError) {
				console.error(
					'Stored function unavailable, falling back to direct query:',
					funcError,
				);

				// Fallback to direct insert (less reliable due to RLS)
				const { data: existingProfiles, error: profileError } = await supabase
					.from('tenant_profiles')
					.select('id')
					.eq('tenant_id', userId);

				if (profileError) {
					console.error('Could not query existing profiles:', profileError);
					throw new Error('Could not check for existing tenant profile');
				}

				if (existingProfiles && existingProfiles.length > 0) {
					return existingProfiles[0].id;
				}

				// No profile exists, create new one
				const { data: userData, error: userError } = await supabase
					.from('users')
					.select('first_name, last_name, email, phone')
					.eq('id', userId)
					.single();

				if (userError) {
					console.error('Error fetching user data:', userError);
					throw new Error('Could not retrieve user data for profile creation');
				}

				// Create a new tenant profile
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

				const { data: createdProfile, error: createError } = await supabase
					.from('tenant_profiles')
					.insert(newProfile)
					.select('id')
					.single();

				if (createError) {
					console.error('Could not create tenant profile:', createError);
					throw new Error('Failed to create tenant profile');
				}

				return createdProfile.id;
			}
		} catch (error) {
			console.error('Error in ensureTenantProfile:', error);
			throw error;
		}
	};

	// New function to check if the user has completed their profile
	const checkProfileCompletion = async (userId: string): Promise<boolean> => {
		try {
			console.log('Checking profile completion for user ID:', userId);

			// Check if user has a tenant profile with complete information
			const { data: profile, error } = await supabase
				.from('tenant_profiles')
				.select('id, employment_status, monthly_income')
				.eq('tenant_id', userId)
				.maybeSingle();

			if (error) {
				console.error('Error checking profile completion:', error);
				return false;
			}

			// Profile is complete if it exists and has employment status and income
			const isComplete = !!(
				profile &&
				profile.employment_status &&
				profile.monthly_income > 0
			);

			console.log('Profile completion check result:', {
				profileExists: !!profile,
				hasEmployment: !!profile?.employment_status,
				hasIncome: !!(profile?.monthly_income && profile.monthly_income > 0),
				isComplete,
			});

			return isComplete;
		} catch (error) {
			console.error('Error in checkProfileCompletion:', error);
			return false;
		}
	};

	// New function to fetch tenant profile
	const fetchTenantProfile = async (
		userId: string,
	): Promise<TenantProfileWithEmployment | null> => {
		try {
			// First check if we need to get the user profile ID from previously created profile
			const { data: profileIds, error: profileIdsError } = await supabase
				.from('tenant_profiles')
				.select('id')
				.eq('tenant_id', userId);

			if (profileIdsError) {
				console.error('Error checking tenant profiles:', profileIdsError);
				return null;
			}

			// Log diagnostic information if multiple profiles found
			if (profileIds && profileIds.length > 1) {
				console.warn(
					`Multiple tenant profiles found for user ID ${userId}:`,
					profileIds.map((p) => p.id),
				);
				console.warn('Using the first profile ID:', profileIds[0].id);
			}

			// Fetch complete profile for the first profile ID or directly by tenant_id if no profiles found
			if (profileIds && profileIds.length > 0) {
				const { data: profile, error } = await supabase
					.from('tenant_profiles')
					.select('*')
					.eq('id', profileIds[0].id)
					.single();

				if (error) {
					console.error(
						`Error fetching tenant profile by ID ${profileIds[0].id}:`,
						error,
					);
					return null;
				}

				return profile as TenantProfileWithEmployment;
			} else {
				// Try direct query as fallback
				const { data: profile, error } = await supabase
					.from('tenant_profiles')
					.select('*')
					.eq('tenant_id', userId)
					.maybeSingle();

				if (error) {
					console.error('Error fetching tenant profile by tenant_id:', error);
					return null;
				}

				return profile as TenantProfileWithEmployment;
			}
		} catch (error) {
			console.error('Error in fetchTenantProfile:', error);
			return null;
		}
	};

	// Function to handle application submission using profile data
	const handleApplicationSubmitWithProfile = async (
		profile: TenantProfileWithEmployment,
		property: Property,
	) => {
		if (!property || !user) {
			showToast.error('Missing property or user information');
			return;
		}

		setSubmitting(true);

		try {
			// Use the tenant profile ID directly
			console.log('Using tenant profile ID:', profile.id);

			// Prepare application data from profile
			const applicationData = {
				property_id: property.id,
				agent_id: property.agent_id,
				tenant_id: profile.id,
				employer: profile.employer || 'Not specified',
				employment_duration: profile.employment_duration || 0,
				monthly_income: profile.monthly_income || 0,
				notes: '',
			};

			console.log(
				'Auto-submitting application with profile data:',
				applicationData,
			);

			// Use the store function to submit the application
			const application = await submitApplication(applicationData);

			if (!application) {
				throw new Error('Failed to create application');
			}

			showToast.success('Application created based on your profile');

			// Set the application in state and move to documents step
			setState((prev) => ({
				...prev,
				existingApplication: application,
				step: 'documents',
			}));
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'Failed to submit application';
			console.error('Application submission error:', error);
			showToast.error(errorMessage);
			// Fall back to manual application form
			setState((prev) => ({
				...prev,
				step: 'application',
			}));
		} finally {
			setSubmitting(false);
		}
	};

	// Handle application form submission
	const handleApplicationSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!state.property || !user) {
			showToast.error('Missing property or user information');
			return;
		}

		// Validate numeric inputs
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
			// Ensure a tenant profile exists and get its ID
			const tenantProfileId = await ensureTenantProfile(user.id);
			console.log('Using tenant profile ID:', tenantProfileId);

			// Debug the data being sent
			const applicationData = {
				property_id: state.property.id,
				agent_id: state.property.agent_id,
				tenant_id: tenantProfileId, // Use the tenant profile ID, not the user ID
				employer: applicationForm.employer,
				employment_duration: applicationForm.employment_duration,
				monthly_income: applicationForm.monthly_income,
				notes: applicationForm.notes || undefined,
			};

			console.log('Submitting application with data:', applicationData);

			// Use the store function to submit the application
			const application = await submitApplication(applicationData);

			if (!application) {
				throw new Error('Failed to create application');
			}

			showToast.success('Application submitted successfully');

			// Redirect to tenant document upload page with the application ID
			navigate(`/tenant/documents?application=${application.id}`);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'Failed to submit application';
			console.error('Application submission error:', error);
			showToast.error(errorMessage);
		} finally {
			setSubmitting(false);
		}
	};

	// Render the appropriate step content
	const renderStepContent = () => {
		switch (state.step) {
			case 'loading':
				return (
					<div className='text-center'>
						<p>Loading property information...</p>
					</div>
				);
			case 'welcome':
				return (
					<div className='space-y-6 text-center py-2 md:py-6'>
						<h3 className='text-xl font-semibold mb-4'>Ready to Apply?</h3>
						<p className='text-gray-600 mb-6 md:mb-8 px-2 md:px-8'>
							You're about to start your application for this property. You'll
							need to create a free account or sign in to continue.
						</p>

						<div className='bg-gray-50 rounded-lg p-4 mb-6 text-left'>
							<h4 className='font-medium text-gray-800 mb-2'>
								Application Process
							</h4>
							<ol className='list-decimal pl-5 text-sm text-gray-600 space-y-2'>
								<li>
									<span className='font-medium'>Create Account/Sign In</span> -
									First, you'll need to authenticate
								</li>
								<li>
									<span className='font-medium'>Complete Profile</span> - Fill
									in your tenant information
								</li>
								<li>
									<span className='font-medium'>Upload Documents</span> -
									Provide verification documents
								</li>
								<li>
									<span className='font-medium'>Screening</span> - We'll review
									your application
								</li>
								<li>
									<span className='font-medium'>Results</span> - You'll receive
									a notification about your application status
								</li>
							</ol>
						</div>

						<div className='flex justify-center'>
							<Button
								className='w-full md:w-auto px-6 py-2 text-base'
								onClick={() => setState((prev) => ({ ...prev, step: 'auth' }))}
							>
								Continue with Application
							</Button>
						</div>
					</div>
				);
			case 'auth':
				return (
					<div className='px-2 md:px-4'>
						<div className='bg-blue-50 p-4 rounded-md mb-6'>
							<p className='text-sm text-blue-800'>
								Please sign in or create an account to continue with your
								application. After signing in, you'll complete your tenant
								profile with required information.
							</p>
						</div>
						<AuthLayout
							title=''
							className='py-0 min-h-0'
							wrapperClassName='mt-0'
							contentClassName='py-4'
						>
							{authStep === 'login' ? (
								<>
									<Login />
									<p className='text-center mt-4'>
										<button
											onClick={() => setAuthStep('register')}
											className='text-blue-600 hover:text-blue-800 underline text-sm md:text-base px-4 py-2'
										>
											Don't have an account? Register here
										</button>
									</p>
								</>
							) : (
								<>
									<Register />
									<p className='text-center mt-4'>
										<button
											onClick={() => setAuthStep('login')}
											className='text-blue-600 hover:text-blue-800 underline text-sm md:text-base px-4 py-2'
										>
											Already have an account? Sign in
										</button>
									</p>
								</>
							)}
						</AuthLayout>
					</div>
				);
			case 'application':
				return (
					<form onSubmit={handleApplicationSubmit} className='space-y-6'>
						<div className='bg-blue-50 p-4 rounded-md mb-6'>
							<p className='text-sm text-blue-800'>
								Please provide your employment and income details to complete
								your rental application. This information helps us assess
								affordability and suitability.
							</p>
							<p className='text-sm text-blue-800 mt-2'>
								After this step, you'll need to upload supporting documents to
								verify this information.
							</p>
						</div>

						<div className='space-y-4 md:space-y-6'>
							<div>
								<label
									htmlFor='employer'
									className='block text-sm font-medium text-gray-700 mb-1'
								>
									Current Employer
								</label>
								<Input
									id='employer'
									value={applicationForm.employer}
									onChange={(e) =>
										setApplicationForm({
											...applicationForm,
											employer: e.target.value,
										})
									}
									className='w-full'
									placeholder='Company name'
									required
								/>
							</div>

							<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
								<div>
									<label
										htmlFor='employment_duration'
										className='block text-sm font-medium text-gray-700 mb-1'
									>
										Employment Duration (months)
									</label>
									<Input
										id='employment_duration'
										type='number'
										min='0'
										value={applicationForm.employment_duration}
										onChange={(e) => {
											const value =
												e.target.value === ''
													? 0
													: parseInt(e.target.value, 10);
											setApplicationForm({
												...applicationForm,
												employment_duration: isNaN(value) ? 0 : value,
											});
										}}
										className='w-full'
										placeholder='0'
										required
									/>
								</div>

								<div>
									<label
										htmlFor='monthly_income'
										className='block text-sm font-medium text-gray-700 mb-1'
									>
										Monthly Income (ZAR)
									</label>
									<Input
										id='monthly_income'
										type='number'
										min='0'
										value={applicationForm.monthly_income}
										onChange={(e) => {
											const value =
												e.target.value === ''
													? 0
													: parseInt(e.target.value, 10);
											setApplicationForm({
												...applicationForm,
												monthly_income: isNaN(value) ? 0 : value,
											});
										}}
										className='w-full'
										placeholder='0'
										required
									/>
									<p className='text-xs text-gray-500 mt-1'>
										This helps us determine if the property is within your
										affordability range
									</p>
								</div>
							</div>

							<div>
								<label
									htmlFor='notes'
									className='block text-sm font-medium text-gray-700 mb-1'
								>
									Additional Notes (optional)
								</label>
								<Textarea
									id='notes'
									className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
									rows={3}
									value={applicationForm.notes}
									onChange={(e) =>
										setApplicationForm({
											...applicationForm,
											notes: e.target.value,
										})
									}
									placeholder='Any additional information that might help your application'
								/>
							</div>
						</div>

						<div className='pt-6 md:pt-8'>
							<Button type='submit' className='w-full' isLoading={submitting}>
								Next: Upload Documents
							</Button>
						</div>
					</form>
				);
			case 'documents':
				return (
					<div className='space-y-6'>
						<div className='bg-blue-50 p-4 rounded-md mb-6'>
							<p className='text-sm text-blue-800'>
								Please upload the required documents to support your
								application. You must upload all required documents to finalize
								your application.
							</p>
							<ul className='text-sm text-blue-800 mt-2 pl-5 list-disc'>
								<li>Proof of Identity (ID/Passport/Driver's License)</li>
								<li>Proof of Income (Pay slips)</li>
								<li>Bank Statements (last 3 months)</li>
							</ul>
						</div>

						<div className='bg-gray-50 rounded-lg p-4 mb-6 text-left'>
							<h4 className='font-medium text-gray-800 mb-2'>
								Document Upload Process
							</h4>
							<ol className='list-decimal pl-5 text-sm text-gray-600 space-y-2'>
								<li>
									<span className='font-medium'>Upload Required Documents</span>{' '}
									- Add all needed verification documents
								</li>
								<li>
									<span className='font-medium'>Review Documents</span> - Ensure
									they are correctly labeled
								</li>
								<li>
									<span className='font-medium'>Complete Application</span> -
									Click the "Complete Application" button to finalize
								</li>
								<li>
									<span className='font-medium'>View Screening Results</span> -
									After submission, you'll see your screening results
								</li>
								<li>
									<span className='font-medium'>Schedule Appointment</span> - If
									you are pre-approved, you can go ahead and schedule a viewing
									appointment.
								</li>
							</ol>
						</div>

						<div className='text-center py-4'>
							<Button
								onClick={() =>
									navigate(
										`/tenant/documents?application=${state.existingApplication?.id}`,
									)
								}
								className='w-full md:w-auto px-6'
							>
								<FileText size={16} className='mr-2' />
								Proceed to Document Upload
							</Button>
							<p className='mt-4 text-sm text-gray-500'>
								After you've uploaded your documents, you'll be able to complete
								your application and view your screening results.
							</p>
						</div>
					</div>
				);
			default:
				return null;
		}
	};

	// Render loading state
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

	// Render error state
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
						<div className='flex flex-col sm:flex-row gap-4'>
							<Link to='/login' className='w-full sm:w-auto'>
								<Button className='w-full'>Login to your account</Button>
							</Link>
							<Link to='/' className='w-full sm:w-auto'>
								<Button variant='outline' className='w-full'>
									Go to homepage
								</Button>
							</Link>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Render property and appropriate step
	return (
		<div className='container mx-auto px-4 py-8 max-w-6xl'>
			{/* Two column layout on desktop, stacked on mobile */}
			<div className='flex flex-col lg:flex-row gap-6'>
				{/* Property Details Column - Left side on desktop, top on mobile */}
				<div className='w-full lg:w-5/12'>
					{state.property && (
						<Card className='sticky top-6'>
							<CardHeader>
								<h2 className='text-xl font-semibold'>Property Details</h2>
							</CardHeader>
							<CardContent className='p-4 md:p-6'>
								{/* Property Image */}
								<div className='mb-6'>
									{state.property.images && state.property.images.length > 0 ? (
										<img
											src={state.property.images[0]}
											alt={state.property.address}
											className='w-full h-48 md:h-56 object-cover rounded-md'
										/>
									) : (
										<div className='w-full h-48 md:h-56 bg-gray-200 flex items-center justify-center rounded-md'>
											<Home size={64} className='text-gray-400' />
										</div>
									)}
								</div>

								{/* Property Details */}
								<div>
									<h1 className='text-xl md:text-2xl font-bold text-gray-900 mb-2'>
										{state.property.address}
									</h1>
									<div className='flex items-start mb-4'>
										<MapPin
											size={18}
											className='text-gray-500 mr-2 mt-1 flex-shrink-0'
										/>
										<p className='text-gray-600'>
											{state.property.city}, {state.property.province}{' '}
											{state.property.postal_code}
										</p>
									</div>
									<div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4'>
										<div className='flex items-center'>
											<DollarSign className='h-5 w-5 text-blue-500 mr-2 flex-shrink-0' />
											<div>
												<p className='text-sm text-gray-500'>Monthly Rent</p>
												<p className='font-semibold'>
													R{state.property.monthly_rent.toLocaleString()}
												</p>
											</div>
										</div>
										<div className='flex items-center'>
											<Calendar className='h-5 w-5 text-blue-500 mr-2 flex-shrink-0' />
											<div>
												<p className='text-sm text-gray-500'>Available From</p>
												<p className='font-semibold'>
													{new Date(
														state.property.available_from,
													).toLocaleDateString()}
												</p>
											</div>
										</div>
										<div className='flex items-center'>
											<Home className='h-5 w-5 text-blue-500 mr-2 flex-shrink-0' />
											<div>
												<p className='text-sm text-gray-500'>Property Type</p>
												<p className='font-semibold capitalize'>
													{state.property.property_type.replace('_', ' ')}
												</p>
											</div>
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					)}
				</div>

				{/* Application Steps Column - Right side on desktop, bottom on mobile */}
				<div className='w-full lg:w-7/12 mt-6 lg:mt-0'>
					{/* Application Steps Progress */}
					<div className='flex justify-between mb-6 relative px-4'>
						{/* Step Line */}
						<div className='absolute top-4 left-0 right-0 h-1 bg-gray-200 -z-10'></div>

						{/* Step Circles */}
						<div
							className={`flex flex-col items-center relative ${
								state.step === 'welcome' ||
								state.step === 'auth' ||
								state.step === 'loading'
									? 'text-blue-600'
									: 'text-gray-400'
							}`}
						>
							<div
								className={`w-8 h-8 rounded-full flex items-center justify-center ${
									state.step === 'welcome'
										? 'bg-blue-600 text-white'
										: state.step === 'auth' || state.step === 'loading'
										? 'bg-blue-600 text-white'
										: 'bg-gray-200'
								}`}
							>
								<User size={16} />
							</div>
							<span className='text-xs mt-2'>
								{state.step === 'welcome' ? 'Get Started' : 'Account'}
							</span>
						</div>

						<div
							className={`flex flex-col items-center relative ${
								state.step === 'application' ? 'text-blue-600' : 'text-gray-400'
							}`}
						>
							<div
								className={`w-8 h-8 rounded-full flex items-center justify-center ${
									state.step === 'application'
										? 'bg-blue-600 text-white'
										: state.step === 'documents'
										? 'bg-green-500 text-white'
										: 'bg-gray-200'
								}`}
							>
								<Home size={16} />
							</div>
							<span className='text-xs mt-2'>Application</span>
						</div>

						<div
							className={`flex flex-col items-center relative ${
								state.step === 'documents' ? 'text-blue-600' : 'text-gray-400'
							}`}
						>
							<div
								className={`w-8 h-8 rounded-full flex items-center justify-center ${
									state.step === 'documents'
										? 'bg-blue-600 text-white'
										: 'bg-gray-200'
								}`}
							>
								<FileText size={16} />
							</div>
							<span className='text-xs mt-2'>Documents</span>
						</div>
					</div>

					{/* Step Content */}
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
							{renderStepContent()}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
};

export default PropertyApplication;
