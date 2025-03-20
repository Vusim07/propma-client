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

const Login: React.FC = () => {
	const { login, isLoading, error } = useAuthStore();
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
			await login(values.email, values.password);

			// Redirect based on user role
			const user = JSON.parse(localStorage.getItem('user') || '{}');
			if (user.role === 'tenant') {
				showToast.success('Welcome to your tenant dashboard!');
				navigate('/tenant');
			} else if (user.role === 'agent' || user.role === 'landlord') {
				showToast.success(`Welcome to your ${user.role} dashboard!`);
				navigate('/agent');
			}
		} catch (err) {
			console.error('Login error:', err);
		}
	};

	// Demo login shortcuts
	const loginAsTenant = () => {
		form.setValue('email', 'tenant@example.com');
		form.setValue('password', 'password');
	};

	const loginAsAgent = () => {
		form.setValue('email', 'agent@example.com');
		form.setValue('password', 'password');
	};

	const loginAsLandlord = () => {
		form.setValue('email', 'landlord@example.com');
		form.setValue('password', 'password');
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

			<div className='border-t border-gray-200 pt-4'>
				<p className='text-center text-sm font-medium text-gray-500 mb-3'>
					Demo Accounts
				</p>
				<div className='grid grid-cols-3 gap-3'>
					<Button variant='outline' size='sm' onClick={loginAsTenant}>
						Tenant
					</Button>
					<Button variant='outline' size='sm' onClick={loginAsAgent}>
						Agent
					</Button>
					<Button variant='outline' size='sm' onClick={loginAsLandlord}>
						Landlord
					</Button>
				</div>
			</div>
		</div>
	);
};

export default Login;
