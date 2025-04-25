/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { Input } from '@/components/ui/Input';
import Button from '../ui/Button';
import { Card } from '../ui/Card';
import { Label } from '../ui/label';

const AgentProfileForm: React.FC = () => {
	const user = useAuthStore((state) => state.user);
	const updateProfile = useAuthStore((state) => state.updateProfile);
	const loading = useAuthStore((state) => state.loading);

	const [form, setForm] = useState({
		first_name: user?.first_name || '',
		last_name: user?.last_name || '',
		phone: user?.phone || '',
		company_name: user?.company_name || '',
	});
	const [success, setSuccess] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setForm({ ...form, [e.target.name]: e.target.value });
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setSuccess(false);
		try {
			await updateProfile(form);
			setSuccess(true);
		} catch (err: any) {
			setError(err.message || 'Failed to update profile');
		}
	};

	return (
		<Card className='max-w-xl mx-auto p-6 mt-4'>
			<form onSubmit={handleSubmit} className='space-y-6'>
				<div>
					<Label htmlFor='email'>Email</Label>
					<Input
						id='email'
						name='email'
						value={user?.email || ''}
						disabled
						className='bg-gray-100'
					/>
				</div>
				<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
					<div>
						<Label htmlFor='first_name'>First Name</Label>
						<Input
							id='first_name'
							name='first_name'
							value={form.first_name}
							onChange={handleChange}
							required
						/>
					</div>
					<div>
						<Label htmlFor='last_name'>Last Name</Label>
						<Input
							id='last_name'
							name='last_name'
							value={form.last_name}
							onChange={handleChange}
							required
						/>
					</div>
				</div>
				<div>
					<Label htmlFor='phone'>Phone</Label>
					<Input
						id='phone'
						name='phone'
						value={form.phone || ''}
						onChange={handleChange}
						placeholder='e.g. 082 123 4567'
					/>
				</div>
				<div>
					<Label htmlFor='company_name'>Company Name</Label>
					<Input
						id='company_name'
						name='company_name'
						value={form.company_name || ''}
						onChange={handleChange}
					/>
				</div>
				{success && (
					<div className='text-green-600 text-sm'>
						Profile updated successfully.
					</div>
				)}
				{error && <div className='text-red-600 text-sm'>{error}</div>}
				<Button type='submit' disabled={loading} className='w-full'>
					{loading ? 'Saving...' : 'Save Changes'}
				</Button>
			</form>
		</Card>
	);
};

export default AgentProfileForm;
