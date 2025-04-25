/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import Calendar from 'react-calendar';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetFooter,
} from '../../components/ui/sheet';
import { format, parseISO, isBefore, isPast, parse } from 'date-fns';
import {
	CalendarIcon,
	User,
	Check,
	X,
	MessageSquare,
	Phone,
	Home,
	DollarSign,
	MapPin,
} from 'lucide-react';
import 'react-calendar/dist/Calendar.css';
import { supabase } from '../../services/supabase';
import { usePageTitle } from '../../context/PageTitleContext';
import { formatCurrency } from '../../utils/formatters';

type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

interface TenantProfileInfo {
	id: string;
	first_name: string;
	last_name: string;
	phone: string | null;
}

interface PropertyInfo {
	id: string;
	address: string;
	property_type: string;
	monthly_rent: number;
}

interface Appointment {
	id: string;
	tenant_id: string;
	property_id: string;
	agent_id: string;
	date: string;
	start_time: string;
	end_time: string | null;
	status: 'scheduled' | 'cancelled' | 'completed';
	notes: string | null;
	created_at: string;
	tenant_profiles: TenantProfileInfo | null;
	properties: PropertyInfo | null;
	tenant_name?: string;
	tenant_phone?: string | null;
	property_address?: string;
	property_type?: string;
	monthly_rent?: number;
}

const ManageAppointments: React.FC = () => {
	const { setPageTitle } = usePageTitle();

	const { user } = useAuthStore();
	const [appointments, setAppointments] = useState<Appointment[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [connectingCalendar, setConnectingCalendar] = useState(false);
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');
	const [date, setDate] = useState<Value>(new Date());
	const [selectedAppointment, setSelectedAppointment] =
		useState<Appointment | null>(null);
	const [isSheetOpen, setIsSheetOpen] = useState(false);
	const [calendarIntegration, setCalendarIntegration] = useState<any>(null);
	const [loadingIntegration, setLoadingIntegration] = useState<boolean>(false);

	useEffect(() => {
		setPageTitle('Manage Appointments');
		const fetchData = async () => {
			setIsLoading(true);
			setError('');

			try {
				if (!user?.id) {
					throw new Error('User not authenticated');
				}

				const { data: appointmentsData, error: appointmentsError } =
					await supabase
						.from('appointments')
						.select(
							`
						*,
						tenant_profiles:tenant_id(id, first_name, last_name, phone),
						properties:property_id(id, address, property_type, monthly_rent)
					`,
						)
						.eq('agent_id', user.id);

				if (appointmentsError) throw appointmentsError;

				const formattedAppointments = (appointmentsData || []).map(
					(appointment) => ({
						...appointment,
						tenant_name: appointment.tenant_profiles
							? `${appointment.tenant_profiles.first_name} ${appointment.tenant_profiles.last_name}`
							: 'Unknown Tenant',
						tenant_phone: appointment.tenant_profiles?.phone,
						property_address:
							appointment.properties?.address || 'Unknown Property',
						property_type:
							appointment.properties?.property_type || 'Unknown Type',
						monthly_rent: appointment.properties?.monthly_rent,
						start_time: appointment.start_time,
						end_time: appointment.end_time,
					}),
				);

				setAppointments(formattedAppointments as any);

				// Fetch calendar integration status
				setLoadingIntegration(true);
				const { data: integration, error: integrationError } = await supabase
					.from('calendar_integrations')
					.select('*')
					.eq('user_id', user.id)
					.maybeSingle();

				if (integrationError) throw integrationError;
				setCalendarIntegration(integration);
			} catch (error: any) {
				console.error('Error fetching data:', error);
				setError(
					`Failed to load appointments: ${
						error.message || 'Please try again.'
					}`,
				);
			} finally {
				setIsLoading(false);
				setLoadingIntegration(false);
			}
		};

		if (user) {
			fetchData();
		}
	}, [user, setPageTitle]);

	const handleDateChange = (value: Value) => {
		setDate(value);
		setSelectedAppointment(null);
		setIsSheetOpen(false);
	};

	const getAppointmentsForDate = (selectedDate: Date) => {
		const dateString = format(selectedDate, 'yyyy-MM-dd');
		return appointments.filter(
			(appointment) => appointment.date === dateString,
		);
	};

	const handleStatusChange = async (
		appointmentId: string,
		newStatus: 'scheduled' | 'cancelled' | 'completed',
	) => {
		setIsLoading(true);

		try {
			const { error } = await supabase
				.from('appointments')
				.update({ status: newStatus })
				.eq('id', appointmentId);

			if (error) throw error;

			setAppointments((prevAppointments) =>
				prevAppointments.map((appointment) =>
					appointment.id === appointmentId
						? { ...appointment, status: newStatus }
						: appointment,
				),
			);

			setSuccess(`Appointment ${newStatus} successfully`);

			setTimeout(() => setSuccess(''), 3000);

			setIsSheetOpen(false);
			setSelectedAppointment(null);

			setIsLoading(false);
		} catch (error) {
			console.error('Error updating appointment:', error);
			setError('Failed to update appointment status. Please try again.');
			setIsLoading(false);
		}
	};

	const tileDisabled = ({ date }: { date: Date }) => {
		return (
			isBefore(date, new Date()) &&
			!format(date, 'yyyy-MM-dd').includes(format(new Date(), 'yyyy-MM-dd'))
		);
	};

	const tileContent = ({ date, view }: { date: Date; view: string }) => {
		if (view !== 'month') return null;

		const dateString = format(date, 'yyyy-MM-dd');
		const appointmentsOnDate = appointments.filter(
			(appointment) => appointment.date === dateString,
		);

		if (appointmentsOnDate.length === 0) return null;

		return (
			<div className='flex justify-center mt-1'>
				<div className='h-1.5 w-1.5 bg-blue-500 rounded-full'></div>
			</div>
		);
	};

	const handleViewDetailsClick = (appointment: Appointment) => {
		setSelectedAppointment(appointment);
		setIsSheetOpen(true);
	};

	// Helper function to check if an appointment time has passed
	const isAppointmentPast = (appointment: Appointment): boolean => {
		const appointmentDateStr = appointment.date;
		// Use end_time if available, otherwise use start_time
		const appointmentTimeStr = appointment.end_time || appointment.start_time;

		try {
			// Combine date and time strings and parse
			const appointmentDateTime = parse(
				`${appointmentDateStr} ${appointmentTimeStr}`,
				'yyyy-MM-dd HH:mm:ss', // Adjust format if your time is HH:mm
				new Date(),
			);

			// Check if the parsed date is valid and if it's in the past
			return (
				!isNaN(appointmentDateTime.getTime()) && isPast(appointmentDateTime)
			);
		} catch (e) {
			console.error('Error parsing appointment date/time:', e);
			return false; // Treat parse errors as not past
		}
	};

	const selectedDateAppointments = date
		? getAppointmentsForDate(date as Date)
		: [];

	const connectGoogleCalendar = async () => {
		if (!user) return;

		try {
			setConnectingCalendar(true);
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
		} catch (err: any) {
			setError(`Failed to connect calendar: ${err.message}`);
			setConnectingCalendar(false);
		}
	};

	return (
		<Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
			<div>
				<div className='mb-6'>
					<h1 className='text-2xl font-bold text-gray-900'>Appointments</h1>
					<p className='text-gray-600 mt-1'>
						Manage your property viewing appointments
					</p>
				</div>

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

				{!calendarIntegration && !loadingIntegration && (
					<Card className='mb-6'>
						<CardContent className='p-6'>
							<div className='flex items-center justify-between'>
								<div className='flex items-center'>
									<div className='bg-blue-100 p-2 rounded-full mr-4'>
										<CalendarIcon className='h-6 w-6 text-blue-600' />
									</div>
									<div>
										<h3 className='text-lg font-medium'>
											Connect Your Calendar
										</h3>
										<p className='text-sm text-gray-600 mt-1'>
											Sync appointments with your calendar and let tenants see
											your availability
										</p>
									</div>
								</div>
								<Button
									onClick={connectGoogleCalendar}
									isLoading={connectingCalendar}
								>
									<img
										src='/assets/icons8-google.svg'
										alt='Google'
										className='h-5 w-5 mr-2'
									/>
									Connect Google Calendar
								</Button>
							</div>
						</CardContent>
					</Card>
				)}

				<div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
					<Card className='lg:col-span-1'>
						<CardHeader>
							<h2 className='text-lg font-semibold'>Select a Date</h2>
						</CardHeader>
						<CardContent>
							<div className='calendar-container'>
								<Calendar
									onChange={handleDateChange}
									value={date}
									tileContent={tileContent}
									tileDisabled={tileDisabled}
									className='w-full border-none'
								/>
							</div>
						</CardContent>
					</Card>

					<Card className='lg:col-span-2'>
						<CardHeader>
							<h2 className='text-lg font-semibold'>
								Appointments for {format(date as Date, 'PPP')}
							</h2>
						</CardHeader>
						<CardContent>
							{isLoading ? (
								<div className='flex justify-center items-center py-20'>
									<Spinner />
									<span className='ml-2 text-gray-500'>
										Loading appointments...
									</span>
								</div>
							) : selectedDateAppointments.length > 0 ? (
								<div className='space-y-4 max-h-[280px] overflow-y-auto pr-2'>
									{selectedDateAppointments.map((appointment) => (
										<div
											key={appointment.id}
											className='bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow'
										>
											<div className='flex justify-between items-start'>
												<div>
													<h3 className='font-medium text-lg'>
														{appointment.tenant_name}
													</h3>
													<p className='text-gray-600'>
														{appointment.property_address}
													</p>
													<div className='flex space-x-2 mt-2'>
														<span className='flex items-center text-sm text-gray-500'>
															<CalendarIcon size={14} className='mr-1' />
															{format(new Date(appointment.date), 'PPP')}
														</span>
														<span className='flex items-center text-sm text-gray-500'>
															<CalendarIcon size={14} className='mr-1' />
															{appointment.start_time}
															{appointment.end_time &&
																` - ${appointment.end_time}`}
														</span>
													</div>
													<div className='mt-2'>
														<Badge
															variant={
																appointment.status === 'scheduled'
																	? 'info'
																	: appointment.status === 'completed'
																	? 'success'
																	: 'danger'
															}
														>
															{appointment.status === 'scheduled'
																? 'Scheduled'
																: appointment.status === 'completed'
																? 'Completed'
																: 'Cancelled'}
														</Badge>
													</div>
												</div>
												<div className='flex space-x-2'>
													<Button
														variant='outline'
														size='sm'
														onClick={() => handleViewDetailsClick(appointment)}
													>
														View Details
													</Button>
													{!isAppointmentPast(appointment) && (
														<>
															{appointment.status === 'scheduled' && (
																<>
																	<Button
																		variant='outline'
																		size='sm'
																		className='border-red-300 text-red-600 hover:bg-red-50'
																		onClick={() =>
																			handleStatusChange(
																				appointment.id,
																				'cancelled',
																			)
																		}
																	>
																		Cancel
																	</Button>
																	<Button
																		variant='outline'
																		size='sm'
																		className='border-green-300 text-green-600 hover:bg-green-50'
																		onClick={() =>
																			handleStatusChange(
																				appointment.id,
																				'completed',
																			)
																		}
																	>
																		Complete
																	</Button>
																</>
															)}
														</>
													)}
												</div>
											</div>
										</div>
									))}
								</div>
							) : (
								<div className='text-center py-10'>
									<p className='text-gray-500'>No appointments for this date</p>
								</div>
							)}
						</CardContent>
					</Card>
				</div>

				<Card className='mt-6'>
					<CardHeader>
						<h2 className='text-lg font-semibold'>All Upcoming Appointments</h2>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<div className='flex justify-center py-8'>
								<Spinner />
							</div>
						) : appointments.filter(
								(a) => a.status === 'scheduled' && !isAppointmentPast(a),
						  ).length > 0 ? (
							<div className='overflow-x-auto'>
								<table className='min-w-full divide-y divide-gray-200'>
									<thead className='bg-gray-50'>
										<tr>
											<th
												scope='col'
												className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
											>
												Date & Time
											</th>
											<th
												scope='col'
												className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
											>
												Tenant
											</th>
											<th
												scope='col'
												className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
											>
												Property
											</th>
											<th
												scope='col'
												className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
											>
												Status
											</th>
											<th
												scope='col'
												className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
											>
												Actions
											</th>
										</tr>
									</thead>
									<tbody className='bg-white divide-y divide-gray-200'>
										{appointments
											.filter(
												(a) =>
													a.status === 'scheduled' && !isAppointmentPast(a),
											)
											.sort(
												(a, b) =>
													new Date(a.date).getTime() -
														new Date(b.date).getTime() ||
													a.start_time.localeCompare(b.start_time),
											)
											.map((appointment) => (
												<tr key={appointment.id}>
													<td className='px-6 py-4 whitespace-nowrap'>
														<div className='text-sm font-medium text-gray-900'>
															{format(parseISO(appointment.date), 'dd/MM/yyyy')}
														</div>
														<div className='text-sm text-gray-500'>
															{appointment.start_time}
															{appointment.end_time
																? ` - ${appointment.end_time}`
																: ''}
														</div>
													</td>
													<td className='px-6 py-4 whitespace-nowrap'>
														<div className='text-sm text-gray-900'>
															{appointment.tenant_name}
														</div>
													</td>
													<td className='px-6 py-4 whitespace-nowrap'>
														<div className='text-sm text-gray-900'>
															{appointment.property_address?.split(',')[0]}
														</div>
													</td>
													<td className='px-6 py-4 whitespace-nowrap'>
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
													</td>
													<td className='px-6 py-4 whitespace-nowrap text-sm font-medium'>
														<Button
															variant='outline'
															size='sm'
															onClick={() =>
																handleViewDetailsClick(appointment)
															}
														>
															View Details
														</Button>
													</td>
												</tr>
											))}
									</tbody>
								</table>
							</div>
						) : (
							<div className='text-center py-8 text-gray-500'>
								No upcoming appointments scheduled
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			<SheetContent className='w-[400px] sm:w-[540px] overflow-y-auto bg-white'>
				{selectedAppointment && (
					<>
						<SheetHeader className='mb-6'>
							<SheetTitle>Appointment Details</SheetTitle>
							<SheetDescription>
								Review and manage the appointment details below.
							</SheetDescription>
						</SheetHeader>

						<div className='space-y-6'>
							<div>
								<h3 className='text-md font-medium mb-3 flex items-center'>
									<CalendarIcon className='h-5 w-5 text-blue-500 mr-2' />
									Date & Time
								</h3>
								<div className='bg-gray-50 p-4 rounded-lg space-y-2'>
									<div>
										<p className='text-sm text-gray-500'>Date</p>
										<p className='font-medium'>
											{format(parseISO(selectedAppointment.date), 'dd/MM/yyyy')}
										</p>
									</div>
									<div>
										<p className='text-sm text-gray-500'>Time</p>
										<p className='font-medium'>
											{selectedAppointment.start_time}
											{selectedAppointment.end_time
												? ` - ${selectedAppointment.end_time}`
												: ''}
										</p>
									</div>
								</div>
							</div>

							<div>
								<h3 className='text-md font-medium mb-3 flex items-center'>
									<User className='h-5 w-5 text-blue-500 mr-2' />
									Tenant Information
								</h3>
								<div className='bg-gray-50 p-4 rounded-lg space-y-2'>
									<div>
										<p className='text-sm text-gray-500'>Name</p>
										<p className='font-medium'>
											{selectedAppointment.tenant_name || 'N/A'}
										</p>
									</div>
									<div>
										<p className='text-sm text-gray-500 flex items-center'>
											<Phone size={14} className='mr-1' /> Contact
										</p>
										<p className='font-medium'>
											{selectedAppointment.tenant_phone || 'Not Provided'}
										</p>
									</div>
								</div>
							</div>

							<div>
								<h3 className='text-md font-medium mb-3 flex items-center'>
									<MapPin className='h-5 w-5 text-blue-500 mr-2' />
									Property Information
								</h3>
								<div className='bg-gray-50 p-4 rounded-lg space-y-4'>
									<div>
										<p className='text-sm text-gray-500'>Address</p>
										<p className='font-medium'>
											{selectedAppointment.property_address || 'N/A'}
										</p>
									</div>
									<div className='grid grid-cols-2 gap-4'>
										<div>
											<p className='text-sm text-gray-500 flex items-center'>
												<Home size={14} className='mr-1' /> Type
											</p>
											<p className='font-medium'>
												{selectedAppointment.property_type || 'N/A'}
											</p>
										</div>
										<div>
											<p className='text-sm text-gray-500 flex items-center'>
												<DollarSign size={14} className='mr-1' /> Monthly Rent
											</p>
											<p className='font-medium'>
												{selectedAppointment.monthly_rent
													? formatCurrency(selectedAppointment.monthly_rent)
													: 'N/A'}
											</p>
										</div>
									</div>
								</div>
							</div>

							{selectedAppointment.notes && (
								<div>
									<h3 className='text-md font-medium mb-3 flex items-center'>
										<MessageSquare className='h-5 w-5 text-blue-500 mr-2' />
										Notes
									</h3>
									<div className='bg-gray-50 p-4 rounded-lg'>
										<p className='text-gray-700'>{selectedAppointment.notes}</p>
									</div>
								</div>
							)}
						</div>

						<SheetFooter className='mt-8 pt-6 border-t border-gray-200'>
							<div className='flex w-full space-x-4'>
								{selectedAppointment.status === 'scheduled' && (
									<>
										<Button
											variant='primary'
											onClick={() =>
												handleStatusChange(selectedAppointment.id, 'completed')
											}
											className='flex-1'
											isLoading={isLoading}
										>
											<Check className='h-4 w-4 mr-2' />
											Mark as Completed
										</Button>
										<Button
											variant='danger'
											onClick={() =>
												handleStatusChange(selectedAppointment.id, 'cancelled')
											}
											className='flex-1'
											isLoading={isLoading}
										>
											<X className='h-4 w-4 mr-2' />
											Cancel Appointment
										</Button>
									</>
								)}
								{selectedAppointment.status === 'cancelled' && (
									<Button
										variant='primary'
										onClick={() =>
											handleStatusChange(selectedAppointment.id, 'scheduled')
										}
										className='flex-1'
										isLoading={isLoading}
									>
										<Check className='h-4 w-4 mr-2' />
										Reschedule Appointment
									</Button>
								)}
							</div>
						</SheetFooter>
					</>
				)}
			</SheetContent>
		</Sheet>
	);
};

export default ManageAppointments;
