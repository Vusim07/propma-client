/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Star, Flag } from 'lucide-react';
import EmailMessage from './EmailMessage';
import AISuggestion from './AISuggestion';
import ReplyBox from './ReplyBox';
import {
	EmailThreadWithRelations,
	EmailMessageWithRelations,
} from '@/types/inbox';

interface EmailDetailProps {
	thread: EmailThreadWithRelations | null;
	message: EmailMessageWithRelations | null;
}

const getLeadSourceColor = (source: string) => {
	switch (source.toLowerCase()) {
		case 'property24':
			return 'bg-blue-100 text-blue-800';
		case 'privateproperty':
			return 'bg-green-100 text-green-800';
		case 'gumtree':
			return 'bg-orange-100 text-orange-800';
		case 'olx':
			return 'bg-purple-100 text-purple-800';
		case 'website':
			return 'bg-gray-100 text-gray-800';
		default:
			return 'bg-gray-100 text-gray-800';
	}
};

// Utility to get initials from a name string
const getInitials = (name?: string) => {
	if (!name) return '';
	const parts = name.trim().split(' ');
	if (parts.length === 1) return parts[0][0]?.toUpperCase() || '';
	return (
		(parts[0][0] || '') + (parts[parts.length - 1][0] || '')
	).toUpperCase();
};

const EmailDetail: React.FC<EmailDetailProps> = ({ thread, message }) => {
	console.log('EmailDetail props:', { thread, message });

	if (!thread) {
		return (
			<div className='flex-1 bg-white flex items-center justify-center'>
				<p className='text-gray-500'>Select an email to view details</p>
			</div>
		);
	}

	if (!thread.messages || thread.messages.length === 0) {
		return (
			<div className='flex-1 bg-white flex items-center justify-center'>
				<p className='text-gray-500'>No messages in this thread.</p>
			</div>
		);
	}

	if (!message) {
		return (
			<div className='flex-1 bg-white flex items-center justify-center'>
				<p className='text-gray-500'>Select a message to view details</p>
			</div>
		);
	}

	const handleMarkPriority = () => {
		console.log('Marked as high priority');
	};

	const handleSendMessage = (message: string) => {
		console.log('Sending message:', message);
	};

	return (
		<div className='flex-1 bg-white flex flex-col'>
			{/* Header */}
			<div className='p-6 border-b border-gray-200'>
				<div className='flex items-center justify-between mb-4'>
					<div className='flex items-center gap-3'>
						<Avatar className='w-8 h-8 rounded-full bg-blue-100'>
							<AvatarFallback>
								{getInitials(message.from_name as any) ||
									message.from_address.charAt(0).toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<div>
							<h2 className='text-lg font-semibold text-gray-900'>
								{message.from_name || message.from_address}
							</h2>
							<p className='text-sm text-gray-500'>{message.from_address}</p>
							<p className='text-sm text-gray-700 mt-1'>{thread.subject}</p>
							{/* Property reference display */}
							{thread.property?.address && (
								<p className='text-xs text-blue-700 mt-1 truncate'>
									{thread.property.address}
								</p>
							)}
							{/* Application status badge */}
							{thread.application?.status && (
								<Badge
									variant={
										thread.application.status === 'approved'
											? 'default'
											: thread.application.status === 'rejected'
											? 'destructive'
											: 'secondary'
									}
									className='text-xs mt-1'
								>
									{thread.application.status.charAt(0).toUpperCase() +
										thread.application.status.slice(1)}
								</Badge>
							)}
							{thread.lead_source && (
								<Badge
									className={`text-xs mt-1 ${getLeadSourceColor(
										thread.lead_source,
									)}`}
								>
									{thread.lead_source}
								</Badge>
							)}
						</div>
					</div>
					<div className='flex items-center gap-2'>
						<Button variant='ghost' size='icon'>
							<Star className='h-4 w-4' />
						</Button>
						<Button variant='ghost' size='icon'>
							<Flag className='h-4 w-4' />
						</Button>
					</div>
				</div>
				{/* Appointment info or schedule action */}
				{thread.appointment ? (
					<div className='mt-2'>
						<Badge className='bg-indigo-100 text-indigo-800 text-xs mr-2'>
							Viewing: {thread.appointment.date} {thread.appointment.start_time}
						</Badge>
						<Badge
							className={`text-xs ml-1 ${
								thread.appointment.status === 'scheduled'
									? 'bg-green-100 text-green-800'
									: thread.appointment.status === 'completed'
									? 'bg-gray-100 text-gray-800'
									: 'bg-red-100 text-red-800'
							}`}
						>
							{thread.appointment.status.charAt(0).toUpperCase() +
								thread.appointment.status.slice(1)}
						</Badge>
					</div>
				) : (
					<Button className='mt-2' size='sm' variant='outline'>
						Schedule Viewing
					</Button>
				)}
			</div>

			{/* Email Content */}
			<div className='flex-1 p-6 overflow-y-auto'>
				<div className='space-y-6'>
					{/* Messages */}
					{thread.messages?.map((msg) => (
						<EmailMessage
							key={msg.id}
							sender={msg.from_name || msg.from_address}
							avatar={`https://api.dicebear.com/7.x/avataaars/svg?seed=${
								msg.from_name || msg.from_address
							}`}
							content={msg.body}
							timestamp={new Date(msg.created_at).toLocaleString()}
							isFromUser={msg.status === 'sent'}
						/>
					))}

					{/* AI Suggestions */}
					{message.ai_suggestions?.map((suggestion) => (
						<AISuggestion
							key={suggestion.id}
							type={
								suggestion.suggestion_type === 'follow_up'
									? 'reminder'
									: 'status'
							}
							title={
								suggestion.suggestion_type === 'follow_up'
									? 'Reminder:'
									: 'Lead Status Update:'
							}
							message={suggestion.content}
							actionText={
								suggestion.suggestion_type === 'follow_up'
									? 'Mark as High Priority'
									: undefined
							}
							onAction={
								suggestion.suggestion_type === 'follow_up'
									? handleMarkPriority
									: undefined
							}
						/>
					))}
				</div>
			</div>

			{/* Reply Box */}
			<ReplyBox onSend={handleSendMessage} />
		</div>
	);
};

export default EmailDetail;
