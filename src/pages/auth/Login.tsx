/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../../stores/authStore';
import Button from '../../components/ui/Button';
import { showToast } from '../../utils/toast';
import { loginSchema, LoginFormValues } from '../../schemas/auth';
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '../../components/ui/form';
import { Input } from '../../components/ui/Input';
import { LockIcon, MailIcon } from 'lucide-react';
import { useAuthFlowContext } from '../tenant/PropertyApplication';

const Login: React.FC = () => {
	const { isPropertyFlow } = useAuthFlowContext();
	const { login, loginWithSocial, isLoading, error } = useAuthStore();
	const navigate = useNavigate();

	const form = useForm<LoginFormValues>({
		resolver: zodResolver(loginSchema),
		defaultValues: {
			email: '',
			password: '',
		},
	});

	const onSubmit = async (values: LoginFormValues) => {
		try {
			// Show loading toast
			showToast.info('Signing you in...');

			console.log('Login attempt with:', values.email);

			// Login and get the profile data
			const profile = await login(values.email, values.password);
			console.log('Login successful, profile received:', profile?.role);

			if (!profile) {
				showToast.error('Failed to retrieve user data');
				return;
			}

			// Determine destination based on role
			let destination = '/';
			if (profile.role === 'tenant') {
				destination = '/tenant';
				showToast.success('Welcome to your tenant dashboard!');
			} else if (profile.role === 'agent' || profile.role === 'landlord') {
				destination = '/agent';
				showToast.success(`Welcome to your ${profile.role} dashboard!`);
			}

			console.log('About to navigate to:', destination);

			// Try immediate navigation first
			navigate(destination);

			// Set a fallback navigation with a slight delay to ensure it happens
			setTimeout(() => {
				console.log('Executing fallback navigation to:', destination);
				window.location.href = destination;
			}, 300);
		} catch (err: any) {
			console.error('Login error:', err);
			showToast.error(err.message || 'Login failed. Please try again.');
		}
	};

	return (
		<div className='w-full max-w-md mx-auto space-y-6 p-6 bg-white rounded-lg shadow-md'>
			<img
				src='/assets/amara-logo-black.svg'
				alt='Amara Logo'
				className='h-6 w-auto items-center mx-auto'
			/>
			<div className='text-center mx-auto'>
				<p className='text-gray-600 mt-2'>
					Welcome back! Please sign in to your account
				</p>
			</div>

			{error && (
				<div className='p-3 bg-red-50 border border-red-200 rounded-md'>
					<p className='text-sm text-red-600'>{error}</p>
				</div>
			)}

			{/* Social Login Buttons */}
			<div className='space-y-3'>
				<Button
					type='button'
					variant='outline'
					onClick={() => loginWithSocial('google')}
					disabled={isLoading}
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
					onClick={() => loginWithSocial('facebook')}
					disabled={isLoading}
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

					<div className='pt-2'>
						<Button
							type='submit'
							isLoading={isLoading}
							fullWidth
							className='w-full'
						>
							Sign in
						</Button>
					</div>
				</form>
			</Form>

			{!isPropertyFlow && (
				<div className='text-center'>
					<p className='text-sm text-gray-600'>
						Don't have an account?{' '}
						<Link
							to='/register'
							className='font-medium text-blue-600 hover:text-blue-500'
						>
							Register here
						</Link>
					</p>
				</div>
			)}
		</div>
	);
};

export default Login;
