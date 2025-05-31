import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface EmailMessageProps {
	sender: string;
	avatar: string;
	content: string;
	timestamp: string;
	isFromUser?: boolean;
}

// Utility to get initials from a name string
const getInitials = (name?: string) => {
	if (!name) return '';
	const parts = name.trim().split(' ');
	if (parts.length === 1) return parts[0][0]?.toUpperCase() || '';
	return (
		(parts[0][0] || '') + (parts[parts.length - 1][0] || '')
	).toUpperCase();
};

const EmailMessage: React.FC<EmailMessageProps> = ({
	sender,
	content,
	timestamp,
	isFromUser = false,
}) => {
	return (
		<div className='mb-6 w-full'>
			<div
				className={`flex items-start gap-3 mb-4 ${
					isFromUser ? 'justify-end' : ''
				}`}
			>
				{!isFromUser && (
					<Avatar className='w-8 h-8 rounded-full bg-blue-100 flex-shrink-0'>
						<AvatarFallback>{getInitials(sender)}</AvatarFallback>
					</Avatar>
				)}
				<div className={`flex-1 min-w-0 ${isFromUser ? 'max-w-[85%]' : ''}`}>
					<div
						className={`rounded-lg p-4 break-words ${
							isFromUser ? 'bg-blue-600 text-white' : 'bg-gray-50'
						}`}
					>
						<p
							className={`text-sm mb-2 ${
								isFromUser ? 'text-white' : 'text-gray-700'
							}`}
						>
							{sender}
						</p>
						<div
							className={`prose text-sm max-w-none break-words ${
								isFromUser ? 'text-white/90' : 'text-gray-600'
							}`}
							dangerouslySetInnerHTML={{ __html: content }}
						/>
						<p
							className={`text-xs mt-2 ${
								isFromUser ? 'text-white/70' : 'text-gray-400'
							}`}
						>
							{timestamp}
						</p>
					</div>
				</div>
				{isFromUser && (
					<Avatar className='w-8 h-8 rounded-full bg-blue-100 flex-shrink-0'>
						<AvatarFallback>{getInitials(sender)}</AvatarFallback>
					</Avatar>
				)}
			</div>
		</div>
	);
};

export default EmailMessage;
