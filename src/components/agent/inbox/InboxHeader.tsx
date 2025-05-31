/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Filter, Search, Plus, Copy, Check } from 'lucide-react';
import { useInboxStore } from '@/stores/inboxStore';
import { cn } from '@/lib/utils';
import { showToast } from '@/utils/toast';

interface InboxHeaderProps {
	activeTab: string;
	setActiveTab: (tab: string) => void;
}

const InboxHeader: React.FC<InboxHeaderProps> = ({
	activeTab,
	setActiveTab,
}) => {
	const { userEmailAddress } = useInboxStore();
	const [isHovering, setIsHovering] = useState(false);
	const [copied, setCopied] = useState(false);
	const tabs = ['All', 'Follow-up'];

	const handleCopyEmail = () => {
		if (!userEmailAddress) return;

		navigator.clipboard.writeText(userEmailAddress);
		setCopied(true);
		showToast.success('Email address copied to clipboard');

		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className='p-4 border-b border-gray-200 flex flex-col gap-4 overflow-hidden'>
			{/* Email address section */}
			<div
				className='flex items-center gap-2 text-sm text-gray-600 group cursor-pointer w-full'
				onClick={handleCopyEmail}
				onMouseEnter={() => setIsHovering(true)}
				onMouseLeave={() => setIsHovering(false)}
			>
				<div className='flex-1 min-w-0'>
					<span
						className={cn(
							'font-medium block truncate',
							!userEmailAddress && 'text-gray-400 italic',
						)}
						title={userEmailAddress || 'Loading email...'} // Show full email on hover
					>
						{userEmailAddress || 'Loading email...'}
					</span>
				</div>
				<Button
					variant='ghost'
					size='icon'
					className='h-8 w-8 flex-shrink-0'
					onClick={handleCopyEmail}
				>
					{copied ? (
						<Check className='h-4 w-4 text-green-500' />
					) : (
						<Copy className='h-4 w-4' />
					)}
				</Button>
			</div>

			{/* Tabs and actions */}
			<div className='flex items-center justify-between gap-2'>
				<div className='flex space-x-1 overflow-x-auto'>
					{tabs.map((tab) => (
						<Button
							key={tab}
							variant={activeTab === tab ? 'default' : 'ghost'}
							size='sm'
							onClick={() => setActiveTab(tab)}
							className='flex-shrink-0'
						>
							{tab}
						</Button>
					))}
				</div>
				<div className='flex items-center gap-2 flex-shrink-0'>
					<Button size='icon' variant='ghost' className='h-8 w-8'>
						<Search className='h-4 w-4' />
					</Button>
					<Button size='icon' variant='ghost' className='h-8 w-8'>
						<Filter className='h-4 w-4' />
					</Button>
					<Button size='icon' className='h-8 w-8'>
						<Plus className='h-4 w-4' />
					</Button>
				</div>
			</div>
		</div>
	);
};

export default InboxHeader;
