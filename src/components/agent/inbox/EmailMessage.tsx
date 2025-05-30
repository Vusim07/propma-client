import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
	avatar,
	content,
	timestamp,
	isFromUser = false,
}) => {
	return (
		<div className='mb-6'>
			<div
				className={`flex items-start gap-3 mb-4 ${
					isFromUser ? 'justify-end' : ''
				}`}
			>
				{!isFromUser && (
					<Avatar className='w-10 h-10 rounded-full bg-blue-100'>
						<AvatarFallback>{getInitials(sender)}</AvatarFallback>
					</Avatar>
				)}
				<div className={`flex-1 ${isFromUser ? 'max-w-lg' : ''}`}>
					<div
						className={`rounded-lg p-4 ${
							isFromUser ? 'bg-blue-600 text-white' : 'bg-gray-50'
						}`}
					>
						<p
							className={`text-sm mb-2 ${
								isFromUser ? 'text-white' : 'text-gray-700'
							}`}
						>
							{content}
						</p>
						<p
							className={`text-xs ${
								isFromUser ? 'opacity-75' : 'text-gray-500'
							}`}
						>
							{timestamp}
						</p>
					</div>
				</div>
				{isFromUser && (
					<Avatar className='w-8 h-8'>
						<AvatarImage src={avatar} alt={sender} />
						<AvatarFallback>{sender.charAt(0)}</AvatarFallback>
					</Avatar>
				)}
			</div>
		</div>
	);
};

export default EmailMessage;
