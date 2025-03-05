import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Input } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import { showToast } from '../../utils/toast';

const Login: React.FC = () => {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [formError, setFormError] = useState('');

	const { login, isLoading, error } = useAuthStore();
	const navigate = useNavigate();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setFormError('');

		if (!email || !password) {
			setFormError('Please enter both email and password');
			return;
		}

		try {
			await login(email, password);

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
		setEmail('tenant@example.com');
		setPassword('password');
	};

	const loginAsAgent = () => {
		setEmail('agent@example.com');
		setPassword('password');
	};

	const loginAsLandlord = () => {
		setEmail('landlord@example.com');
		setPassword('password');
	};

	return (
		<div>
			{(error || formError) && (
				<Alert variant='error' className='mb-4'>
					{formError || error}
				</Alert>
			)}

			<form onSubmit={handleSubmit}>
				<Input
					type='email'
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
					autoComplete='email'
				/>

				<Input
					type='password'
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
					autoComplete='current-password'
				/>

				<div className='mt-6'>
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

			<div className='mt-6'>
				<p className='text-center text-sm text-gray-600'>
					Don't have an account?{' '}
					<Link
						to='/register'
						className='font-medium text-blue-600 hover:text-blue-500'
					>
						Register here
					</Link>
				</p>
			</div>

			<div className='mt-8 border-t border-gray-200 pt-6'>
				<p className='text-center text-sm font-medium text-gray-500 mb-4'>
					Demo Accounts (Click to autofill)
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
