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
import { format, parseISO, isBefore, addDays } from 'date-fns';
import {
	Calendar as CalendarIcon,
	Clock,
	MapPin,
	User,
	Check,
	X,
	MessageSquare,
	Phone,
	Home,
	DollarSign,
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
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');
	const [date, setDate] = useState<Value>(new Date());
	const [selectedAppointment, setSelectedAppointment] =
		useState<Appointment | null>(null);
	const [isSheetOpen, setIsSheetOpen] = useState(false);

	useEffect(() => {
		setPageTitle('Viewing Appointments');
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

				setAppointments(formattedAppointments);
				setIsLoading(false);
			} catch (error: any) {
				console.error('Error fetching data:', error);
				setError(
					`Failed to load appointments: ${
						error.message || 'Please try again.'
					}`,
				);
				setIsLoading(false);
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

	const selectedDateAppointments = date
		? getAppointmentsForDate(date as Date)
		: [];

	return (
		<Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
			<div>
				<div className='mb-6'>
					<p className='text-gray-600 mt-1'>
						Schedule and manage property viewing appointments
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

				<div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
					<Card className='lg:col-span-2'>
						<CardHeader>
							<h2 className='text-lg font-semibold'>Appointment Calendar</h2>
						</CardHeader>
						<CardContent>
							{isLoading ? (
								<div className='flex justify-center py-8'>
									<Spinner />
								</div>
							) : (
								<div className='calendar-container'>
									<Calendar
										onChange={handleDateChange}
										value={date}
										tileDisabled={tileDisabled}
										tileContent={tileContent}
										minDate={new Date()}
										maxDate={addDays(new Date(), 30)}
										className='w-full border-none'
									/>
								</div>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<h2 className='text-lg font-semibold'>
								{date ? format(date as Date, 'dd/MM/yyyy') : 'Select a Date'}
							</h2>
						</CardHeader>
						<CardContent>
							{isLoading ? (
								<div className='flex justify-center py-8'>
									<Spinner />
								</div>
							) : selectedDateAppointments.length > 0 ? (
								<div className='space-y-4'>
									{selectedDateAppointments
										.sort((a, b) => a.start_time.localeCompare(b.start_time))
										.map((appointment) => (
											<div
												key={appointment.id}
												className={`p-3 border rounded-lg cursor-pointer transition-colors ${
													selectedAppointment?.id === appointment.id
														? 'border-blue-500 bg-blue-50'
														: 'border-gray-200 hover:bg-gray-50'
												}`}
											>
												<div className='flex items-center justify-between mb-2'>
													<div className='flex items-center'>
														<Clock size={16} className='text-blue-500 mr-2' />
														<span className='font-medium'>
															{appointment.start_time}
															{appointment.end_time
																? ` - ${appointment.end_time}`
																: ''}
														</span>
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
												<div className='flex items-center text-sm text-gray-600 mb-1'>
													<User size={14} className='mr-1' />
													{appointment.tenant_name}
												</div>
												<div className='flex items-center text-sm text-gray-600'>
													<MapPin size={14} className='mr-1' />
													{appointment.property_address?.split(',')[0]}
												</div>
												<div className='mt-2'>
													<Button
														variant='outline'
														size='sm'
														onClick={() => handleViewDetailsClick(appointment)}
													>
														View Details
													</Button>
												</div>
											</div>
										))}
								</div>
							) : (
								<div className='text-center py-8 text-gray-500'>
									No appointments scheduled for this date
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
						) : appointments.filter((a) => a.status === 'scheduled').length >
						  0 ? (
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
											.filter((a) => a.status === 'scheduled')
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
