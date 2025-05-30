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
	if (isLoading) {
		return (
			<ScrollArea className='flex-1'>
				<div className='p-4 text-center text-gray-500'>Loading threads...</div>
			</ScrollArea>
		);
	}

	if (threads.length === 0) {
		return (
			<ScrollArea className='flex-1'>
				<div className='p-4 text-center text-gray-500'>No threads found</div>
			</ScrollArea>
		);
	}

	return (
		<ScrollArea className='flex-1'>
			<div className='divide-y divide-gray-100'>
				{threads.map((thread) => {
					const isUnread = thread.status === 'active';
					const needsFollowUp = thread.needs_follow_up;
					const fromName = thread.messages?.[0]?.from_name || '';
					const fromAddress =
						thread.messages?.[0]?.from_address || 'Unknown Sender';

					return (
						<div
							key={thread.id}
							className={`p-4 cursor-pointer hover:bg-gray-50 ${
								selectedThread?.id === thread.id
									? 'bg-blue-50 border-r-2 border-blue-600'
									: ''
							}`}
							onClick={() => onSelectThread(thread.id)}
						>
							<div className='flex items-start gap-3'>
								<Avatar className='w-10 h-10  rounded-full bg-blue-100'>
									<AvatarFallback>
										{getInitials(fromName) ||
											fromAddress.charAt(0).toUpperCase()}
									</AvatarFallback>
								</Avatar>

								<div className='flex-1 min-w-0'>
									<div className='flex items-center justify-between mb-1'>
										<h3
											className={`text-sm font-medium truncate ${
												isUnread ? 'text-gray-900' : 'text-gray-700'
											}`}
										>
											{fromAddress}
										</h3>
										<span className='text-xs text-gray-500 ml-2'>
											{new Date(thread.last_message_at).toLocaleTimeString()}
										</span>
									</div>

									<div className='flex items-center gap-2 mb-1'>
										<p
											className={`text-sm truncate ${
												isUnread ? 'font-medium text-gray-900' : 'text-gray-700'
											}`}
										>
											{thread.subject}
										</p>
									</div>

									<div className='flex items-center gap-2'>
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
