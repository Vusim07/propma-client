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
			<div className='flex-1 bg-white flex items-center justify-center p-4'>
				<p className='text-gray-500'>Select an email to view details</p>
			</div>
		);
	}

	if (!thread.messages || thread.messages.length === 0) {
		return (
			<div className='flex-1 bg-white flex items-center justify-center p-4'>
				<p className='text-gray-500'>No messages in this thread.</p>
			</div>
		);
	}

	if (!message) {
		return (
			<div className='flex-1 bg-white flex items-center justify-center p-4'>
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
		<div className='flex-1 bg-white flex flex-col max-h-screen overflow-hidden'>
			{/* Main header - Hidden on mobile as we use the parent's header */}
			<div className='hidden md:block border-b border-gray-200'>
				<div className='px-4 md:px-6 py-4 overflow-hidden'>
					<div className='flex items-start gap-4 min-w-0'>
						<Avatar className='w-10 h-10 rounded-full bg-blue-100 flex-shrink-0'>
							<AvatarFallback>
								{getInitials(message.from_name ?? undefined) ||
									message.from_address.charAt(0).toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<div className='flex-1 min-w-0'>
							<h2 className='text-base font-semibold text-gray-900 truncate'>
								{message.from_name || message.from_address}
							</h2>
							<p className='text-sm text-gray-600 truncate'>
								{message.from_address}
							</p>
						</div>
						<div className='flex items-center gap-2 flex-shrink-0'>
							<Button variant='ghost' size='icon' className='h-9 w-9'>
								<Star className='h-[18px] w-[18px]' />
							</Button>
							<Button variant='ghost' size='icon' className='h-9 w-9'>
								<Flag className='h-[18px] w-[18px]' />
							</Button>
						</div>
					</div>

					{/* Subject and metadata */}
					<div className='mt-3 space-y-2'>
						<h1 className='text-lg font-semibold text-gray-900 break-words'>
							{thread.subject}
						</h1>

						<div className='flex flex-wrap items-center gap-2'>
							{thread.property?.address && (
								<div className='text-sm text-blue-700 break-all'>
									{thread.property.address}
								</div>
							)}
							{thread.application?.status && (
								<Badge
									variant={
										thread.application.status === 'approved'
											? 'default'
											: thread.application.status === 'rejected'
											? 'destructive'
											: 'secondary'
									}
								>
									{thread.application.status.charAt(0).toUpperCase() +
										thread.application.status.slice(1)}
								</Badge>
							)}
							{thread.lead_source && (
								<Badge className={`${getLeadSourceColor(thread.lead_source)}`}>
									{thread.lead_source}
								</Badge>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Messages Section */}
			<div className='flex-1 overflow-y-auto'>
				<div className='px-4 md:px-6 py-4 space-y-6 max-w-full'>
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
			<div className='border-t border-gray-200 bg-white'>
				<div className='px-4 md:px-6 py-4 max-w-full'>
					<ReplyBox onSend={handleSendMessage} />
				</div>
			</div>
		</div>
	);
};

export default EmailDetail;
