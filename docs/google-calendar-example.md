//available-slots.ts
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

// Add better initial logging to debug environment issues
console.log('Function loaded, checking environment variables...');
const CREDENTIALS = (() => {
try {
console.log(
'GOOGLE_CREDENTIALS env exists:',
!!process.env.GOOGLE_CREDENTIALS,
);
return JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}');
} catch (error) {
console.error('Error parsing GOOGLE_CREDENTIALS:', error);
return {};
}
})();

// Initialize the Calendar API client with service account
const initializeCalendarClient = () => {
const clientEmail = CREDENTIALS.client_email;
const privateKey = CREDENTIALS.private_key;

    console.log(
    	'Initializing calendar client with email:',
    	clientEmail ? 'Present' : 'Missing',
    );
    console.log('Private key:', privateKey ? 'Present' : 'Missing');

    if (!clientEmail || !privateKey) {
    	throw new Error(
    		'Missing required environment variables for Google Calendar API',
    	);
    }

    const credentials = {
    	client_email: clientEmail,
    	private_key: privateKey.replace(/\\n/g, '\n'),
    };

    const auth = new JWT({
    	email: credentials.client_email,
    	key: credentials.private_key,
    	scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    return google.calendar({ version: 'v3', auth });

};

// Coach's calendar ID
const COACH_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';
console.log('Using calendar ID:', COACH_CALENDAR_ID);

// South African public holidays calendar ID
const SA_HOLIDAYS_CALENDAR_ID = 'en.sa#holiday@group.v.calendar.google.com';

// Fetches out of office events from the calendar
const getOutOfOfficeEvents = async (calendarApi, startTime, endTime) => {
try {
console.log('Fetching out of office events...');

    	const response = await calendarApi.events.list({
    		calendarId: COACH_CALENDAR_ID,
    		timeMin: startTime.toISOString(),
    		timeMax: endTime.toISOString(),
    		singleEvents: true,
    		eventTypes: ['outOfOffice'], // Focus on out of office events
    	});

    	console.log(
    		`Found ${response.data.items?.length || 0} out of office events`,
    	);
    	return response.data.items || [];
    } catch (error) {
    	console.error('Error fetching out of office events:', error);
    	return [];
    }

};

// Fetches South African public holidays
const getSouthAfricanHolidays = async (calendarApi, startTime, endTime) => {
try {
console.log('Fetching South African holidays...');

    	const response = await calendarApi.events.list({
    		calendarId: SA_HOLIDAYS_CALENDAR_ID,
    		timeMin: startTime.toISOString(),
    		timeMax: endTime.toISOString(),
    		singleEvents: true,
    	});

    	console.log(`Found ${response.data.items?.length || 0} SA holidays`);
    	return response.data.items || [];
    } catch (error) {
    	console.error('Error fetching South African holidays:', error);
    	return [];
    }

};

export const handler = async (event) => {
// Add CORS headers to all responses
const headers = {
'Access-Control-Allow-Origin': '\*',
'Access-Control-Allow-Headers': 'Content-Type',
'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
    	return {
    		statusCode: 200,
    		headers,
    		body: '',
    	};
    }

    try {
    	console.log(
    		'Request received with query parameters:',
    		event.queryStringParameters,
    	);
    	const { date, duration } = event.queryStringParameters || {};
    	if (!date) {
    		console.log('Missing date parameter');
    		return {
    			statusCode: 400,
    			headers,
    			body: JSON.stringify({ error: 'Date parameter is required' }),
    		};
    	}

    	// Use the provided duration or default to 60 minutes
    	const serviceDuration = parseInt(duration, 10) || 60;
    	console.log('Service duration:', serviceDuration, 'minutes');

    	console.log('Processing date:', date);
    	const selectedDate = new Date(date);
    	console.log('Selected date object:', selectedDate.toISOString());

    	if (isNaN(selectedDate.getTime())) {
    		console.error('Invalid date format received:', date);
    		return {
    			statusCode: 400,
    			headers,
    			body: JSON.stringify({ error: 'Invalid date format' }),
    		};
    	}

    	const calendarApi = initializeCalendarClient();

    	// Set time bounds for the selected date
    	const startTime = new Date(selectedDate);
    	startTime.setHours(0, 0, 0, 0);

    	const endTime = new Date(selectedDate);
    	endTime.setHours(23, 59, 59, 999);

    	// Check if the date is a South African public holiday
    	const saHolidays = await getSouthAfricanHolidays(
    		calendarApi,
    		startTime,
    		endTime,
    	);
    	if (saHolidays.length > 0) {
    		console.log(
    			'Selected date is a South African public holiday:',
    			saHolidays[0]?.summary,
    		);
    		return {
    			statusCode: 200,
    			headers,
    			body: JSON.stringify({
    				slots: [],
    				message: `No slots available on public holiday: ${saHolidays[0]?.summary}`,
    			}),
    		};
    	}

    	// Get out of office events
    	const outOfOfficeEvents = await getOutOfOfficeEvents(
    		calendarApi,
    		startTime,
    		endTime,
    	);

    	// Check if the entire day is marked as out of office
    	const fullDayOOO = outOfOfficeEvents.some((event) => {
    		// Check if the event spans the entire day or most of it
    		if (event.start && event.end) {
    			const eventStart = new Date(event.start.dateTime || event.start.date);
    			const eventEnd = new Date(event.end.dateTime || event.end.date);

    			// If it's a full-day event or covers most business hours
    			if (
    				event.start.date ||
    				(eventStart <= new Date(selectedDate.setHours(9, 0, 0, 0)) &&
    					eventEnd >= new Date(selectedDate.setHours(15, 0, 0, 0)))
    			) {
    				return true;
    			}
    		}
    		return false;
    	});

    	if (fullDayOOO) {
    		console.log('Selected date has out of office status for the entire day');
    		return {
    			statusCode: 200,
    			headers,
    			body: JSON.stringify({
    				slots: [],
    				message: 'No slots available due to out of office status',
    			}),
    		};
    	}

    	// Get busy slots from coach calendar
    	const response = await calendarApi.freebusy.query({
    		requestBody: {
    			timeMin: startTime.toISOString(),
    			timeMax: endTime.toISOString(),
    			items: [{ id: COACH_CALENDAR_ID }],
    		},
    	});

    	// Default available time slots
    	const ALL_TIME_SLOTS = [
    		'9:00',
    		'10:00',
    		'11:00',
    		'13:00',
    		'14:00',
    		'15:00',
    	];

    	// Get busy periods
    	const busySlots = response.data.calendars?.[COACH_CALENDAR_ID]?.busy || [];

    	// Create additional busy slots from out of office events that aren't full day
    	const oooBusySlots = outOfOfficeEvents
    		.filter((event) => event.start?.dateTime && event.end?.dateTime) // Only include events with specific times
    		.map((event) => ({
    			start: event.start.dateTime,
    			end: event.end.dateTime,
    		}));

    	// Combine regular busy slots with out of office slots
    	const allBusySlots = [...busySlots, ...oooBusySlots];

    	// Filter out slots that overlap with busy periods
    	const availableSlots = ALL_TIME_SLOTS.filter((timeSlot) => {
    		const [hours, minutes] = timeSlot.split(':').map(Number);
    		const slotStartTime = new Date(selectedDate);
    		slotStartTime.setHours(hours, minutes, 0, 0);

    		const slotEndTime = new Date(slotStartTime);
    		// Use the service duration instead of fixed 1 hour
    		slotEndTime.setMinutes(slotStartTime.getMinutes() + serviceDuration);

    		// Check if this slot overlaps with any busy period
    		return !allBusySlots.some((busySlot) => {
    			const busyStart = new Date(busySlot.start || '');
    			const busyEnd = new Date(busySlot.end || '');

    			return (
    				(slotStartTime >= busyStart && slotStartTime < busyEnd) ||
    				(slotEndTime > busyStart && slotEndTime <= busyEnd) ||
    				(slotStartTime <= busyStart && slotEndTime >= busyEnd)
    			);
    		});
    	});

    	// Log the response before returning
    	console.log('Returning available slots:', availableSlots);

    	return {
    		statusCode: 200,
    		headers,
    		body: JSON.stringify({ slots: availableSlots }),
    	};
    } catch (error) {
    	console.error('Error fetching available slots:', error);
    	// Include error details in response for better debugging
    	return {
    		statusCode: 500,
    		headers,
    		body: JSON.stringify({
    			error: 'Failed to retrieve available slots',
    			message: error.message,
    			stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
    		}),
    	};
    }

};

//create-event.ts
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

const CREDENTIALS = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}');

// Initialize the Calendar API client
const initializeCalendarClient = () => {
const clientEmail = CREDENTIALS.client_email;
const privateKey = CREDENTIALS.private_key;
const impersonatedUser =
process.env.CALENDAR_USER_EMAIL || 'bbndaba@yaap.co.za';

    if (!clientEmail || !privateKey) {
    	throw new Error(
    		'Missing required environment variables for Google Calendar API',
    	);
    }

    const credentials = {
    	client_email: clientEmail,
    	private_key: privateKey.replace(/\\n/g, '\n'),
    };

    const auth = new JWT({
    	email: credentials.client_email,
    	key: credentials.private_key,
    	scopes: ['https://www.googleapis.com/auth/calendar'],
    	subject: impersonatedUser,
    });

    return google.calendar({ version: 'v3', auth });

};

// Coach's calendar ID
const COACH_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';

export const handler = async (event) => {
// Add CORS headers to all responses
const headers = {
'Access-Control-Allow-Origin': '\*',
'Access-Control-Allow-Headers': 'Content-Type',
'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
    	return {
    		statusCode: 200,
    		headers,
    		body: '',
    	};
    }
    try {
    	const {
    		title,
    		description,
    		date,
    		timeSlot,
    		attendeeEmail,
    		duration,
    		type, // New parameter: "service" or "workshop"
    		workshopId, // Unique identifier for the workshop
    	} = JSON.parse(event.body || '{}');

    	// Validate required fields
    	if (!date || !timeSlot || !attendeeEmail) {
    		return {
    			statusCode: 400,
    			body: JSON.stringify({ error: 'Missing required booking details' }),
    		};
    	}

    	const calendarApi = initializeCalendarClient();

    	// Parse time slot
    	const [hours, minutes] = timeSlot.split(':').map(Number);

    	// Create event start and end times
    	const startDateTime = new Date(date);
    	startDateTime.setHours(hours, minutes, 0, 0);

    	const endDateTime = new Date(startDateTime);
    	endDateTime.setMinutes(startDateTime.getMinutes() + (duration || 60));

    	// For workshops, check if an event already exists
    	if (type === 'workshop' && workshopId) {
    		// Try to find existing workshop event
    		const existingEventsResponse = await calendarApi.events.list({
    			calendarId: COACH_CALENDAR_ID,
    			timeMin: startDateTime.toISOString(),
    			timeMax: endDateTime.toISOString(),
    			q: workshopId, // Search by workshop ID in event details
    			singleEvents: true,
    		});

    		const existingWorkshopEvents = existingEventsResponse.data.items?.filter(
    			(event) =>
    				event.description?.includes(`workshopId: ${workshopId}`) ||
    				event.summary?.includes(title),
    		);

    		if (existingWorkshopEvents && existingWorkshopEvents.length > 0) {
    			// Found existing workshop event - add the new attendee
    			const existingEvent = existingWorkshopEvents[0];
    			const existingAttendees = existingEvent.attendees || [];

    			// Only add if not already an attendee
    			if (!existingAttendees.find((a) => a.email === attendeeEmail)) {
    				existingAttendees.push({ email: attendeeEmail });

    				// Update the event with the new attendee
    				await calendarApi.events.patch({
    					calendarId: COACH_CALENDAR_ID,
    					eventId: existingEvent.id,
    					requestBody: {
    						attendees: existingAttendees,
    					},
    					sendUpdates: 'all', // Send notifications to attendees
    				});

    				return {
    					statusCode: 200,
    					body: JSON.stringify({
    						success: true,
    						eventId: existingEvent.id,
    						message: 'Added to existing workshop event',
    					}),
    				};
    			} else {
    				// Already an attendee
    				return {
    					statusCode: 200,
    					body: JSON.stringify({
    						success: true,
    						eventId: existingEvent.id,
    						message: 'Already registered for this workshop',
    					}),
    				};
    			}
    		}
    	}

    	// For new events (services or new workshops)
    	// Enhanced description for workshop events to make them searchable
    	const enhancedDescription =
    		type === 'workshop'
    			? `${description}\n\nWorkshop Id: ${workshopId}`
    			: description;

    	const calendarEvent = {
    		summary: title || 'Yaap Coaching Session',
    		description: enhancedDescription || 'Booking details',
    		start: {
    			dateTime: startDateTime.toISOString(),
    			timeZone: 'Africa/Johannesburg',
    		},
    		end: {
    			dateTime: endDateTime.toISOString(),
    			timeZone: 'Africa/Johannesburg',
    		},
    		attendees: [{ email: attendeeEmail }],
    		reminders: {
    			useDefault: false,
    			overrides: [
    				{ method: 'email', minutes: 24 * 60 },
    				{ method: 'popup', minutes: 30 },
    			],
    		},
    		// Add conferencing data to automatically create Google Meet link
    		conferenceData: {
    			createRequest: {
    				requestId: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    				conferenceSolutionKey: { type: 'hangoutsMeet' },
    			},
    		},
    		// Access control settings
    		guestsCanModify: false,
    		guestsCanInviteOthers: false,
    		anyoneCanAddSelf: false,
    		guestsCanSeeOtherGuests: false,
    	};

    	const response = await calendarApi.events.insert({
    		calendarId: COACH_CALENDAR_ID,
    		requestBody: calendarEvent,
    		sendUpdates: 'all', // Send emails to attendees
    		conferenceDataVersion: 1, // Required to create the conference
    	});

    	return {
    		statusCode: 200,
    		body: JSON.stringify({
    			success: true,
    			eventId: response.data.id,
    			message: 'Calendar event created successfully',
    		}),
    	};
    } catch (error) {
    	console.error('Error creating calendar event:', error);
    	return {
    		statusCode: 500,
    		body: JSON.stringify({
    			success: false,
    			error: 'Failed to create calendar event',
    			message: error.message,
    		}),
    	};
    }

};
