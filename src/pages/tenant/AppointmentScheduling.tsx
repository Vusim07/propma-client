/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { usePageTitle } from '../../context/PageTitleContext';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Spinner from '../../components/ui/Spinner';
import Calendar from 'react-calendar';
import { format, parse, isPast, isBefore, addDays } from 'date-fns'; // Re-add isBefore and addDays
import {
	Calendar as CalendarIcon,
	Clock,
	MapPin,
	User,
	Check,
	CheckCircle,
} from 'lucide-react';
import Badge from '../../components/ui/Badge';
import 'react-calendar/dist/Calendar.css';
import { supabase } from '../../services/supabase';
import { Tables } from '../../services/database.types';
import { Textarea } from '@/components/ui/Textarea';

type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

type ApprovedApplication = Tables<'applications'> & {
	properties: Tables<'properties'>;
	agent: Tables<'users'> | null;
};

const AppointmentScheduling: React.FC = () => {
	const { user } = useAuthStore();
	const { setPageTitle } = usePageTitle();
	const {
		profile,
		appointments,
		fetchAppointments,
		// scheduleAppointment,
		isLoading,
		fetchProfile,
	} = useTenantStore();

	const [date, setDate] = useState<Value>(new Date());
	const [timeSlot, setTimeSlot] = useState<string>('');
	const [notes, setNotes] = useState<string>('');
	const [error, setError] = useState<string>('');
	const [success, setSuccess] = useState<string>('');
	const [approvedApplication, setApprovedApplication] =
		useState<ApprovedApplication | null>(null);
	const [isFetchingApplication, setIsFetchingApplication] = useState(true);
	const [isLoadingSlots, setIsLoadingSlots] = useState(false);
	const [availableSlots, setAvailableSlots] = useState<string[]>([]);

	// Helper function to check if an appointment time has passed
	const isAppointmentPast = (appointment: Tables<'appointments'>): boolean => {
		const appointmentDateStr = appointment.date;
		const appointmentTimeStr = appointment.end_time || appointment.start_time;

		try {
			// Combine date and time strings and parse
			// Adjust format to match the actual date string (yyyy/MM/dd)
			const dateTimeFormat =
				appointmentTimeStr.split(':').length === 3
					? 'yyyy/MM/dd HH:mm:ss' // Changed from yyyy-MM-dd
					: 'yyyy/MM/dd HH:mm'; // Changed from yyyy-MM-dd
			const appointmentDateTime = parse(
				`${appointmentDateStr} ${appointmentTimeStr}`,
				dateTimeFormat,
				new Date(), // Reference date for parsing
			);

			const isValid = !isNaN(appointmentDateTime.getTime());
			const isPastDate = isValid && isPast(appointmentDateTime);

			return isValid && isPastDate;
		} catch (e) {
			console.error(
				'Error parsing appointment date/time:',
				e,
				`Date: ${appointmentDateStr}`,
				`Time: ${appointmentTimeStr}`,
			);
			return false; // Treat parse errors as not past
		}
	};

	// Add this function to fetch available times from agent's calendar
	const fetchAvailableSlots = async (selectedDate: Date, agentId: string) => {
		setIsLoadingSlots(true);
		setError('');
		try {
			// Get a fresh session token
			const { data: session, error: sessionError } =
				await supabase.auth.getSession();

			if (sessionError) {
				console.error('Session error:', sessionError);
				throw new Error(`Failed to get session: ${sessionError.message}`);
			}

			if (!session?.session?.access_token) {
				// Try to refresh the session
				const { data: refreshData, error: refreshError } =
					await supabase.auth.refreshSession();

				if (refreshError || !refreshData?.session?.access_token) {
					throw new Error(
						'Your authentication session has expired. Please log in again.',
					);
				}

				// Use the refreshed token
				session.session = refreshData.session;
			}

			const accessToken = session.session.access_token;

			const response = await fetch(
				`${
					import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
				}/calendar-available-slots`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${accessToken}`,
						apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
					},
					body: JSON.stringify({
						agentId,
						date: format(selectedDate, 'yyyy-MM-dd'),
						duration: 60, // 1 hour appointments
					}),
				},
			);

			if (!response.ok) {
				const errorText = await response.text();
				console.error('Calendar API error response:', {
					status: response.status,
					statusText: response.statusText,
					body: errorText,
				});
				throw new Error(`API error: ${response.status} ${errorText}`);
			}

			const data = await response.json();
			if (data.error) {
				throw new Error(data.error);
			}

			// Transform the slots format from API (e.g. '9:00') to display format (e.g. '09:00-10:00')
			const formattedSlots = data.slots.map((slot: string) => {
				const [hours, minutes] = slot.split(':').map(Number);
				const startHour = hours.toString().padStart(2, '0');
				const endHour = (hours + 1).toString().padStart(2, '0');
				return `${startHour}:${minutes
					.toString()
					.padStart(2, '0')}-${endHour}:${minutes.toString().padStart(2, '0')}`;
			});

			setAvailableSlots(formattedSlots);
		} catch (err: any) {
			console.error('Error fetching slots:', err);
			setError(`Failed to load available slots: ${err.message}`);
			// Fallback to default slots
			setAvailableSlots([
				'09:00-09:30',
				'10:00-10:30',
				'11:00-11:30',
				'13:00-13:30',
				'14:00-14:30',
				'15:00-15:30',
				'16:00-16:30',
			]);
		} finally {
			setIsLoadingSlots(false);
		}
	};

	useEffect(() => {
		setPageTitle('Appointments');
		if (user && !profile) {
			fetchProfile(user.id);
		}
		// Add check for profile.id after profile is potentially fetched
		if (user && profile) {
			// Ensure the profile object has the necessary ID (PK from tenant_profiles)
			if (!profile.id) {
				setError(
					'Tenant profile is incomplete. Cannot schedule appointments. Please complete your profile or contact support.',
				);
				setIsFetchingApplication(false); // Stop loading if profile is bad
				return; // Exit early
			}

			// Proceed only if profile.id exists
			fetchAppointments(profile.id); // Use profile.id (PK of tenant_profiles)

			const fetchApprovedApplication = async () => {
				if (!profile?.id) {
					setError('Tenant profile not loaded yet.');
					setIsFetchingApplication(false);
					return;
				}

				setIsFetchingApplication(true);
				setError('');
				try {
					const { data: applicationData, error: applicationError } =
						await supabase
							.from('applications')
							.select(
								`
                *,
                properties (*),
                agent:agent_id (*)
              `,
							)
							.eq('tenant_id', profile.id) // Use profile.id here
							.eq('status', 'approved')
							.order('created_at', { ascending: false })
							.limit(1)
							.maybeSingle();

					if (applicationError) {
						console.error(
							'Supabase error fetching approved application:',
							applicationError,
						);
						if (applicationError.code === 'PGRST116') {
							setError(
								'No approved application found. You can only schedule viewings for approved applications.',
							);
						} else {
							throw new Error(
								`Supabase error: ${applicationError.message} (Code: ${applicationError.code})`,
							);
						}
					} else if (applicationData) {
						console.log('Fetched approved application:', applicationData);
						setApprovedApplication(applicationData as ApprovedApplication);

						// After getting the approved application, fetch available slots
						if (date) {
							fetchAvailableSlots(date as Date, applicationData.agent_id);
						}
					} else {
						console.log('No approved application found for this user.');
						setError(
							'No approved application found. You can only schedule viewings for approved applications.',
						);
					}
				} catch (err: any) {
					console.error('Error fetching approved application:', err);
					setError(
						`Failed to load application details: ${
							err.message || 'Unknown error'
						}`,
					);
				} finally {
					setIsFetchingApplication(false);
				}
			};

			fetchApprovedApplication();
		} else if (!user) {
			setIsFetchingApplication(false);
		}
	}, [user, profile, fetchAppointments, fetchProfile, setPageTitle, date]);

	useEffect(() => {
		if (isFetchingApplication) {
			setIsFetchingApplication(false); // Ensure it resets after fetching
		}
	}, [isFetchingApplication]);

	const handleDateChange = (value: Value) => {
		if (!value) return;

		setDate(value);
		setTimeSlot('');

		// Fetch available slots if we have an approved application
		if (value && approvedApplication?.agent_id) {
			fetchAvailableSlots(value as Date, approvedApplication.agent_id);
		}
	};

	// Modified handleSubmit to include the required fields for calendar-create-event
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		setSuccess('');

		// Add explicit check for profile.id
		if (!profile?.id) {
			setError(
				'Your profile is not fully loaded or incomplete. Cannot schedule appointment.',
			);
			return;
		}

		if (!approvedApplication) {
			setError('Cannot schedule appointment without an approved application.');
			return;
		}

		if (!date || !timeSlot) {
			setError('Please select a date and time slot.');
			return;
		}

		// User check remains valid
		if (!user) {
			setError('You must be logged in to schedule an appointment.');
			return;
		}

		try {
			const selectedDate = date as Date;
			const [startTime, endTime] = timeSlot.split('-');
			const formattedDate = format(selectedDate, 'yyyy-MM-dd');

			// Create the start and end datetime strings in ISO format
			const startDateTime = `${formattedDate}T${startTime}:00`;
			const endDateTime = `${formattedDate}T${endTime}:00`;

			// Property address for title
			const propertyAddress = propertyDetails
				? `${propertyDetails.address}, ${propertyDetails.suburb}`
				: 'Property Viewing';

			// Create a descriptive title
			const appointmentTitle = `Property Viewing: ${propertyAddress}`;

			// Use the calendar-create-event endpoint
			const { data: sessionData } = await supabase.auth.getSession();

			const response = await fetch(
				`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/calendar-create-event`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${sessionData.session?.access_token}`,
					},
					body: JSON.stringify({
						// Required fields for calendar event creation
						title: appointmentTitle,
						description:
							notes ||
							`Property viewing appointment with ${profile.first_name} ${profile.last_name}`,
						start: startDateTime,
						end: endDateTime,
						attendees: [profile.email],

						// Additional fields for your application
						agentId: approvedApplication.agent_id,
						tenantId: profile.id,
						propertyId: approvedApplication.property_id,
					}),
				},
			);

			const data = await response.json();
			if (data.error) {
				throw new Error(data.error);
			}

			// Show success message with Google Meet link if present
			if (data.meetLink) {
				setSuccess(
					`Appointment scheduled successfully! A Google Meet link has been sent to your email.`,
				);
			} else {
				setSuccess('Appointment scheduled successfully!');
			}

			setDate(new Date());
			setTimeSlot('');
			setNotes('');
			if (profile?.id) {
				fetchAppointments(profile.id);
			}
		} catch (err: any) {
			setError(`Failed to schedule appointment: ${err.message}`);
		}
	};

	const tileDisabled = ({ date }: { date: Date }) => {
		return (
			isBefore(date, new Date()) &&
			!format(date, 'yyyy-MM-dd').includes(format(new Date(), 'yyyy-MM-dd'))
		);
	};

	const isTimeSlotBooked = (slot: string) => {
		if (!date) return false;

		const selectedDateStr = format(date as Date, 'yyyy-MM-dd');
		const [startTime] = slot.split('-');

		return appointments.some(
			(appointment) =>
				appointment.date === selectedDateStr &&
				appointment.start_time === startTime,
		);
	};

	if (isFetchingApplication) {
		return (
			<div className='flex justify-center items-center h-64'>
				<Spinner size='lg' />
				<p className='ml-4 text-gray-600'>Loading application details...</p>
			</div>
		);
	}

	if (error && !approvedApplication) {
		return (
			<div className='mb-6'>
				<h1 className='text-2xl font-bold text-gray-900 mb-6'>
					Schedule a Viewing
				</h1>
				<Alert variant='error'>{error}</Alert>
			</div>
		);
	}

	if (!approvedApplication) {
		return (
			<div className='mb-6'>
				<h1 className='text-2xl font-bold text-gray-900 mb-6'>
					Schedule a Viewing
				</h1>
				{/* <Alert variant='info'>
					Please log in and ensure you have an approved application to schedule
					a viewing.
				</Alert> */}
			</div>
		);
	}

	const propertyDetails = approvedApplication.properties;
	const agentDetails = approvedApplication.agent;

	return (
		<div>
			<div className='mb-6'>
				<h1 className='text-2xl font-bold text-gray-900'>Schedule a Viewing</h1>
				<p className='text-gray-600 mt-1'>
					Book an appointment to view a property
				</p>
			</div>

			<Alert variant='success' className='mb-6'>
				<CheckCircle className='h-5 w-5 mr-2' />
				<div>
					<p className='font-medium'>Application Approved</p>
					<p className='text-sm'>
						Congratulations! Your application has been pre-approved. You can now
						schedule a viewing of the property. This is the final step in your
						application process.
					</p>
				</div>
			</Alert>

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

			<div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
				<Card className='lg:col-span-2'>
					<CardHeader>
						<h2 className='text-lg font-semibold'>Select a Date</h2>
					</CardHeader>
					<CardContent>
						<div className='calendar-container'>
							<Calendar
								onChange={handleDateChange}
								value={date}
								tileDisabled={tileDisabled}
								minDate={new Date()}
								maxDate={addDays(new Date(), 30)}
								className='w-full border-none'
								onClickDay={(value) => {
									handleDateChange(value);
								}}
							/>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<h2 className='text-lg font-semibold'>Available Time Slots</h2>
					</CardHeader>
					<CardContent>
						{date ? (
							<div>
								<p className='text-sm text-gray-600 mb-4'>
									Selected date:{' '}
									<span className='font-medium'>
										{format(date as Date, 'MMMM d, yyyy')}
									</span>
								</p>
								{isLoadingSlots ? (
									<div className='flex justify-center items-center py-8'>
										<Spinner size='sm' />
										<span className='ml-2 text-sm text-gray-500'>
											Loading available slots...
										</span>
									</div>
								) : (
									<div className='space-y-2 h-[270px] overflow-y-auto pr-2'>
										{availableSlots.length > 0 ? (
											availableSlots.map((slot) => {
												const isBooked = isTimeSlotBooked(slot);
												return (
													<button
														key={slot}
														onClick={() => !isBooked && setTimeSlot(slot)}
														disabled={isBooked}
														className={`w-full py-2 px-4 rounded-md text-left ${
															isBooked
																? 'bg-gray-100 text-gray-400 cursor-not-allowed'
																: timeSlot === slot
																? 'bg-blue-100 border border-blue-500 text-blue-700'
																: 'bg-white border border-gray-300 hover:bg-gray-50'
														}`}
													>
														<div className='flex items-center justify-between'>
															<span className='flex items-center'>
																<Clock size={16} className='mr-2' />
																{slot}
															</span>
															{isBooked ? (
																<Badge variant='danger'>Booked</Badge>
															) : timeSlot === slot ? (
																<Check size={16} className='text-blue-600' />
															) : null}
														</div>
													</button>
												);
											})
										) : (
											<div className='text-center py-4 text-gray-500'>
												No available slots for this date. Please select another
												date.
											</div>
										)}
									</div>
								)}
							</div>
						) : (
							<div className='text-center py-8 text-gray-500'>
								Please select a date first
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			<Card className='mt-6'>
				<CardHeader>
					<h2 className='text-lg font-semibold'>Appointment Details</h2>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit}>
						<div className='mb-4'>
							<label className='block text-sm font-medium text-gray-700 mb-1'>
								Notes (Optional)
							</label>
							<Textarea
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								placeholder='Any special requests or questions about the property...'
								className='w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500'
								rows={3}
							/>
						</div>

						<div className='bg-gray-50 p-4 rounded-md mb-4'>
							<h3 className='font-medium text-gray-900 mb-3'>
								Appointment Summary
							</h3>
							{/* Use a 2-column grid for summary details */}
							<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
								{/* Date */}
								<div className='flex items-start'>
									<CalendarIcon
										size={18}
										className='text-gray-500 mr-2 mt-0.5 flex-shrink-0'
									/>
									<div>
										<p className='text-sm font-medium'>Date</p>
										<p className='text-sm text-gray-600'>
											{date
												? format(date as Date, 'dd/MM/yyyy') // Use DD/MM/YYYY format
												: 'Not selected'}
										</p>
									</div>
								</div>

								{/* Time */}
								<div className='flex items-start'>
									<Clock
										size={18}
										className='text-gray-500 mr-2 mt-0.5 flex-shrink-0'
									/>
									<div>
										<p className='text-sm font-medium'>Time</p>
										<p className='text-sm text-gray-600'>
											{timeSlot || 'Not selected'}
										</p>
									</div>
								</div>

								{/* Property */}
								<div className='flex items-start'>
									<MapPin
										size={18}
										className='text-gray-500 mr-2 mt-0.5 flex-shrink-0'
									/>
									<div>
										<p className='text-sm font-medium'>Address</p>
										<p className='text-sm text-gray-600'>
											{propertyDetails
												? `${propertyDetails.address}, ${propertyDetails.suburb}, ${propertyDetails.city}`
												: 'Loading property...'}
										</p>
									</div>
								</div>

								{/* Agent */}
								<div className='flex items-start'>
									<User
										size={18}
										className='text-gray-500 mr-2 mt-0.5 flex-shrink-0'
									/>
									<div>
										<p className='text-sm font-medium'>Agent</p>
										<p className='text-sm text-gray-600'>
											{agentDetails
												? `${agentDetails.first_name} ${agentDetails.last_name}`
												: 'Loading agent...'}
											{agentDetails?.company_name &&
												` (${agentDetails.company_name})`}
										</p>
										{/* Add Agent Contact Info */}
										{agentDetails?.email && (
											<p className='text-sm text-gray-500 mt-1'>
												{agentDetails.email}
											</p>
										)}
										{agentDetails?.phone && (
											<p className='text-sm text-gray-500'>
												{agentDetails.phone}
											</p>
										)}
									</div>
								</div>
							</div>
						</div>

						<Button
							type='submit'
							isLoading={isLoading}
							disabled={!date || !timeSlot || !approvedApplication || isLoading}
						>
							Schedule Appointment
						</Button>
					</form>
				</CardContent>
			</Card>

			<Card className='mt-6'>
				<CardHeader>
					<h2 className='text-lg font-semibold'>Your Upcoming Appointments</h2>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className='flex justify-center py-8'>
							<Spinner />
						</div>
					) : appointments.filter((app) => !isAppointmentPast(app)).length >
					  0 ? (
						<div className='divide-y divide-gray-200'>
							{appointments
								.filter((app) => !isAppointmentPast(app)) // Filter out past appointments
								.sort((a, b) => {
									// Corrected sort function
									const dateComparison =
										new Date(a.date).getTime() - new Date(b.date).getTime();
									if (dateComparison !== 0) return dateComparison;
									return a.start_time.localeCompare(b.start_time);
								})
								.map(
									(
										appointment, // Ensure map returns valid JSX
									) => (
										<div
											key={appointment.id}
											className='py-4 first:pt-0 last:pb-0'
										>
											<div className='flex items-start justify-between'>
												<div>
													<div className='flex items-center mb-1'>
														<CalendarIcon
															size={16}
															className='text-blue-500 mr-2'
														/>
														<span className='font-medium'>
															{format(new Date(appointment.date), 'dd/MM/yyyy')}{' '}
															at {appointment.start_time}
														</span>
													</div>
													<p className='text-sm text-gray-600 mb-1'>
														<MapPin size={14} className='inline mr-1' />
														{approvedApplication?.property_id ===
															appointment.property_id && propertyDetails
															? `${propertyDetails.address}, ${propertyDetails.suburb}`
															: `Property ID: ${appointment.property_id}`}
													</p>
													{appointment.notes && (
														<p className='text-sm text-gray-600 mt-2'>
															<span className='font-medium'>Notes:</span>{' '}
															{appointment.notes}
														</p>
													)}
												</div>
												<Badge
													variant={
														appointment.status === 'scheduled'
															? 'info'
															: appointment.status === 'completed'
															? 'success'
															: 'warning'
													}
												>
													{appointment.status.charAt(0).toUpperCase() +
														appointment.status.slice(1)}
												</Badge>
											</div>
										</div>
									),
								)}
						</div>
					) : (
						<div className='text-center py-8'>
							<p className='text-gray-500'>No upcoming appointments</p>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
};

export default AppointmentScheduling;
