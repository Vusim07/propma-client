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
		<div className='p-4 border-b border-gray-200 flex flex-col gap-4'>
			{/* Email address section - Now at the top */}
			<div
				className='flex items-center gap-2 text-sm text-gray-600 group relative w-full'
				onMouseEnter={() => setIsHovering(true)}
				onMouseLeave={() => setIsHovering(false)}
			>
				<div className='flex-1 min-w-0'>
					{' '}
					{/* min-w-0 allows truncation to work */}
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
				{userEmailAddress && isHovering && (
					<Button
						variant='ghost'
						size='icon'
						className='h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity'
						onClick={handleCopyEmail}
					>
						{copied ? (
							<Check className='h-3 w-3 text-green-500' />
						) : (
							<Copy className='h-3 w-3' />
						)}
					</Button>
				)}
			</div>

			{/* Tabs and Action buttons section - Now at the bottom */}
			<div className='flex flex-col gap-2'>
				{/* Tabs */}
				<div className='flex gap-1'>
					{tabs.map((tab) => (
						<Button
							key={tab}
							variant={activeTab === tab ? 'default' : 'ghost'}
							size='sm'
							onClick={() => setActiveTab(tab)}
							className={cn(
								'flex-1',
								activeTab === tab
									? 'bg-gray-100 text-gray-900 hover:bg-gray-200'
									: '',
							)}
						>
							{tab}
						</Button>
					))}
				</div>

				{/* Action buttons */}
				<div className='flex items-center gap-2 justify-end'>
					<Button variant='ghost' size='icon' className='h-8 w-8'>
						<Filter className='h-4 w-4' />
					</Button>
					<Button variant='ghost' size='icon' className='h-8 w-8'>
						<Search className='h-4 w-4' />
					</Button>
					<Button size='icon' className='h-8 w-8 bg-blue-600 hover:bg-blue-700'>
						<Plus className='h-4 w-4' />
					</Button>
				</div>
			</div>
		</div>
	);
};

export default InboxHeader;
