import React from 'react';
import { Button } from '@/components/ui/button';
import { Filter, Search, Plus } from 'lucide-react';

interface InboxHeaderProps {
	activeTab: string;
	setActiveTab: (tab: string) => void;
}

const InboxHeader: React.FC<InboxHeaderProps> = ({
	activeTab,
	setActiveTab,
}) => {
	const tabs = ['All', 'Follow-up'];

	return (
		<div className='p-4 border-b border-gray-200'>
			<div className='flex items-center justify-between mb-4'>
				<div className='flex items-center gap-2'>
					<Button variant='ghost' size='icon'>
						<Filter className='h-4 w-4' />
					</Button>
					<Button variant='ghost' size='icon'>
						<Search className='h-4 w-4' />
					</Button>
					<Button size='icon' className='bg-blue-600 hover:bg-blue-700'>
						<Plus className='h-4 w-4' />
					</Button>
				</div>
			</div>

			{/* Tabs */}
			<div className='flex gap-1'>
				{tabs.map((tab) => (
					<Button
						key={tab}
						variant={activeTab === tab ? 'default' : 'ghost'}
						size='sm'
						onClick={() => setActiveTab(tab)}
						className={
							activeTab === tab
								? 'bg-gray-100 text-gray-900 hover:bg-gray-200'
								: ''
						}
					>
						{tab}
					</Button>
				))}
			</div>
		</div>
	);
};

export default InboxHeader;
