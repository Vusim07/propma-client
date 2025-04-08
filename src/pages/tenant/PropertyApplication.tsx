import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import Alert from '../../components/ui/Alert';
import { Property, Application } from '../../types';
import { showToast } from '../../utils/toast';
import {
	Calendar,
	Home,
	MapPin,
	User,
	DollarSign,
	FileText,
} from 'lucide-react';

// Auth form components
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
	loginSchema,
	LoginFormValues,
	registerSchema,
} from '../../schemas/auth';
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '../../components/ui/form';
import { Input } from '../../components/ui/Input';

// Define extended register form values
interface RegisterFormValues {
	email: string;
	password: string;
	confirmPassword: string;
	first_name: string;
	last_name: string;
	phone: string;
}

interface PropertyApplicationState {
	loading: boolean;
	property: Property | null;
	error: string | null;
	step: 'loading' | 'auth' | 'application' | 'documents' | 'complete';
	existingApplication: Application | null;
}

const PropertyApplication: React.FC = () => {
	const { token } = useParams<{ token: string }>();
	const navigate = useNavigate();
	const { user, login, signup, loginWithSocial } = useAuthStore();
	const { fetchPropertyByToken, submitApplication } = useTenantStore();

	const [state, setState] = useState<PropertyApplicationState>({
		loading: true,
		property: null,
		error: null,
		step: 'loading',
		existingApplication: null,
	});

	const [loginMode, setLoginMode] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [applicationForm, setApplicationForm] = useState({
		employer: '',
		employment_duration: 0,
		monthly_income: 0,
		notes: '',
	});

	// Login form setup using react-hook-form with zod validation
	const loginForm = useForm<LoginFormValues>({
		resolver: zodResolver(loginSchema),
		defaultValues: {
			email: '',
			password: '',
		},
	});

	// Register form setup using react-hook-form with zod validation
	const registerForm = useForm<RegisterFormValues>({
		resolver: zodResolver(registerSchema),
		defaultValues: {
			email: '',
			password: '',
			confirmPassword: '',
			first_name: '',
			last_name: '',
			phone: '',
		},
	});

	// Enhance loginWithSocial to store return path
	const handleSocialLogin = (provider: 'google' | 'facebook') => {
		// Store the current URL with the token for return after auth
		const currentPath = window.location.pathname;
		sessionStorage.setItem('auth_return_path', currentPath);

		// Proceed with social login
		loginWithSocial(provider);
	};

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
								step: 'documents', // Skip to document upload
							}));
						} else {
							// No existing application, go to application form
							setState((prev) => ({
								...prev,
								loading: false,
								property,
								step: 'application',
							}));
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
					// User not logged in, show auth screen
					setState((prev) => ({
						...prev,
						loading: false,
						property,
						step: 'auth',
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
	}, [token, user, fetchPropertyByToken]);

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

			// First try check_application_exists RPC
			const { data: applicationExists, error: checkError } =
				await supabase.rpc<boolean>('check_application_exists', {
					tenant_id_param: tenantProfileId,
					property_id_param: propertyId,
				});

			if (!checkError && applicationExists === true) {
				console.log('RPC check for application returned:', applicationExists);

				// Application exists, create a placeholder application object with minimum required fields
				return {
					id: 'placeholder',
					tenant_id: tenantProfileId,
					property_id: propertyId,
					agent_id: '', // These fields are required by the type but not used for our flow
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

			if (checkError) {
				console.log(
					'First RPC method failed, trying alternative',
					checkError.message,
				);

				// Try alternative RPC method as fallback
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
			}

			// If we got here, no application was found or all methods failed
			return null;
		} catch (error) {
			console.error('Unexpected error checking applications:', error);
			return null;
		}
	};

	// Handle login form submission
	const handleLogin = async (values: LoginFormValues) => {
		setSubmitting(true);

		try {
			showToast.info('Signing you in...');

			const loggedInUser = await login(values.email, values.password);

			if (!loggedInUser) {
				showToast.error('Failed to retrieve user data');
				return;
			}

			if (state.property) {
				try {
					// Get or create tenant profile
					const tenantProfileId = await ensureTenantProfile(loggedInUser.id);

					// Check if an existing application exists for this property and tenant
					const existingApplication = await checkForExistingApplications(
						tenantProfileId,
						state.property.id,
					);

					if (existingApplication) {
						console.log('Found existing application after login');
						// There's an existing application, move to the document upload step
						setState((prev) => ({
							...prev,
							step: 'documents', // Skip to document upload
						}));
					} else {
						// No existing application, go to application form
						setState((prev) => ({
							...prev,
							step: 'application',
						}));
					}
				} catch (profileError) {
					console.error('Error with tenant profile after login:', profileError);
					// Still proceed to application form
					setState((prev) => ({
						...prev,
						step: 'application',
					}));
				}
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'Login failed';
			showToast.error(errorMessage);
		} finally {
			setSubmitting(false);
		}
	};

	// Handle registration form submission
	const handleRegister = async (values: RegisterFormValues) => {
		setSubmitting(true);

		try {
			await signup(values.email, values.password, {
				first_name: values.first_name,
				last_name: values.last_name,
				phone: values.phone,
				role: 'tenant', // Force tenant role for property application
			});

			showToast.success('Account created successfully');

			if (state.property) {
				// After registration, move to application form
				setState((prev) => ({
					...prev,
					step: 'application',
				}));
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'Registration failed';
			showToast.error(errorMessage);
		} finally {
			setSubmitting(false);
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

	// Render loading state
	if (state.loading) {
		return (
			<div className='flex items-center justify-center min-h-screen'>
				<Spinner size='lg' />
				<p className='ml-3 text-gray-600'>Loading property information...</p>
			</div>
		);
	}

	// Render error state
	if (state.error) {
		return (
			<div className='container mx-auto px-4 py-16 max-w-3xl'>
				<Card>
					<CardHeader>
						<h1 className='text-2xl font-bold text-red-600'>Error</h1>
					</CardHeader>
					<CardContent>
						<Alert variant='error' className='mb-6'>
							{state.error}
						</Alert>
						<p className='mb-4'>
							The application link you followed appears to be invalid or
							expired.
						</p>
						<div className='flex gap-4'>
							<Link to='/login'>
								<Button>Login to your account</Button>
							</Link>
							<Link to='/'>
								<Button variant='outline'>Go to homepage</Button>
							</Link>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Render property and appropriate step
	return (
		<div className='container mx-auto px-4 py-8 max-w-4xl'>
			{/* Property Details Card */}
			{state.property && (
				<Card className='mb-8'>
					<CardContent className='p-6'>
						<div className='flex flex-col md:flex-row gap-6'>
							{/* Property Image */}
							<div className='w-full md:w-1/3'>
								{state.property.images && state.property.images.length > 0 ? (
									<img
										src={state.property.images[0]}
										alt={state.property.address}
										className='w-full h-40 object-cover rounded-md'
									/>
								) : (
									<div className='w-full h-40 bg-gray-200 flex items-center justify-center rounded-md'>
										<Home size={48} className='text-gray-400' />
									</div>
								)}
							</div>

							{/* Property Details */}
							<div className='w-full md:w-2/3'>
								<h1 className='text-2xl font-bold text-gray-900 mb-2'>
									{state.property.address}
								</h1>
								<div className='flex items-start mb-2'>
									<MapPin size={18} className='text-gray-500 mr-2 mt-1' />
									<p className='text-gray-600'>
										{state.property.city}, {state.property.province}{' '}
										{state.property.postal_code}
									</p>
								</div>
								<div className='grid grid-cols-2 md:grid-cols-3 gap-4 mt-4'>
									<div className='flex items-center'>
										<DollarSign className='h-5 w-5 text-blue-500 mr-2' />
										<div>
											<p className='text-sm text-gray-500'>Monthly Rent</p>
											<p className='font-semibold'>
												R{state.property.monthly_rent.toLocaleString()}
											</p>
										</div>
									</div>
									<div className='flex items-center'>
										<Calendar className='h-5 w-5 text-blue-500 mr-2' />
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
										<Home className='h-5 w-5 text-blue-500 mr-2' />
										<div>
											<p className='text-sm text-gray-500'>Property Type</p>
											<p className='font-semibold capitalize'>
												{state.property.property_type.replace('_', ' ')}
											</p>
										</div>
									</div>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Application Steps */}
			<div className='flex justify-between mb-8 relative'>
				{/* Step Line */}
				<div className='absolute top-4 left-0 right-0 h-1 bg-gray-200 -z-10'></div>

				{/* Step Circles */}
				<div
					className={`flex flex-col items-center relative ${
						state.step === 'auth' || state.step === 'loading'
							? 'text-blue-600'
							: 'text-gray-400'
					}`}
				>
					<div
						className={`w-8 h-8 rounded-full flex items-center justify-center ${
							state.step === 'auth' || state.step === 'loading'
								? 'bg-blue-600 text-white'
								: 'bg-gray-200'
						}`}
					>
						<User size={16} />
					</div>
					<span className='text-xs mt-2'>Authentication</span>
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
			<Card>
				<CardHeader>
					<h2 className='text-xl font-semibold'>
						{state.step === 'auth' && 'Sign in or Create Account'}
						{state.step === 'application' && 'Rental Application'}
						{state.step === 'documents' && 'Upload Required Documents'}
					</h2>
				</CardHeader>
				<CardContent>
					{/* Auth Step */}
					{state.step === 'auth' && (
						<div>
							<div className='flex justify-center mb-6'>
								<div className='flex border border-gray-300 rounded overflow-hidden'>
									<button
										className={`px-4 py-2 ${
											loginMode
												? 'bg-blue-600 text-white'
												: 'bg-white text-gray-700'
										}`}
										onClick={() => setLoginMode(true)}
									>
										Login
									</button>
									<button
										className={`px-4 py-2 ${
											!loginMode
												? 'bg-blue-600 text-white'
												: 'bg-white text-gray-700'
										}`}
										onClick={() => setLoginMode(false)}
									>
										Register
									</button>
								</div>
							</div>

							{/* Social Login Buttons */}
							<div className='space-y-3 mb-6'>
								<Button
									type='button'
									variant='outline'
									onClick={() => handleSocialLogin('google')}
									disabled={submitting}
									className='w-full flex items-center justify-center'
								>
									<img
										src='/assets/icons8-google.svg'
										alt='Google'
										className='h-5 w-5 mr-2'
									/>
									<span>Continue with Google</span>
								</Button>
								<Button
									type='button'
									variant='outline'
									onClick={() => handleSocialLogin('facebook')}
									disabled={submitting}
									className='w-full flex items-center justify-center bg-[#1877F2] text-neutral-800 hover:bg-[#166FE5]'
								>
									<img
										src='/assets/icons8-facebook.svg'
										alt='Facebook'
										className='h-5 w-5 mr-2'
									/>
									<span>Continue with Facebook</span>
								</Button>

								<div className='relative my-6'>
									<div className='absolute inset-0 flex items-center'>
										<div className='w-full border-t border-gray-300'></div>
									</div>
									<div className='relative flex justify-center text-sm'>
										<span className='px-2 bg-white text-gray-500'>
											Or continue with email
										</span>
									</div>
								</div>
							</div>

							{loginMode ? (
								<Form {...loginForm}>
									<form
										onSubmit={loginForm.handleSubmit(handleLogin)}
										className='space-y-4'
									>
										<FormField
											control={loginForm.control}
											name='email'
											render={({ field }) => (
												<FormItem>
													<FormLabel>Email</FormLabel>
													<FormControl>
														<Input
															type='email'
															placeholder='you@example.com'
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={loginForm.control}
											name='password'
											render={({ field }) => (
												<FormItem>
													<FormLabel>Password</FormLabel>
													<FormControl>
														<Input
															type='password'
															placeholder='••••••'
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<Button
											type='submit'
											className='w-full'
											isLoading={submitting}
										>
											Login
										</Button>
									</form>
								</Form>
							) : (
								<Form {...registerForm}>
									<form
										onSubmit={registerForm.handleSubmit(handleRegister)}
										className='space-y-4'
									>
										<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
											<FormField
												control={registerForm.control}
												name='first_name'
												render={({ field }) => (
													<FormItem>
														<FormLabel>First Name</FormLabel>
														<FormControl>
															<Input {...field} />
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
											<FormField
												control={registerForm.control}
												name='last_name'
												render={({ field }) => (
													<FormItem>
														<FormLabel>Last Name</FormLabel>
														<FormControl>
															<Input {...field} />
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
										</div>
										<FormField
											control={registerForm.control}
											name='email'
											render={({ field }) => (
												<FormItem>
													<FormLabel>Email</FormLabel>
													<FormControl>
														<Input
															type='email'
															placeholder='you@example.com'
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={registerForm.control}
											name='phone'
											render={({ field }) => (
												<FormItem>
													<FormLabel>Phone</FormLabel>
													<FormControl>
														<Input
															type='tel'
															placeholder='+27 12 345 6789'
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={registerForm.control}
											name='password'
											render={({ field }) => (
												<FormItem>
													<FormLabel>Password</FormLabel>
													<FormControl>
														<Input type='password' {...field} />
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={registerForm.control}
											name='confirmPassword'
											render={({ field }) => (
												<FormItem>
													<FormLabel>Confirm Password</FormLabel>
													<FormControl>
														<Input type='password' {...field} />
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<Button
											type='submit'
											className='w-full'
											isLoading={submitting}
										>
											Create Account
										</Button>
									</form>
								</Form>
							)}
						</div>
					)}

					{/* Application Step */}
					{state.step === 'application' && (
						<form onSubmit={handleApplicationSubmit} className='space-y-6'>
							<div>
								<p className='text-sm text-gray-600 mb-4'>
									Please provide your employment and income details to complete
									your rental application.
								</p>
							</div>

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
									required
								/>
							</div>

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
											e.target.value === '' ? 0 : parseInt(e.target.value, 10);
										setApplicationForm({
											...applicationForm,
											employment_duration: isNaN(value) ? 0 : value,
										});
									}}
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
											e.target.value === '' ? 0 : parseInt(e.target.value, 10);
										setApplicationForm({
											...applicationForm,
											monthly_income: isNaN(value) ? 0 : value,
										});
									}}
									required
								/>
							</div>

							<div>
								<label
									htmlFor='notes'
									className='block text-sm font-medium text-gray-700 mb-1'
								>
									Additional Notes (optional)
								</label>
								<textarea
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
								/>
							</div>

							<div className='pt-4'>
								<Button type='submit' className='w-full' isLoading={submitting}>
									Next: Upload Documents
								</Button>
							</div>
						</form>
					)}

					{/* Documents Step - Redirect to DocumentUpload instead of duplicating */}
					{state.step === 'documents' && state.existingApplication && (
						<div className='space-y-6'>
							<p className='text-sm text-gray-600'>
								Please upload the required documents to support your
								application.
							</p>

							<div className='text-center py-4'>
								<p className='mb-6'>
									You'll be redirected to our document upload system where you
									can submit your documents.
								</p>
								<Button
									onClick={() =>
										navigate(
											`/tenant/documents?application=${state.existingApplication?.id}`,
										)
									}
									className='w-full md:w-auto'
								>
									<FileText size={16} className='mr-2' />
									Proceed to Document Upload
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
};

export default PropertyApplication;
