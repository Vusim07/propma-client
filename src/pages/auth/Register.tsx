import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Input } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Select from '../../components/ui/Select';
import { showToast } from '../../utils/toast';

const Register: React.FC = () => {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [role, setRole] = useState('tenant');
	const [formError, setFormError] = useState('');

	const { register, isLoading, error } = useAuthStore();
	const navigate = useNavigate();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setFormError('');

		if (!email || !password || !confirmPassword) {
			setFormError('Please fill in all fields');
			return;
		}

		if (password !== confirmPassword) {
			setFormError('Passwords do not match');
			return;
		}

		if (password.length < 6) {
			setFormError('Password must be at least 6 characters');
			return;
		}

		try {
			await register(email, password, role as 'tenant' | 'agent' | 'landlord');

			showToast.success('Account created successfully!');

			// Redirect based on user role
			if (role === 'tenant') {
				navigate('/tenant');
			} else if (role === 'agent' || role === 'landlord') {
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
					autoComplete='new-password'
				/>

				<Input
					type='password'
					value={confirmPassword}
					onChange={(e) => setConfirmPassword(e.target.value)}
					required
					autoComplete='new-password'
				/>

				<Select
					label='Role'
					options={roleOptions}
					value={role}
					onChange={setRole}
					fullWidth
					required
				/>

				<div className='mt-6'>
					<Button
						type='submit'
						isLoading={isLoading}
						fullWidth
						className='w-full'
					>
						Register
					</Button>
				</div>
			</form>

			<div className='mt-6'>
				<p className='text-center text-sm text-gray-600'>
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
