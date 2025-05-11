/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useTeamStore } from '../../stores/teamStore';
import { Input } from '@/components/ui/input';
import Button from '../ui/Button';
import { Card } from '../ui/Card';
import { Label } from '../ui/label';
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
} from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';

const AgentProfileForm: React.FC = () => {
	const user = useAuthStore((state) => state.user);
	const updateProfile = useAuthStore((state) => state.updateProfile);
	const loading = useAuthStore((state) => state.loading);
	const { createTeam, teams, isLoading: teamsLoading } = useTeamStore();

	const [showTeamSetup, setShowTeamSetup] = useState(false);
	const [form, setForm] = useState({
		first_name: user?.first_name || '',
		last_name: user?.last_name || '',
		phone: user?.phone || '',
		company_name: user?.company_name || '',
	});
	const [teamForm, setTeamForm] = useState({
		name: '',
		planType: 'starter',
	});
	const [success, setSuccess] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [teamError, setTeamError] = useState<string | null>(null);

	// Check if this is first time setup
	useEffect(() => {
		const isFirstSetup = !user?.company_name && !teams?.length;
		setShowTeamSetup(isFirstSetup);
	}, [user, teams]);

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

	const handleTeamSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setTeamError(null);
		if (!teamForm.name) {
			setTeamError('Team name is required');
			return;
		}
		try {
			await createTeam(teamForm.name, teamForm.planType);

			// Store plan selection for subscription page
			localStorage.setItem('selectedPlanType', teamForm.planType);
			localStorage.setItem('isTeamPlan', 'true');

			// Hide team setup after successful creation
			setShowTeamSetup(false);

			// Redirect to subscription page
			window.location.href = '/agent/subscription?onboarding=true';
		} catch (err: any) {
			setTeamError(err.message || 'Failed to create team');
		}
	};

	return (
		<div className='space-y-6'>
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

			{showTeamSetup && (
				<Card className='max-w-xl mx-auto p-6'>
					<div className='flex items-start mb-4 p-4 bg-blue-50 rounded-lg'>
						<AlertCircle className='w-5 h-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0' />
						<div className='text-sm text-blue-700'>
							<p className='font-medium mb-1'>Set up your team</p>
							<p>
								Create a team to collaborate with other agents and manage
								properties together.
							</p>
						</div>
					</div>
					<form onSubmit={handleTeamSubmit} className='space-y-4'>
						<div>
							<Label htmlFor='teamName'>Team Name</Label>
							<Input
								id='teamName'
								value={teamForm.name}
								onChange={(e) =>
									setTeamForm((prev) => ({ ...prev, name: e.target.value }))
								}
								placeholder='Enter team name'
								required
							/>
						</div>
						<div>
							<Label htmlFor='planType'>Plan Type</Label>
							<Select
								value={teamForm.planType}
								onValueChange={(value) =>
									setTeamForm((prev) => ({ ...prev, planType: value }))
								}
							>
								<SelectTrigger>
									<SelectValue placeholder='Select a plan' />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='starter'>Starter (3 members)</SelectItem>
									<SelectItem value='growth'>Growth (10 members)</SelectItem>
									<SelectItem value='scale'>Scale (25 members)</SelectItem>
									<SelectItem value='enterprise'>
										Enterprise (Custom)
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
						{teamError && (
							<div className='text-red-600 text-sm'>{teamError}</div>
						)}
						<Button type='submit' disabled={teamsLoading} className='w-full'>
							{teamsLoading ? 'Creating Team...' : 'Create Team'}
						</Button>
					</form>
				</Card>
			)}
		</div>
	);
};

export default AgentProfileForm;
