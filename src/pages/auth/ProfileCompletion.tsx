/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../services/supabase';
import { showToast } from '../../utils/toast';
import Button from '../../components/ui/Button';
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '../../components/ui/form';
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
} from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import Spinner from '../../components/ui/Spinner';
import { TenantProfile } from '../../types';

// Schema for profile completion form
const profileCompletionSchema = z
	.object({
		firstName: z.string().min(1, 'First name is required'),
		lastName: z.string().min(1, 'Last name is required'),
		role: z.enum(['tenant', 'agent', 'landlord'], {
			required_error: 'Please select a role',
		}),
		phone: z.string().optional(),
		companyName: z.string().optional(),
		// Tenant-specific fields
		id_number: z.string().optional(),
		employment_status: z.string().optional(),
		monthly_income: z.coerce.number().optional(),
		current_address: z.string().optional(),
		employer: z.string().optional(),
		employment_duration: z.coerce.number().optional(),
		tenant_id: z.string().optional(),
	})
	.superRefine((data, ctx) => {
		// If role is tenant, require and validate each tenant-specific field individually
		if (data.role === 'tenant') {
			if (!data.id_number) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'ID number is required for tenants',
					path: ['id_number'],
				});
			}

			if (!data.employment_status) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Employment status is required for tenants',
					path: ['employment_status'],
				});
			}

			if (!data.monthly_income) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Monthly income is required for tenants',
					path: ['monthly_income'],
				});
			}

			if (!data.current_address) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Current address is required for tenants',
					path: ['current_address'],
				});
			}

			if (!data.employer) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Employer name is required for tenants',
					path: ['employer'],
				});
			}

			if (!data.employment_duration) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Employment duration is required for tenants',
					path: ['employment_duration'],
				});
			}

			if (!data.tenant_id) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Session error: Please refresh the page or log in again',
					path: ['tenant_id'],
				});
			}
		}
	});

type ProfileCompletionValues = z.infer<typeof profileCompletionSchema>;

const ProfileCompletion: React.FC = () => {
	const { checkAuth, updateProfile, isLoading, user } = useAuthStore();
	const [session, setSession] = useState<any>(null);
	const [initialLoading, setInitialLoading] = useState(true);
	const [tenantProfile, setTenantProfile] = useState<TenantProfile | null>(
		null,
	);
	const navigate = useNavigate();

	const form = useForm<ProfileCompletionValues>({
		resolver: zodResolver(profileCompletionSchema),
		defaultValues: {
			firstName: '',
			lastName: '',
			role: 'agent',
			phone: '',
			companyName: '',
			id_number: '',
			employment_status: '',
			monthly_income: undefined,
			current_address: '',
			employer: '',
			employment_duration: undefined,
			tenant_id: '',
		},
	});

	// Watch the role field to conditionally render tenant-specific fields
	const selectedRole = form.watch('role');

	// Fetch existing tenant profile if available
	const fetchTenantProfile = async (email: string) => {
		try {
			// Changed from maybeSingle to just select, so we can handle multiple results
			const { data, error } = await supabase
				.from('tenant_profiles')
				.select('*')
				.eq('email', email);

			if (error) {
				console.error('Error fetching tenant profile:', error);
				return null;
			}

			// Check if we got any results and take the first one
			if (data && data.length > 0) {
				console.log(
					`Found ${data.length} profile(s) for email: ${email}, using the first one`,
				);
				return data[0];
			}

			return null;
		} catch (error) {
			console.error('Error in fetchTenantProfile:', error);
			return null;
		}
	};

	// Check if user has a session and pre-fill form with existing data
	useEffect(() => {
		const checkSession = async () => {
			const { data } = await supabase.auth.getSession();
			if (!data.session) {
				navigate('/login');
				return;
			}

			setSession(data.session);

			// Set the tenant_id field to the user's ID
			if (data.session.user?.id) {
				form.setValue('tenant_id', data.session.user.id);
			}

			// Pre-fill form with any existing user data
			if (user) {
				form.setValue('firstName', user.first_name || '');
				form.setValue('lastName', user.last_name || '');

				// Default to 'tenant' if role is 'pending' or invalid
				const currentRole = user.role === 'pending' ? 'tenant' : user.role;
				form.setValue('role', (currentRole as any) || 'tenant');

				form.setValue('phone', user.phone || '');
				form.setValue('companyName', user.company_name || '');

				// If user is a tenant, try to fetch tenant profile
				if (user.role === 'tenant' && user.email) {
					const tenantData = await fetchTenantProfile(user.email);
					if (tenantData) {
						const typedTenantData = tenantData as unknown as TenantProfile;
						setTenantProfile(typedTenantData);

						// Pre-fill tenant-specific fields
						form.setValue('id_number', typedTenantData.id_number || '');
						form.setValue(
							'employment_status',
							typedTenantData.employment_status || '',
						);
						form.setValue(
							'monthly_income',
							typedTenantData.monthly_income || undefined,
						);
						form.setValue(
							'current_address',
							typedTenantData.current_address || '',
						);
						form.setValue('employer', typedTenantData.employer || '');
						form.setValue(
							'employment_duration',
							typedTenantData.employment_duration || undefined,
						);
					}
				}
			} else {
				// Pre-fill from auth metadata if available
				const { user: authUser } = data.session;
				if (authUser?.user_metadata) {
					// Also set tenant_id for new users
					form.setValue('tenant_id', authUser.id);

					const fullName = authUser.user_metadata.full_name || '';
					const nameParts = fullName.split(' ');
					const firstName = nameParts[0] || '';
					const lastName = nameParts.slice(1).join(' ') || '';

					form.setValue('firstName', firstName);
					form.setValue('lastName', lastName);

					// Try to get role from metadata or localStorage
					const role =
						authUser.user_metadata.role ||
						localStorage.getItem('userRole') ||
						'tenant';
					form.setValue('role', role as any);

					if (authUser.phone) {
						form.setValue('phone', authUser.phone);
					}

					// If email available and role is tenant, check for tenant profile
					if (authUser.email && role === 'tenant') {
						const tenantData = await fetchTenantProfile(authUser.email);
						if (tenantData) {
							const typedTenantData = tenantData as unknown as TenantProfile;
							setTenantProfile(typedTenantData);
							form.setValue('id_number', typedTenantData.id_number || '');
							form.setValue(
								'employment_status',
								typedTenantData.employment_status || '',
							);
							form.setValue(
								'monthly_income',
								typedTenantData.monthly_income || undefined,
							);
							form.setValue(
								'current_address',
								typedTenantData.current_address || '',
							);
							form.setValue('employer', typedTenantData.employer || '');
							form.setValue(
								'employment_duration',
								typedTenantData.employment_duration || undefined,
							);
						}
					}
				}
			}

			setInitialLoading(false);
		};

		checkSession();
	}, [navigate, form, user]);

	// Add effect to update tenant_id when role changes
	useEffect(() => {
		// Update tenant_id to the user ID if role is tenant
		if (selectedRole === 'tenant' && session?.user?.id) {
			form.setValue('tenant_id', session.user.id);
		}
	}, [selectedRole, session, form]);

	const onSubmit = async (values: ProfileCompletionValues) => {
		try {
			// Debug logging to help troubleshoot validation issues
			console.log('Form submission values:', values);
			console.log('Form errors:', form.formState.errors);
			console.log('Session user ID:', session?.user?.id);

			if (!session) {
				showToast.error('No active session found');
				navigate('/login');
				return;
			}

			// Show loading feedback
			showToast.info('Updating your profile...');

			// Ensure role is valid
			if (!['tenant', 'agent', 'landlord'].includes(values.role)) {
				showToast.error('Invalid role selected');
				return;
			}

			// 1. First update the basic user profile
			const userData = {
				first_name: values.firstName,
				last_name: values.lastName,
				role: values.role,
				phone: values.phone || null,
				company_name: values.companyName || null,
			};

			await updateProfile(userData);

			// 2. If user is a tenant, create or update tenant_profile
			let tenantProfileId: string | undefined;
			if (values.role === 'tenant') {
				const userEmail = session.user.email;
				if (!userEmail) {
					showToast.error('User email not found');
					return;
				}

				// Prepare tenant profile data
				const tenantData = {
					id: tenantProfile?.id, // Will be undefined for new profiles
					tenant_id: session.user.id,
					email: userEmail,
					first_name: values.firstName,
					last_name: values.lastName,
					phone: values.phone || '',
					id_number: values.id_number || '',
					employment_status: values.employment_status || '',
					monthly_income: values.monthly_income || 0,
					current_address: values.current_address || '',
					employer: values.employer || '',
					employment_duration: values.employment_duration || 0,
				};

				// Check if tenant profile exists
				if (tenantProfile?.id) {
					// Update existing profile
					const { error } = await supabase
						.from('tenant_profiles')
						.update({
							first_name: tenantData.first_name,
							last_name: tenantData.last_name,
							phone: tenantData.phone,
							id_number: tenantData.id_number,
							employment_status: tenantData.employment_status,
							monthly_income: tenantData.monthly_income,
							current_address: tenantData.current_address,
							employer: tenantData.employer,
							employment_duration: tenantData.employment_duration,
						})
						.eq('id', tenantProfile.id);

					if (error) {
						console.error('Error updating tenant profile:', error);
						showToast.error('Failed to update tenant profile');
						return;
					}

					tenantProfileId = tenantProfile.id;
				} else {
					// Create new tenant profile
					const { data, error } = await supabase
						.from('tenant_profiles')
						.insert(tenantData)
						.select('id')
						.single();

					if (error) {
						console.error('Error creating tenant profile:', error);
						showToast.error('Failed to create tenant profile');
						return;
					}

					tenantProfileId = data?.id;
				}
			}

			// Refresh auth state
			await checkAuth();

			showToast.success('Profile updated successfully!');

			// Check if there's a post-profile completion redirect path
			const redirectPath = sessionStorage.getItem('post_profile_redirect');
			console.log('Redirect path from session storage:', redirectPath);

			if (redirectPath) {
				// Clear the redirect path from session storage
				sessionStorage.removeItem('post_profile_redirect');

				// Make sure the flag is set to trigger reload of application state in PropertyApplication
				sessionStorage.setItem('returning_from_profile_completion', 'true');

				console.log('Redirecting back to application:', redirectPath);
				navigate(redirectPath);
				return;
			}

			// Default navigation based on role
			if (values.role === 'tenant') {
				// If tenant profile was just completed, redirect to document upload
				console.log('Tenant profile completed, redirecting to document upload');

				// If we have a tenantProfileId, we can pass it as a query parameter
				if (tenantProfileId) {
					navigate(`/tenant/documents?profileId=${tenantProfileId}`);
				} else {
					navigate('/tenant/documents');
				}
			} else if (['agent', 'landlord'].includes(values.role)) {
				navigate('/agent');
			} else {
				navigate('/');
			}
		} catch (error: any) {
			console.error('Profile completion error:', error);
			showToast.error(error.message || 'Failed to complete your profile');
		}
	};

	const roleOptions = [
		{ value: 'tenant', label: 'Tenant' },
		{ value: 'agent', label: 'Agent' },
		{ value: 'landlord', label: 'Landlord' },
	];

	const employmentStatusOptions = [
		{ value: 'full-time', label: 'Full-time employed' },
		{ value: 'part-time', label: 'Part-time employed' },
		{ value: 'self-employed', label: 'Self-employed' },
		{ value: 'unemployed', label: 'Unemployed' },
		{ value: 'student', label: 'Student' },
		{ value: 'retired', label: 'Retired' },
	];

	if (initialLoading) {
		return (
			<div className='min-h-screen flex items-center justify-center'>
				<div className='text-center'>
					<Spinner size='lg' />
					<p className='mt-4 text-gray-600'>Loading your profile...</p>
				</div>
			</div>
		);
	}

	return (
		<div className='w-full max-w-md mx-auto space-y-6 p-6 bg-white rounded-lg shadow-md'>
			<img
				src='/assets/amara-logo-black.svg'
				alt='Amara Logo'
				className='h-6 w-auto items-center mx-auto'
			/>
			<div className='text-center'>
				<h2 className='text-2xl font-bold text-gray-900'>
					Complete Your Profile
				</h2>
				<p className='text-gray-600 mt-2'>
					Please provide some additional information to get started
				</p>
			</div>

			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
					<div className='grid grid-cols-2 gap-4'>
						<FormField
							control={form.control}
							name='firstName'
							render={({ field }) => (
								<FormItem>
									<FormLabel>First Name</FormLabel>
									<FormControl>
										<Input placeholder='John' {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name='lastName'
							render={({ field }) => (
								<FormItem>
									<FormLabel>Last Name</FormLabel>
									<FormControl>
										<Input placeholder='Doe' {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					{/* Role selection */}
					<FormField
						control={form.control}
						name='role'
						render={({ field }) => (
							<FormItem className='border p-4 rounded-lg bg-gray-50'>
								<FormLabel className='text-lg font-medium'>I am a</FormLabel>
								<p className='text-sm text-gray-500 mb-2'>
									Choose your role in the property rental process
								</p>
								<FormControl>
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger className='w-full'>
											<SelectValue placeholder='Select your role' />
										</SelectTrigger>
										<SelectContent>
											{roleOptions.map((role) => (
												<SelectItem key={role.value} value={role.value}>
													{role.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name='phone'
						render={({ field }) => (
							<FormItem>
								<FormLabel>Phone Number</FormLabel>
								<FormControl>
									<Input placeholder='+27 XX XXX XXXX' {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					{selectedRole !== 'tenant' && (
						<FormField
							control={form.control}
							name='companyName'
							render={({ field }) => (
								<FormItem>
									<FormLabel>Company Name</FormLabel>
									<FormControl>
										<Input placeholder='Agency or Company Name' {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					)}

					{/* Tenant-specific fields */}
					{selectedRole === 'tenant' && (
						<div className='space-y-4 border p-4 rounded-lg bg-blue-50'>
							<h3 className='font-medium text-blue-800'>Tenant Information</h3>

							{/* Debug field for tenant_id - normally hidden but useful for troubleshooting */}
							<FormField
								control={form.control}
								name='tenant_id'
								render={({ field }) => (
									<FormItem className='hidden'>
										<FormLabel>Tenant ID (System Field)</FormLabel>
										<FormControl>
											<Input readOnly {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name='id_number'
								render={({ field }) => (
									<FormItem>
										<FormLabel>ID Number</FormLabel>
										<FormControl>
											<Input placeholder='South African ID Number' {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
								<FormField
									control={form.control}
									name='employment_status'
									render={({ field }) => (
										<FormItem>
											<FormLabel>Employment Status</FormLabel>
											<FormControl>
												<Select
													value={field.value}
													onValueChange={field.onChange}
												>
													<SelectTrigger className='w-full'>
														<SelectValue placeholder='Select your employment status' />
													</SelectTrigger>
													<SelectContent>
														{employmentStatusOptions.map((option) => (
															<SelectItem
																key={option.value}
																value={option.value}
															>
																{option.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name='monthly_income'
									render={({ field }) => (
										<FormItem>
											<FormLabel>Monthly Income (ZAR)</FormLabel>
											<FormControl>
												<Input
													type='number'
													placeholder='R 0.00'
													{...field}
													onChange={(e) =>
														field.onChange(e.target.valueAsNumber)
													}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							<FormField
								control={form.control}
								name='employer'
								render={({ field }) => (
									<FormItem>
										<FormLabel>Current Employer</FormLabel>
										<FormControl>
											<Input placeholder='Company name' {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name='employment_duration'
								render={({ field }) => (
									<FormItem>
										<FormLabel>Employment Duration (months)</FormLabel>
										<FormControl>
											<Input
												type='number'
												placeholder='0'
												{...field}
												onChange={(e) => field.onChange(e.target.valueAsNumber)}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name='current_address'
								render={({ field }) => (
									<FormItem>
										<FormLabel>Current Address</FormLabel>
										<FormControl>
											<Input
												placeholder='Your current residential address'
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
					)}

					<Button type='submit' className='w-full mt-6' isLoading={isLoading}>
						Complete Profile
					</Button>
				</form>
			</Form>
		</div>
	);
};

export default ProfileCompletion;
