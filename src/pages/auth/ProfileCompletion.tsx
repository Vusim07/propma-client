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

// Schema for profile completion form
const profileCompletionSchema = z.object({
	firstName: z.string().min(1, 'First name is required'),
	lastName: z.string().min(1, 'Last name is required'),
	role: z.enum(['tenant', 'agent', 'landlord'], {
		required_error: 'Please select a role',
	}),
	phone: z.string().optional(),
	companyName: z.string().optional(),
});

type ProfileCompletionValues = z.infer<typeof profileCompletionSchema>;

const ProfileCompletion: React.FC = () => {
	const { checkAuth, updateProfile, isLoading, user } = useAuthStore();
	const [session, setSession] = useState<any>(null);
	const [initialLoading, setInitialLoading] = useState(true);
	const navigate = useNavigate();

	const form = useForm<ProfileCompletionValues>({
		resolver: zodResolver(profileCompletionSchema),
		defaultValues: {
			firstName: '',
			lastName: '',
			role: 'tenant',
			phone: '',
			companyName: '',
		},
	});

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

			console.log('Submitting profile with role:', values.role);

			// Ensure role is valid
			if (!['tenant', 'agent', 'landlord'].includes(values.role)) {
				showToast.error('Invalid role selected');
				return;
			}

			// Update profile directly through the auth store
			await updateProfile({
				first_name: values.firstName,
				last_name: values.lastName,
				role: values.role,
				phone: values.phone || null,
				company_name: values.companyName || null,
			});

			// Refresh auth state
			await checkAuth();

			showToast.success('Profile updated successfully!');

			console.log(
				'Profile updated, navigating to dashboard for role:',
				values.role,
			);

			// Add a small delay to ensure state updates propagate
			setTimeout(() => {
				// Redirect based on role
				if (values.role === 'tenant') {
					window.location.href = '/tenant';
				} else {
					window.location.href = '/agent';
				}
			}, 100);
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

					{/* Make the role selection more prominent */}
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

					{form.watch('role') !== 'tenant' && (
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

					<Button type='submit' className='w-full mt-6' isLoading={isLoading}>
						Complete Profile
					</Button>
				</form>
			</Form>
		</div>
	);
};

export default ProfileCompletion;
