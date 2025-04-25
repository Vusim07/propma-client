/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';
import { Inbox } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useAgentStore } from '../../stores/agentStore';
import { supabase } from '@/services/supabase';

interface EmailProvider {
	id: string;
	name: string;
	connected: boolean;
	logo: string;
}

const emailProviders: EmailProvider[] = [
	{
		id: 'gmail',
		name: 'Gmail',
		connected: false,
		logo: '/icons/icons8-gmail.svg',
	},
	{
		id: 'outlook',
		name: 'Outlook',
		connected: false,
		logo: '/icons/icons8-outlook.svg',
	},
];

const providerIcons: Record<string, JSX.Element> = {
	gmail: (
		<img
			src='/assets/icons8-google.svg'
			alt='Gmail'
			className='w-7 h-7 object-contain'
			loading='lazy'
		/>
	),
	outlook: (
		<img
			src='/assets/icons8-outlook.svg'
			alt='Gmail'
			className='w-7 h-7 object-contain'
			loading='lazy'
		/>
	),
};

const InboxIntegration: React.FC = () => {
	const { user } = useAuthStore();
	const {
		emailIntegration,
		fetchEmailIntegration,
		disconnectEmailIntegration,
		isLoading,
	} = useAgentStore();

	const [emailConnectStep, setEmailConnectStep] = useState<number>(0);
	const [selectedProvider, setSelectedProvider] = useState<string>('');
	const [localError, setLocalError] = useState<string | null>(null);

	React.useEffect(() => {
		if (user?.id) fetchEmailIntegration(user.id);
	}, [user?.id, fetchEmailIntegration]);

	React.useEffect(() => {
		if (emailIntegration) {
			setEmailConnectStep(2);
			setSelectedProvider(emailIntegration.provider);
		} else {
			setEmailConnectStep(0);
			setSelectedProvider('');
		}
	}, [emailIntegration]);

	const handleConnect = async (providerId: string) => {
		if (!user) return;
		setSelectedProvider(providerId);
		setEmailConnectStep(1);
		setLocalError(null);
		try {
			// Get a fresh session token
			const { data: sessionData, error: sessionError } =
				await supabase.auth.getSession();
			if (sessionError || !sessionData?.session?.access_token) {
				throw new Error('Authentication session expired. Please log in again.');
			}
			const accessToken = sessionData.session.access_token;
			// Call Supabase Edge Function to get Gmail OAuth URL
			const response = await fetch(
				`${
					import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
				}/email-gmail-oauth?user_id=${user.id}`,
				{
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${accessToken}`,
						apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
					},
				},
			);
			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(errorText || 'Failed to get Gmail authorization URL');
			}
			const data = await response.json();
			if (data.url) {
				window.location.href = data.url;
			} else {
				throw new Error('Failed to get Gmail authorization URL');
			}
		} catch (err: any) {
			setLocalError(err.message || 'Failed to connect email');
			setEmailConnectStep(0);
		}
	};

	const handleDisconnect = async () => {
		if (!emailIntegration) return;
		try {
			await disconnectEmailIntegration(emailIntegration.id);
		} catch (err: any) {
			setLocalError(err.message || 'Failed to disconnect');
		}
	};

	if (emailConnectStep === 0) {
		return (
			<Card className='mb-4 p-3 mx-auto shadow-sm border border-gray-200'>
				<CardHeader className='pb-2'>
					<h2 className='text-base font-semibold flex items-center gap-2'>
						<Inbox className='h-4 w-4 text-blue-500' />
						Connect your Email
					</h2>
				</CardHeader>
				<CardContent className='pt-2'>
					<p className='text-xs text-gray-600 mb-3'>
						Connect your email inbox to enable automated responses to property
						inquiries.
					</p>
					{localError && (
						<div className='text-xs text-red-600 mb-2'>{localError}</div>
					)}
					<div className='flex gap-3'>
						{emailProviders.map((provider) => (
							<button
								key={provider.id}
								onClick={() => handleConnect(provider.id)}
								className='flex flex-col items-center justify-center p-2 border rounded-md bg-white hover:bg-gray-50 transition-colors w-28 h-28 focus:outline-none focus:ring-2 focus:ring-blue-200'
								aria-label={`Connect ${provider.name}`}
								disabled={isLoading}
							>
								<div className='mb-2'>{providerIcons[provider.id]}</div>
								<span className='font-medium text-xs mb-1'>
									{provider.name}
								</span>
								<span className='text-[11px] text-gray-400'>Not connected</span>
							</button>
						))}
					</div>
				</CardContent>
			</Card>
		);
	} else if (emailConnectStep === 1) {
		return (
			<Card className='mb-4 p-3 max-w-md mx-auto shadow-sm border border-gray-200'>
				<CardHeader className='pb-2'>
					<h2 className='text-base font-semibold'>
						Connecting to {selectedProvider === 'gmail' ? 'Gmail' : 'Outlook'}
					</h2>
				</CardHeader>
				<CardContent className='flex flex-col items-center justify-center py-6'>
					<Spinner size='md' className='mb-3' />
					<p className='text-xs text-gray-600'>
						Please authorize access to your{' '}
						{selectedProvider === 'gmail' ? 'Gmail' : 'Outlook'} account
					</p>
					<p className='text-[11px] text-gray-400 mt-1'>
						You will be redirected to the authorization page...
					</p>
				</CardContent>
			</Card>
		);
	} else {
		return (
			<Card className='mb-4 p-3 mx-auto shadow-sm border border-gray-200'>
				<CardHeader className='pb-2'>
					<div className='flex justify-between items-center'>
						<h2 className='text-base font-semibold flex items-center gap-2'>
							<Inbox className='h-4 w-4 text-blue-500' />
							Email Connection
						</h2>
						<Badge variant='success' className='text-xs px-2 py-0.5'>
							Connected
						</Badge>
					</div>
				</CardHeader>
				<CardContent className='flex items-center gap-3 pt-0'>
					<div>{providerIcons[selectedProvider]}</div>
					<div className='py-4'>
						<h3 className='font-medium text-xs'>
							{selectedProvider === 'gmail' ? 'Gmail' : 'Outlook'}
						</h3>
						<p className='text-[11px] text-gray-500 '>
							Connected and monitoring for property inquiries
						</p>
						<button
							onClick={handleDisconnect}
							className='mt-2 text-xs text-red-600 underline hover:text-red-800'
							disabled={isLoading}
						>
							Disconnect
						</button>
					</div>
				</CardContent>
			</Card>
		);
	}
};

export default InboxIntegration;
