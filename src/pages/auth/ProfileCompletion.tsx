/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '@/stores/authStore';
import Button from '@/components/ui/Button';
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import Spinner from '@/components/ui/Spinner';
import { useSessionCheck } from '@/hooks/useSessionCheck';
import { useProfileCompletion } from '@/hooks/useProfileCompletion';
import { profileCompletionSchema } from '@/schemas/profileCompletionSchema';
import { BasicInfoSection } from '@/components/shared/ProfileCompletion/BasicInfoSection';
import { RoleSelection } from '@/components/shared/ProfileCompletion/RoleSelection';
import { TenantInfoSection } from '@/components/shared/ProfileCompletion/TenantInfoSection';
import { TeamSetupSection } from '@/components/shared/ProfileCompletion/TeamSetupSection';

const ProfileCompletion: React.FC = () => {
	const { user, isLoading: authLoading } = useAuthStore();
	const form = useForm({
		resolver: zodResolver(profileCompletionSchema),
		defaultValues: {
			firstName: '',
			lastName: '',
			role: user?.role === 'pending' ? 'tenant' : user?.role || '',

			phone: '',
			companyName: '',
			id_number: '',
			employment_status: '',
			monthly_income: undefined,
			current_address: '',
			employer: '',
			employment_duration: undefined,
			tenant_id: '',
			isTeamSetup: false,
			teamName: '',
			teamPlanType: 'starter',
		},
	});

	const { session, initialLoading } = useSessionCheck(form, user);
	const { onSubmit } = useProfileCompletion(session);
	const selectedRole = form.watch('role');

	useEffect(() => {
		const subscription = form.watch((value: any, { name }) => {
			if (
				name === 'role' &&
				!['tenant', 'agent', 'landlord'].includes(value.role)
			) {
				form.setValue('role', 'tenant');
			}
		});
		return () => subscription.unsubscribe();
	}, [form]);

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
				<form
					onSubmit={form.handleSubmit(onSubmit as any)}
					className='space-y-4'
				>
					<BasicInfoSection />

					<RoleSelection />

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

					{selectedRole === 'tenant' && <TenantInfoSection />}

					{(selectedRole === 'agent' || selectedRole === 'landlord') && (
						<TeamSetupSection />
					)}

					<Button type='submit' className='w-full mt-6' isLoading={authLoading}>
						Complete Profile
					</Button>
				</form>
			</Form>
		</div>
	);
};

export default ProfileCompletion;
