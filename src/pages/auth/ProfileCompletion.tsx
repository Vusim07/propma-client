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

		tenant_id: z.string().optional(),
	})
	.refine(
		(data) => {
			// If role is tenant, require tenant-specific fields
			if (data.role === 'tenant') {
				return (
					!!data.id_number &&
					!!data.employment_status &&
					!!data.monthly_income &&
					!!data.current_address &&
					!!data.tenant_id
				);
			}
			return true;
		},
		{
			message: 'All tenant information is required',
			path: ['role'],
		},
	);

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
			tenant_id: '',
		},
	});

	// Watch the role field to conditionally render tenant-specific fields
	const selectedRole = form.watch('role');

	// Fetch existing tenant profile if available
	const fetchTenantProfile = async (email: string) => {
		try {
			const { data, error } = await supabase
				.from('tenant_profiles')
				.select('*')
				.eq('email', email)
				.maybeSingle();

			if (error) {
				console.error('Error fetching tenant profile:', error);
				return null;
			}

			return data;
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
						setTenantProfile(tenantData);

						// Pre-fill tenant-specific fields
						form.setValue('id_number', tenantData.id_number || '');
						form.setValue(
							'employment_status',
							tenantData.employment_status || '',
						);
						form.setValue(
							'monthly_income',
							tenantData.monthly_income || undefined,
						);
						form.setValue('current_address', tenantData.current_address || '');
					}
				}
			} else {
				// Pre-fill from auth metadata if available
				const { user: authUser } = data.session;
				if (authUser?.user_metadata) {
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
							setTenantProfile(tenantData);
							form.setValue('id_number', tenantData.id_number || '');
							form.setValue(
								'employment_status',
								tenantData.employment_status || '',
							);
							form.setValue(
								'monthly_income',
								tenantData.monthly_income || undefined,
							);
							form.setValue(
								'current_address',
								tenantData.current_address || '',
							);
						}
					}
				}
			}

			setInitialLoading(false);
		};

		checkSession();
	}, [navigate, form, user]);

	const onSubmit = async (values: ProfileCompletionValues) => {
		try {
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
						})
						.eq('id', tenantProfile.id);

					if (error) {
						console.error('Error updating tenant profile:', error);
						showToast.error('Failed to update tenant profile');
						return;
					}
				} else {
					// Create new tenant profile
					const { error } = await supabase
						.from('tenant_profiles')
						.insert(tenantData);

					if (error) {
						console.error('Error creating tenant profile:', error);
						showToast.error('Failed to create tenant profile');
						return;
					}
				}
			}

			// Refresh auth state
			await checkAuth();

			showToast.success('Profile updated successfully!');

			// Check if there's a post-profile completion redirect path
			const redirectPath = sessionStorage.getItem('post_profile_redirect');
			if (redirectPath) {
				sessionStorage.removeItem('post_profile_redirect');
				navigate(redirectPath);
				return;
			}

			// Default navigation based on role
			if (values.role === 'tenant') {
				navigate('/tenant');
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
														<SelectItem key={option.value} value={option.value}>
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
