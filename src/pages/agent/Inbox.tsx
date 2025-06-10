import React, { useEffect, useState } from 'react';
import EmailDetail from '@/components/agent/inbox/EmailDetail';
import EmailList from '@/components/agent/inbox/EmailList';
import InboxHeader from '@/components/agent/inbox/InboxHeader';
import { usePageTitle } from '../../context/PageTitleContext';
import { useInboxStore } from '@/stores/inboxStore';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Flag, Star } from 'lucide-react';

const Inbox = () => {
	const { setPageTitle } = usePageTitle();
	const {
		threads,
		selectedThread,
		selectedMessage,
		filters,
		isLoading,
		fetchThreads,
		selectThread,
		updateFilters,
		fetchUserEmailAddress,
	} = useInboxStore();

	// State to manage mobile view
	const [showList, setShowList] = useState(true);

	useEffect(() => {
		setPageTitle('Inbox');
		fetchThreads();
		fetchUserEmailAddress();
	}, [setPageTitle, fetchThreads, fetchUserEmailAddress]);

	// Handle thread selection with mobile view toggle
	const handleSelectThread = async (threadId: string) => {
		await selectThread(threadId);
		setShowList(false);
	};

	const handleBackToList = () => {
		setShowList(true);
	};

	// Handle tab change
	const handleTabChange = (tab: string) => {
		updateFilters({
			status: tab === 'Follow-up' ? 'active' : undefined,
			needsFollowUp: tab === 'Follow-up' ? true : undefined,
		});
	};

	return (
		<div>
			<div className='flex flex-col bg-white md:flex-row w-full '>
				{/* Email List - Full width on mobile, sidebar on desktop */}
				<div
					className={`${
						showList ? 'flex' : 'hidden'
					} md:flex w-full md:w-[400px] bg-white border-r border-gray-200 flex-col h-full min-h-0`}
				>
					<InboxHeader
						activeTab={filters.needsFollowUp ? 'Follow-up' : 'All'}
						setActiveTab={handleTabChange}
					/>
					<div className='flex-1 overflow-y-auto'>
						<EmailList
							threads={threads}
							selectedThread={selectedThread}
							onSelectThread={handleSelectThread}
							isLoading={isLoading}
						/>
					</div>
				</div>

				{/* Email Detail - Full width on mobile, main content on desktop */}
				<div
					className={`${
						showList ? 'hidden' : 'flex'
					} md:flex flex-1 flex-col bg-white h-full min-h-0`}
				>
					{/* Mobile back button */}
					{selectedThread && (
						<div className='md:hidden flex items-center gap-4 p-4 border-b border-gray-200 overflow-x-hidden'>
							<button
								onClick={handleBackToList}
								className='flex items-center text-gray-600 hover:text-gray-900'
							>
								<ChevronLeft className='h-5 w-5 mr-1 flex-shrink-0' />
								<span className='text-sm'>Back</span>
							</button>
							<div className='flex-1 min-w-0' />
							<Button
								variant='ghost'
								size='icon'
								className='h-9 w-9 flex-shrink-0'
							>
								<Star className='h-[18px] w-[18px]' />
							</Button>
							<Button
								variant='ghost'
								size='icon'
								className='h-9 w-9 flex-shrink-0'
							>
								<Flag className='h-[18px] w-[18px]' />
							</Button>
						</div>
					)}

					<EmailDetail thread={selectedThread} message={selectedMessage} />
				</div>
			</div>
		</div>
	);
};

export default Inbox;
