import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { EmailThreadWithRelations } from '@/types/inbox';

interface EmailListProps {
	threads: EmailThreadWithRelations[];
	selectedThread: EmailThreadWithRelations | null;
	onSelectThread: (threadId: string) => void;
	isLoading?: boolean;
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

const EmailList: React.FC<EmailListProps> = ({
	threads,
	selectedThread,
	onSelectThread,
	isLoading = false,
}) => {
	// Sort threads by latest message timestamp (descending)
	const sortedThreads = [...threads].sort((a, b) => {
		const getLatestMessageTime = (thread: EmailThreadWithRelations) => {
			if (!thread.messages || thread.messages.length === 0)
				return new Date(thread.last_message_at).getTime();
			return Math.max(
				...thread.messages.map((msg) => {
					return msg.sent_at
						? new Date(msg.sent_at).getTime()
						: msg.received_at
						? new Date(msg.received_at).getTime()
						: msg.created_at
						? new Date(msg.created_at).getTime()
						: 0;
				}),
			);
		};
		return getLatestMessageTime(b) - getLatestMessageTime(a);
	});

	if (isLoading) {
		return (
			<ScrollArea className='h-[calc(100vh-8rem)]' type='auto'>
				<div className='p-4 text-center text-gray-500'>Loading threads...</div>
			</ScrollArea>
		);
	}

	if (sortedThreads.length === 0) {
		return (
			<ScrollArea className='h-[calc(100vh-8rem)]' type='auto'>
				<div className='p-4 text-center text-gray-500'>No threads found</div>
			</ScrollArea>
		);
	}

	return (
		<ScrollArea className='h-[calc(100vh-8rem)]' type='auto'>
			<div className='divide-y divide-gray-100'>
				{sortedThreads.map((thread) => {
					// Use the initial sender (first message in thread)
					const initialMsg =
						thread.messages && thread.messages.length > 0
							? thread.messages[0]
							: undefined;
					const fromName = initialMsg?.lead_name || '';
					const fromAddress = initialMsg?.lead_email || 'Unknown Sender';
					const propertyAddress = thread.property?.address;
					const applicationStatus = thread.application?.status;
					const isUnread = thread.status === 'active';
					const needsFollowUp = thread.needs_follow_up;
					// Find the latest message for display time
					const latestMsg =
						thread.messages && thread.messages.length > 0
							? thread.messages.reduce((latest, msg) => {
									const latestTime =
										latest.sent_at || latest.received_at || latest.created_at;
									const msgTime =
										msg.sent_at || msg.received_at || msg.created_at;
									return new Date(msgTime).getTime() >
										new Date(latestTime).getTime()
										? msg
										: latest;
							  }, thread.messages[0])
							: undefined;
					const displayTime = latestMsg
						? new Date(
								latestMsg.sent_at ||
									latestMsg.received_at ||
									latestMsg.created_at,
						  ).toLocaleTimeString()
						: new Date(thread.last_message_at).toLocaleTimeString();

					return (
						<div
							key={thread.id}
							className={`p-4 cursor-pointer hover:bg-gray-50 active:bg-gray-100 touch-manipulation max-w-[420px] min-w-[320px] w-[400px] ${
								selectedThread?.id === thread.id
									? 'bg-blue-50 border-r-2 border-blue-600 md:border-r-2'
									: ''
							}`}
							onClick={() => onSelectThread(thread.id)}
						>
							<div className='flex items-start gap-4'>
								<Avatar className='w-10 h-10 md:w-8 md:h-8 rounded-full bg-blue-100 flex-shrink-0'>
									<AvatarFallback>
										{getInitials(fromName) ||
											fromAddress.charAt(0).toUpperCase()}
									</AvatarFallback>
								</Avatar>

								<div className='flex-1 min-w-0 space-y-1'>
									<div className='flex items-center justify-between gap-2'>
										<h3
											className={`text-sm font-medium truncate max-w-[180px] ${
												isUnread ? 'text-gray-900' : 'text-gray-700'
											}`}
										>
											{fromAddress}
										</h3>
										<span className='text-xs text-gray-500 whitespace-nowrap'>
											{displayTime}
										</span>
									</div>

									{propertyAddress && (
										<p className='text-xs text-blue-700 truncate'>
											{propertyAddress}
										</p>
									)}

									<p
										className={`text-sm truncate max-w-[180px] ${
											isUnread ? 'font-medium text-gray-900' : 'text-gray-700'
										}`}
									>
										{thread.subject}
									</p>

									<div className='flex flex-wrap items-center gap-2 pt-1'>
										{isUnread && (
											<Badge
												variant='secondary'
												className='bg-green-100 text-green-800 text-xs'
											>
												New
											</Badge>
										)}
										{needsFollowUp && (
											<Badge
												variant='secondary'
												className='bg-orange-100 text-orange-800 text-xs'
											>
												Follow-up
											</Badge>
										)}
										{applicationStatus && (
											<Badge
												variant={
													applicationStatus === 'approved'
														? 'default'
														: applicationStatus === 'rejected'
														? 'destructive'
														: 'secondary'
												}
												className='text-xs'
											>
												{applicationStatus.charAt(0).toUpperCase() +
													applicationStatus.slice(1)}
											</Badge>
										)}
										{thread.lead_source && (
											<Badge
												className={`text-xs ${getLeadSourceColor(
													thread.lead_source,
												)}`}
											>
												{thread.lead_source}
											</Badge>
										)}
									</div>
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</ScrollArea>
	);
};

export default EmailList;
