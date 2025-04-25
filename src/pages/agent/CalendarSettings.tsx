import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { usePageTitle } from '../../context/PageTitleContext';
import { supabase } from '../../services/supabase';
import Button from '../../components/ui/Button';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import Alert from '../../components/ui/Alert';
import { Calendar, Plus, Check, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

interface CalendarIntegration {
	id: string;
	provider: string;
	refresh_token: string;
	access_token: string | null;
	token_expiry: string | null;
	calendar_id: string | null;
	created_at: string;
	updated_at: string;
}

interface ApiError {
	message: string;
	status?: number;
	[key: string]: unknown;
}

interface CalendarSettingsProps {
	hideTitle?: boolean;
}

const CalendarSettings: React.FC<CalendarSettingsProps> = ({
	hideTitle = false,
}) => {
	const { user } = useAuthStore();
	const { setPageTitle } = usePageTitle();
	const [searchParams] = useSearchParams();
	const [integration, setIntegration] = useState<CalendarIntegration | null>(
		null,
	);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [availableCalendars, setAvailableCalendars] = useState<
		Array<{ id: string; summary: string }>
	>([]);
	const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(
		null,
	);
	const [loadingCalendars, setLoadingCalendars] = useState(false);

	useEffect(() => {
		if (!hideTitle) {
			setPageTitle('Calendar Settings');
		}
		fetchCalendarIntegration();

		// Check URL parameters for status messages
		if (searchParams.get('connected') === 'true') {
			setSuccess('Calendar connected successfully!');
		} else if (searchParams.get('error') === 'true') {
			setError('Failed to connect to calendar. Please try again.');
		}
	}, [searchParams, hideTitle, setPageTitle]);

	useEffect(() => {
		if (integration?.provider === 'google') {
			fetchAvailableCalendars();
		}
	}, [integration]);

	const fetchCalendarIntegration = async () => {
		if (!user) return;

		setLoading(true);
		try {
			const { data, error } = await supabase
				.from('calendar_integrations')
				.select('*')
				.eq('user_id', user.id)
				.maybeSingle();

			if (error) throw error;
			setIntegration(data);
			if (data?.calendar_id) {
				setSelectedCalendarId(data.calendar_id);
			}
		} catch (err: unknown) {
			const apiError = err as ApiError;
			setError(`Error loading calendar integration: ${apiError.message}`);
		} finally {
			setLoading(false);
		}
	};

	const fetchAvailableCalendars = async () => {
		if (!user || !integration) return;

		setLoadingCalendars(true);
		try {
			const { data: sessionData } = await supabase.auth.getSession();

			const response = await fetch(
				`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/calendar-list`,
				{
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${sessionData.session?.access_token}`,
					},
				},
			);

			const data = await response.json();
			if (data.calendars) {
				setAvailableCalendars(data.calendars);
			}
		} catch (err: unknown) {
			const apiError = err as ApiError;
			setError(`Failed to fetch available calendars: ${apiError.message}`);
		} finally {
			setLoadingCalendars(false);
		}
	};

	const connectGoogleCalendar = async () => {
		if (!user) return;

		try {
			const { data: sessionData } = await supabase.auth.getSession();

			const response = await fetch(
				`${
					import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
				}/calendar-oauth?user_id=${user.id}`,
				{
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${sessionData.session?.access_token}`,
					},
				},
			);

			const data = await response.json();
			if (data.url) {
				window.location.href = data.url;
			} else {
				throw new Error('Failed to get authorization URL');
			}
		} catch (err: unknown) {
			const apiError = err as ApiError;
			setError(`Failed to connect calendar: ${apiError.message}`);
		}
	};

	const disconnectCalendar = async () => {
		if (!user || !integration) return;

		try {
			const { error } = await supabase
				.from('calendar_integrations')
				.delete()
				.eq('id', integration.id);

			if (error) throw error;
			setIntegration(null);
			setAvailableCalendars([]);
			setSelectedCalendarId(null);
			setSuccess('Calendar disconnected successfully');
		} catch (err: unknown) {
			const apiError = err as ApiError;
			setError(`Failed to disconnect calendar: ${apiError.message}`);
		}
	};

	const updateSelectedCalendar = async () => {
		if (!user || !integration || !selectedCalendarId) return;

		try {
			setLoading(true);
			const { data: sessionData } = await supabase.auth.getSession();

			const response = await fetch(
				`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/calendar-set-default`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${sessionData.session?.access_token}`,
					},
					body: JSON.stringify({
						calendar_id: selectedCalendarId,
					}),
				},
			);

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to update default calendar');
			}

			setSuccess('Default calendar updated successfully');

			// Update the integration object
			setIntegration({
				...integration,
				calendar_id: selectedCalendarId,
			});
		} catch (err: unknown) {
			const apiError = err as ApiError;
			setError(`Failed to update calendar settings: ${apiError.message}`);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div>
			{!hideTitle && (
				<div className='mb-6'>
					<h1 className='text-2xl font-bold text-gray-900'>
						Calendar Settings
					</h1>
					<p className='text-gray-600 mt-1'>
						Connect your calendar to manage property viewing appointments
					</p>
				</div>
			)}

			{error && (
				<Alert variant='error' className='mb-6'>
					{error}
				</Alert>
			)}

			{success && (
				<Alert variant='success' className='mb-6'>
					{success}
				</Alert>
			)}

			<Card>
				<CardHeader>
					<h2 className='text-lg font-semibold'>Calendar Integrations</h2>
				</CardHeader>
				<CardContent>
					{loading ? (
						<div className='flex items-center justify-center p-6'>
							<div className='animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500'></div>
							<span className='ml-2'>Loading...</span>
						</div>
					) : integration ? (
						<div className='bg-white p-4 rounded-md border border-gray-200'>
							<div className='flex items-center justify-between'>
								<div className='flex items-center'>
									<div className='bg-green-100 p-2 rounded-full mr-4'>
										<Calendar className='h-6 w-6 text-green-600' />
									</div>
									<div>
										<h3 className='text-lg font-medium flex items-center'>
											{integration.provider === 'google'
												? 'Google Calendar'
												: 'Calendar'}
											<span className='ml-2 bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full flex items-center'>
												<Check className='h-3 w-3 mr-1' /> Connected
											</span>
										</h3>
										<p className='text-sm text-gray-500'>
											Connected on{' '}
											{new Date(integration.created_at).toLocaleDateString()}
										</p>
									</div>
								</div>
								<Button
									variant='outline'
									onClick={disconnectCalendar}
									className='text-red-600 border-red-300 hover:bg-red-50'
								>
									<X className='h-4 w-4 mr-1' /> Disconnect
								</Button>
							</div>

							{integration.provider === 'google' && (
								<div className='mt-6 border-t pt-4'>
									<h4 className='font-medium mb-2'>Select Default Calendar</h4>
									{loadingCalendars ? (
										<div className='flex items-center'>
											<div className='animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2'></div>
											<span className='text-sm'>Loading calendars...</span>
										</div>
									) : availableCalendars.length > 0 ? (
										<div>
											<select
												value={selectedCalendarId || ''}
												onChange={(e) => setSelectedCalendarId(e.target.value)}
												className='w-full p-2 border border-gray-300 rounded-md mb-3'
											>
												<option value=''>Select a calendar</option>
												{availableCalendars.map((cal) => (
													<option key={cal.id} value={cal.id}>
														{cal.summary}
													</option>
												))}
											</select>
											<Button
												onClick={updateSelectedCalendar}
												size='sm'
												disabled={
													!selectedCalendarId ||
													selectedCalendarId === integration.calendar_id
												}
											>
												Update Default Calendar
											</Button>
										</div>
									) : (
										<p className='text-sm text-gray-500'>No calendars found.</p>
									)}
								</div>
							)}

							<div className='mt-4 bg-blue-50 p-3 rounded-md text-sm text-blue-800'>
								<p>
									Your appointments will automatically be synced with your
									calendar. Tenants will see your availability based on your
									calendar.
								</p>
							</div>
						</div>
					) : (
						<div className='bg-gray-50 border border-gray-200 rounded-md p-6 text-center'>
							<div className='flex justify-center mb-4'>
								<div className='bg-gray-200 p-3 rounded-full'>
									<Calendar className='h-8 w-8 text-gray-500' />
								</div>
							</div>
							<h3 className='text-lg font-medium mb-2'>
								No Calendar Connected
							</h3>
							<p className='text-gray-600 mb-4'>
								Connect your calendar to streamline appointment scheduling. This
								will allow tenants to see your availability and automatically
								create calendar events.
							</p>
							<Button onClick={connectGoogleCalendar}>
								<Plus className='h-4 w-4 mr-2' /> Connect Google Calendar
							</Button>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
};

export default CalendarSettings;
