import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';

interface ReplyBoxProps {
	onSend?: (message: string) => void;
}

const ReplyBox: React.FC<ReplyBoxProps> = ({ onSend }) => {
	const [message, setMessage] = useState('');

	const handleSend = () => {
		if (message.trim() && onSend) {
			onSend(message);
			setMessage('');
		}
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	return (
		<div className='w-full'>
			<div className='flex items-center gap-2'>
				<Input
					placeholder='Write a message...'
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					onKeyPress={handleKeyPress}
					className='flex-1 min-w-0'
				/>
				<Button
					className='bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0'
					onClick={handleSend}
					disabled={!message.trim()}
				>
					<Send className='h-4 w-4' />
				</Button>
			</div>
		</div>
	);
};

export default ReplyBox;
