import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../../stores/authStore';
import Button from '../../components/ui/Button';
import { showToast } from '../../utils/toast';
import { registerSchema, RegisterFormValues } from '../../schemas/auth';
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '../../components/ui/form';
import { Input } from '../../components/ui/Input';
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
} from '../../components/ui/Select';
import { LockIcon, MailIcon } from 'lucide-react';

const Register: React.FC = () => {
	const { register: registerUser, isLoading, error } = useAuthStore();
	const navigate = useNavigate();

	const form = useForm<RegisterFormValues>({
		resolver: zodResolver(registerSchema),
		defaultValues: {
			email: '',
			password: '',
			confirmPassword: '',
			role: 'tenant',
		},
	});

	const onSubmit = async (values: RegisterFormValues) => {
		try {
			await registerUser(
				values.email,
				values.password,
				values.role as 'tenant' | 'agent' | 'landlord',
			);

			showToast.success('Account created successfully!');

			// Redirect based on user role
			if (values.role === 'tenant') {
				navigate('/tenant');
			} else if (values.role === 'agent' || values.role === 'landlord') {
				navigate('/agent');
			}
		} catch (err) {
			console.error('Registration error:', err);
		}
	};

	const roleOptions = [
		{ value: 'tenant', label: 'Tenant' },
		{ value: 'agent', label: 'Agent' },
		{ value: 'landlord', label: 'Landlord' },
	];

	return (
		<div className='w-full max-w-md mx-auto space-y-6 p-6 bg-white rounded-lg shadow-md'>
			<img
				src='/assets/amara-logo-black.svg'
				alt='Amara Logo'
				className='h-6 w-auto items-center mx-auto'
			/>
			<div className='text-center'>
				<p className='text-gray-600 mt-2'>Sign up to get started</p>
			</div>

			{error && (
				<div className='p-3 bg-red-50 border border-red-200 rounded-md'>
					<p className='text-sm text-red-600'>{error}</p>
				</div>
			)}

			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
					<FormField
						control={form.control}
						name='email'
						render={({ field }) => (
							<FormItem>
								<FormLabel>Email</FormLabel>
								<div className='relative'>
									<div className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400'>
										<MailIcon className='h-5 w-5' />
									</div>
									<FormControl>
										<Input
											className='pl-10'
											type='email'
											placeholder='you@example.com'
											{...field}
										/>
									</FormControl>
								</div>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name='password'
						render={({ field }) => (
							<FormItem>
								<FormLabel>Password</FormLabel>
								<div className='relative'>
									<div className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400'>
										<LockIcon className='h-5 w-5' />
									</div>
									<FormControl>
										<Input
											className='pl-10'
											type='password'
											placeholder='••••••'
											{...field}
										/>
									</FormControl>
								</div>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name='confirmPassword'
						render={({ field }) => (
							<FormItem>
								<FormLabel>Confirm Password</FormLabel>
								<div className='relative'>
									<div className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400'>
										<LockIcon className='h-5 w-5' />
									</div>
									<FormControl>
										<Input
											className='pl-10'
											type='password'
											placeholder='••••••'
											{...field}
										/>
									</FormControl>
								</div>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name='role'
						render={({ field }) => (
							<FormItem>
								<FormLabel>Account Type</FormLabel>
								<FormControl>
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger className='w-full'>
											<SelectValue placeholder='Select account type' />
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

					<div className='pt-2'>
						<Button
							type='submit'
							isLoading={isLoading}
							fullWidth
							className='w-full'
						>
							Create Account
						</Button>
					</div>
				</form>
			</Form>

			<div className='text-center'>
				<p className='text-sm text-gray-600'>
					Already have an account?{' '}
					<Link
						to='/login'
						className='font-medium text-blue-600 hover:text-blue-500'
					>
						Sign in
					</Link>
				</p>
			</div>
		</div>
	);
};

export default Register;
