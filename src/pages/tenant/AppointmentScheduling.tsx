import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useTenantStore } from '../../store/tenantStore';
import { Card, CardHeader, CardContent, CardFooter } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Spinner from '../../components/ui/Spinner';
import Calendar from 'react-calendar';
import { format, parse, isAfter, isBefore, addDays } from 'date-fns';
import { Calendar as CalendarIcon, Clock, MapPin, User, Check, X } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import 'react-calendar/dist/Calendar.css';

type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

const AppointmentScheduling: React.FC = () => {
  const { user } = useAuthStore();
  const { appointments, fetchAppointments, scheduleAppointment, isLoading } = useTenantStore();
  
  const [date, setDate] = useState<Value>(new Date());
  const [timeSlot, setTimeSlot] = useState<string>('');
  const [propertyId, setPropertyId] = useState<string>('1'); // Default to first property for MVP
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  
  // Mock available properties for MVP
  const availableProperties = [
    { id: '1', address: '456 Oak Ave, Metropolis, NY 10001' },
    { id: '2', address: '789 Pine St, Metropolis, NY 10002' },
  ];
  
  // Mock available time slots
  const availableTimeSlots = [
    '09:00-09:30', '10:00-10:30', '11:00-11:30', 
    '13:00-13:30', '14:00-14:30', '15:00-15:30', '16:00-16:30'
  ];
  
  useEffect(() => {
    if (user) {
      fetchAppointments(user.id);
    }
  }, [user, fetchAppointments]);
  
  const handleDateChange = (value: Value) => {
    setDate(value);
    setTimeSlot('');
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!date || !timeSlot || !propertyId) {
      setError('Please select a date, time slot, and property.');
      return;
    }
    
    if (!user) {
      setError('You must be logged in to schedule an appointment.');
      return;
    }
    
    try {
      const selectedDate = date as Date;
      const [startTime, endTime] = timeSlot.split('-');
      
      await scheduleAppointment({
        tenant_id: user.id,
        property_id: propertyId,
        agent_id: '2', // Default agent ID for MVP
        date: format(selectedDate, 'yyyy-MM-dd'),
        start_time: startTime,
        end_time: endTime,
        status: 'scheduled',
        notes: notes,
      });
      
      setSuccess('Appointment scheduled successfully!');
      setDate(new Date());
      setTimeSlot('');
      setNotes('');
    } catch (err) {
      setError('Failed to schedule appointment. Please try again.');
    }
  };
  
  // Filter out past dates
  const tileDisabled = ({ date }: { date: Date }) => {
    return isBefore(date, new Date()) && !format(date, 'yyyy-MM-dd').includes(format(new Date(), 'yyyy-MM-dd'));
  };
  
  // Check if a time slot is already booked for the selected date
  const isTimeSlotBooked = (slot: string) => {
    if (!date) return false;
    
    const selectedDate = format(date as Date, 'yyyy-MM-dd');
    const [startTime] = slot.split('-');
    
    return appointments.some(
      appointment => 
        appointment.date === selectedDate && 
        appointment.start_time === startTime
    );
  };
  
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Schedule a Viewing</h1>
        <p className="text-gray-600 mt-1">Book an appointment to view a property</p>
      </div>
      
      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert variant="success" className="mb-6">
          {success}
        </Alert>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="text-lg font-semibold">Select a Date</h2>
          </CardHeader>
          <CardContent>
            <div className="calendar-container">
              <Calendar 
                onChange={handleDateChange} 
                value={date} 
                tileDisabled={tileDisabled}
                minDate={new Date()}
                maxDate={addDays(new Date(), 30)}
                className="w-full border-none"
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Time Slots */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Available Time Slots</h2>
          </CardHeader>
          <CardContent>
            {date ? (
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Selected date: <span className="font-medium">{format(date as Date, 'MMMM d, yyyy')}</span>
                </p>
                <div className="space-y-2">
                  {availableTimeSlots.map((slot) => {
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
                        <div className="flex items-center justify-between">
                          <span className="flex items-center">
                            <Clock size={16} className="mr-2" />
                            {slot}
                          </span>
                          {isBooked ? (
                            <Badge variant="danger">Booked</Badge>
                          ) : timeSlot === slot ? (
                            <Check size={16} className="text-blue-600" />
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Please select a date first
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Appointment Details */}
      <Card className="mt-6">
        <CardHeader>
          <h2 className="text-lg font-semibold">Appointment Details</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Property
              </label>
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                {availableProperties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.address}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special requests or questions about the property..."
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                rows={3}
              />
            </div>
            
            <div className="bg-gray-50 p-4 rounded-md mb-4">
              <h3 className="font-medium text-gray-900 mb-2">Appointment Summary</h3>
              <div className="space-y-2">
                <div className="flex items-start">
                  <CalendarIcon size={18} className="text-gray-500 mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Date</p>
                    <p className="text-sm text-gray-600">
                      {date ? format(date as Date, 'MMMM d, yyyy') : 'Not selected'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Clock size={18} className="text-gray-500 mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Time</p>
                    <p className="text-sm text-gray-600">
                      {timeSlot || 'Not selected'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <MapPin size={18} className="text-gray-500 mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Property</p>
                    <p className="text-sm text-gray-600">
                      {availableProperties.find(p => p.id === propertyId)?.address || 'Not selected'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <User size={18} className="text-gray-500 mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Agent</p>
                    <p className="text-sm text-gray-600">
                      John Smith (Property Manager)
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <Button
              type="submit"
              isLoading={isLoading}
              disabled={!date || !timeSlot || !propertyId}
              className="w-full"
            >
              Schedule Appointment
            </Button>
          </form>
        </CardContent>
      </Card>
      
      {/* Upcoming Appointments */}
      <Card className="mt-6">
        <CardHeader>
          <h2 className="text-lg font-semibold">Your Upcoming Appointments</h2>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : appointments.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {appointments.map((appointment) => (
                <div key={appointment.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center mb-1">
                        <CalendarIcon size={16} className="text-blue-500 mr-2" />
                        <span className="font-medium">
                          {appointment.date} at {appointment.start_time} - {appointment.end_time}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        <MapPin size={14} className="inline mr-1" />
                        {availableProperties.find(p => p.id === appointment.property_id)?.address}
                      </p>
                      {appointment.notes && (
                        <p className="text-sm text-gray-600 mt-2">
                          <span className="font-medium">Notes:</span> {appointment.notes}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={
                        appointment.status === 'scheduled' ? 'info' :
                        appointment.status === 'completed' ? 'success' : 'warning'
                      }
                    >
                      {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No upcoming appointments</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AppointmentScheduling;