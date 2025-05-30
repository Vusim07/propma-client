import React, { useEffect } from 'react';
import EmailDetail from '@/components/agent/inbox/EmailDetail';
import EmailList from '@/components/agent/inbox/EmailList';
import InboxHeader from '@/components/agent/inbox/InboxHeader';
import { usePageTitle } from '../../context/PageTitleContext';
import { useInboxStore } from '@/stores/inboxStore';

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

	useEffect(() => {
		setPageTitle('Inbox');
		// Initial fetch of threads and user email
		fetchThreads();
		fetchUserEmailAddress();
	}, [setPageTitle, fetchThreads, fetchUserEmailAddress]);

	// Handle thread selection
	const handleSelectThread = async (threadId: string) => {
		await selectThread(threadId);
	};

	// Handle tab change
	const handleTabChange = (tab: string) => {
		updateFilters({
			status: tab === 'Follow-up' ? 'active' : undefined,
			needsFollowUp: tab === 'Follow-up' ? true : undefined,
		});
	};

	return (
		<div className='flex h-screen bg-gray-50'>
			{/* Main Content */}
			<div className='flex-1 flex'>
				{/* Email List */}
				<div className='w-80 bg-white border-r border-gray-200 flex flex-col'>
					{/* Header */}
					<InboxHeader
						activeTab={filters.needsFollowUp ? 'Follow-up' : 'All'}
						setActiveTab={handleTabChange}
					/>

					{/* Email List */}
					<EmailList
						threads={threads}
						selectedThread={selectedThread}
						onSelectThread={handleSelectThread}
						isLoading={isLoading}
					/>
				</div>

				{/* Email Detail */}
				<EmailDetail thread={selectedThread} message={selectedMessage} />
			</div>
		</div>
	);
};

export default Inbox;
