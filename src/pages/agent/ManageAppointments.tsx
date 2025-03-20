import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import Calendar from 'react-calendar';
import { format, parse, isAfter, isBefore, addDays } from 'date-fns';
import {
	Calendar as CalendarIcon,
	Clock,
	MapPin,
	User,
	Check,
	X,
	MessageSquare,
} from 'lucide-react';
import 'react-calendar/dist/Calendar.css';

type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

interface Appointment {
	id: string;
	tenant_id: string;
	property_id: string;
	agent_id: string;
	date: string;
	start_time: string;
	end_time: string;
	status: 'scheduled' | 'cancelled' | 'completed';
	notes: string;
	created_at: string;
	tenant_name?: string;
	property_address?: string;
}

interface Property {
	id: string;
	address: string;
}

const ManageAppointments: React.FC = () => {
	const { user } = useAuthStore();
	const [appointments, setAppointments] = useState<Appointment[]>([]);
	const [properties, setProperties] = useState<Property[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');
	const [date, setDate] = useState<Value>(new Date());
	const [timeSlot, setTimeSlot] = useState<string>('');
	const [selectedAppointment, setSelectedAppointment] =
		useState<Appointment | null>(null);

	// Mock data for MVP
	useEffect(() => {
		const fetchData = async () => {
			setIsLoading(true);
			setError('');

			try {
				// In a real app, we would fetch from Supabase
				// const { data: appointmentsData, error: appointmentsError } = await supabase
				//   .from('appointments')
				//   .select('*, tenant_profiles(*), properties(*)')
				//   .eq('agent_id', user.id);
				// if (appointmentsError) throw appointmentsError;

				// For MVP, we'll use mock data
				await new Promise((resolve) => setTimeout(resolve, 800));

				const mockProperties = [
					{ id: '1', address: '456 Oak Ave, Metropolis, NY 10001' },
					{ id: '2', address: '789 Pine St, Metropolis, NY 10002' },
				];

				const mockAppointments = [
					{
						id: '1',
						tenant_id: '1',
						property_id: '1',
						agent_id: '2',
						date: '2023-06-15',
						start_time: '10:00',
						end_time: '10:30',
						status: 'scheduled',
						notes: 'First viewing of the property',
						created_at: new Date().toISOString(),
						tenant_name: 'John Doe',
						property_address: '456 Oak Ave, Metropolis, NY 10001',
					},
					{
						id: '2',
						tenant_id: '4',
						property_id: '2',
						agent_id: '2',
						date: '2023-06-16',
						start_time: '14:00',
						end_time: '14:30',
						status: 'scheduled',
						notes: 'Interested in the backyard and garage',
						created_at: new Date().toISOString(),
						tenant_name: 'Jane Smith',
						property_address: '789 Pine St, Metropolis, NY 10002',
					},
					{
						id: '3',
						tenant_id: '5',
						property_id: '1',
						agent_id: '2',
						date: '2023-06-14',
						start_time: '11:00',
						end_time: '11:30',
						status: 'completed',
						notes: 'Tenant was very interested in the property',
						created_at: new Date().toISOString(),
						tenant_name: 'Robert Johnson',
						property_address: '456 Oak Ave, Metropolis, NY 10001',
					},
				];

				setAppointments(mockAppointments);
				setProperties(mockProperties);
				setIsLoading(false);
			} catch (error) {
				console.error('Error fetching data:', error);
				setError('Failed to load appointments. Please try again.');
				setIsLoading(false);
			}
		};

		if (user) {
			fetchData();
		}
	}, [user]);

	const handleDateChange = (value: Value) => {
		setDate(value);
		setTimeSlot('');
	};

	const getAppointmentsForDate = (date: Date) => {
		const dateString = format(date, 'yyyy-MM-dd');
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
			// In a real app, we would update in Supabase
			// const { error } = await supabase
			//   .from('appointments')
			//   .update({ status: newStatus })
			//   .eq('id', appointmentId);
			// if (error) throw error;

			// For MVP, we'll update the local state
			await new Promise((resolve) => setTimeout(resolve, 500));

			setAppointments((prevAppointments) =>
				prevAppointments.map((appointment) =>
					appointment.id === appointmentId
						? { ...appointment, status: newStatus }
						: appointment,
				),
			);

			setSuccess(`Appointment ${newStatus} successfully`);

			// Clear success message after 3 seconds
			setTimeout(() => setSuccess(''), 3000);

			// If the selected appointment was updated, update it as well
			if (selectedAppointment && selectedAppointment.id === appointmentId) {
				setSelectedAppointment({ ...selectedAppointment, status: newStatus });
			}

			setIsLoading(false);
		} catch (error) {
			console.error('Error updating appointment:', error);
			setError('Failed to update appointment status. Please try again.');
			setIsLoading(false);
		}
	};

	// Filter out past dates
	const tileDisabled = ({ date }: { date: Date }) => {
		return (
			isBefore(date, new Date()) &&
			!format(date, 'yyyy-MM-dd').includes(format(new Date(), 'yyyy-MM-dd'))
		);
	};

	// Custom tile content to show appointment indicators
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

	const selectedDateAppointments = date
		? getAppointmentsForDate(date as Date)
		: [];

	return (
		<div>
			<div className='mb-6'>
				<h1 className='text-2xl font-bold text-gray-900'>
					Manage Appointments
				</h1>
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
				{/* Calendar */}
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

				{/* Appointments for Selected Date */}
				<Card>
					<CardHeader>
						<h2 className='text-lg font-semibold'>
							{date ? format(date as Date, 'MMMM d, yyyy') : 'Select a Date'}
						</h2>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<div className='flex justify-center py-8'>
								<Spinner />
							</div>
						) : selectedDateAppointments.length > 0 ? (
							<div className='space-y-4'>
								{selectedDateAppointments.map((appointment) => (
									<div
										key={appointment.id}
										className={`p-3 border rounded-lg cursor-pointer transition-colors ${
											selectedAppointment?.id === appointment.id
												? 'border-blue-500 bg-blue-50'
												: 'border-gray-200 hover:bg-gray-50'
										}`}
										onClick={() => setSelectedAppointment(appointment)}
									>
										<div className='flex items-center justify-between mb-2'>
											<div className='flex items-center'>
												<Clock size={16} className='text-blue-500 mr-2' />
												<span className='font-medium'>
													{appointment.start_time} - {appointment.end_time}
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

			{/* Appointment Details */}
			{selectedAppointment && (
				<Card className='mt-6'>
					<CardHeader>
						<h2 className='text-lg font-semibold'>Appointment Details</h2>
					</CardHeader>
					<CardContent>
						<div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-6'>
							<div>
								<h3 className='text-md font-medium mb-3 flex items-center'>
									<Calendar className='h-5 w-5 text-blue-500 mr-2' />
									Date & Time
								</h3>
								<div className='bg-gray-50 p-4 rounded-lg'>
									<div className='mb-2'>
										<p className='text-sm text-gray-500'>Date</p>
										<p className='font-medium'>
											{new Date(selectedAppointment.date).toLocaleDateString(
												'en-US',
												{
													weekday: 'long',
													year: 'numeric',
													month: 'long',
													day: 'numeric',
												},
											)}
										</p>
									</div>
									<div>
										<p className='text-sm text-gray-500'>Time</p>
										<p className='font-medium'>
											{selectedAppointment.start_time} -{' '}
											{selectedAppointment.end_time}
										</p>
									</div>
								</div>
							</div>

							<div>
								<h3 className='text-md font-medium mb-3 flex items-center'>
									<User className='h-5 w-5 text-blue-500 mr-2' />
									Tenant Information
								</h3>
								<div className='bg-gray-50 p-4 rounded-lg'>
									<div className='mb-2'>
										<p className='text-sm text-gray-500'>Name</p>
										<p className='font-medium'>
											{selectedAppointment.tenant_name}
										</p>
									</div>
									<div>
										<p className='text-sm text-gray-500'>Contact</p>
										<p className='font-medium'>555-123-4567</p>
									</div>
								</div>
							</div>
						</div>

						<div className='mb-6'>
							<h3 className='text-md font-medium mb-3 flex items-center'>
								<MapPin className='h-5 w-5 text-blue-500 mr-2' />
								Property Information
							</h3>
							<div className='bg-gray-50 p-4 rounded-lg'>
								<div className='mb-2'>
									<p className='text-sm text-gray-500'>Address</p>
									<p className='font-medium'>
										{selectedAppointment.property_address}
									</p>
								</div>
								<div className='grid grid-cols-2 gap-4'>
									<div>
										<p className='text-sm text-gray-500'>Property Type</p>
										<p className='font-medium'>Apartment</p>
									</div>
									<div>
										<p className='text-sm text-gray-500'>Monthly Rent</p>
										<p className='font-medium'>$2,000</p>
									</div>
								</div>
							</div>
						</div>

						{selectedAppointment.notes && (
							<div className='mb-6'>
								<h3 className='text-md font-medium mb-3 flex items-center'>
									<MessageSquare className='h-5 w-5 text-blue-500 mr-2' />
									Notes
								</h3>
								<div className='bg-gray-50 p-4 rounded-lg'>
									<p className='text-gray-700'>{selectedAppointment.notes}</p>
								</div>
							</div>
						)}

						<div className='flex space-x-4'>
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
					</CardContent>
				</Card>
			)}

			{/* All Upcoming Appointments */}
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
												new Date(a.date).getTime() - new Date(b.date).getTime(),
										)
										.map((appointment) => (
											<tr key={appointment.id}>
												<td className='px-6 py-4 whitespace-nowrap'>
													<div className='text-sm font-medium text-gray-900'>
														{new Date(appointment.date).toLocaleDateString()}
													</div>
													<div className='text-sm text-gray-500'>
														{appointment.start_time} - {appointment.end_time}
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
														onClick={() => setSelectedAppointment(appointment)}
													>
														View
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
	);
};

export default ManageAppointments;
