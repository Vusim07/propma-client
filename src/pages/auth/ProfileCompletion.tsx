/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
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
	const { checkAuth, updateProfile, isLoading } = useAuthStore();
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

	// Check if user has a session
	useEffect(() => {
		const checkSession = async () => {
			const { data } = await supabase.auth.getSession();
			if (!data.session) {
				navigate('/login');
				return;
			}

			// Pre-fill the form with any data from auth metadata
			const { user } = data.session;
			if (user.user_metadata) {
				const fullName = user.user_metadata.full_name || '';
				const nameParts = fullName.split(' ');
				const firstName = nameParts[0] || '';
				const lastName = nameParts.slice(1).join(' ') || '';

				form.setValue('firstName', firstName);
				form.setValue('lastName', lastName);
				if (user.phone) {
					form.setValue('phone', user.phone);
				}
			}

			setSession(data.session);
			setInitialLoading(false);
		};

		checkSession();
	}, [navigate, form]);

	const onSubmit = async (values: ProfileCompletionValues) => {
		try {
			if (!session) {
				showToast.error('No active session found');
				navigate('/login');
				return;
			}

			// Call the Supabase Edge Function
			const { data, error } = await supabase.functions.invoke(
				'complete-profile',
				{
					body: JSON.stringify({
						id: session.user.id,
						email: session.user.email,
						first_name: values.firstName,
						last_name: values.lastName,
						role: values.role,
						phone: values.phone || null,
						company_name: values.companyName || null,
					}),
				},
			);

			if (error) {
				throw new Error(error.message || 'Failed to create profile');
			}

			// If we reach here, profile was successfully created
			showToast.success('Profile created successfully!');

			// Refresh auth state
			await checkAuth();

			// Redirect based on role
			if (values.role === 'tenant') {
				navigate('/tenant');
			} else {
				navigate('/agent');
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

					<FormField
						control={form.control}
						name='role'
						render={({ field }) => (
							<FormItem>
								<FormLabel>I am a</FormLabel>
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
