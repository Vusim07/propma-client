import React, { useEffect, useState } from 'react';
import EmailDetail from '@/components/agent/inbox/EmailDetail';
import EmailList from '@/components/agent/inbox/EmailList';
import InboxHeader from '@/components/agent/inbox/InboxHeader';
import { usePageTitle } from '../../context/PageTitleContext';

interface Email {
	id: string;
	sender: string;
	email: string;
	subject: string;
	preview: string;
	time: string;
	isUnread: boolean;
	hasAttachment: boolean;
	avatar: string;
	leadSource?: string;
	needsFollowUp?: boolean;
}

// Mock data - in production this will come from Supabase
const mockEmails: Email[] = [
	{
		id: '1',
		sender: 'Thabo Mthembu',
		email: 'thabo.mthembu@gmail.com',
		subject: 'Rental Enquiry for 72 The Williams',
		preview:
			"Hi, Is this apartment still available. I'm interested in viewing it on Friday...",
		time: '6m ago',
		isUnread: false,
		hasAttachment: false,
		avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Thabo',
		leadSource: 'Property24',
		needsFollowUp: true,
	},
	{
		id: '2',
		sender: 'Sarah Johnson',
		email: 'sarah.j@outlook.com',
		subject: 'Viewing Request - 2 Bed Apartment Sandton',
		preview:
			'Good morning, I saw your listing and would like to schedule a viewing...',
		time: '15m ago',
		isUnread: true,
		hasAttachment: false,
		avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
		leadSource: 'PrivateProperty',
		needsFollowUp: false,
	},
	{
		id: '3',
		sender: '[AI Suggestion]',
		email: 'system@ai.com',
		subject: 'Follow-up Required: Mike Peters',
		preview:
			'AI detected potential lead going cold. Last contact 3 days ago...',
		time: '20m ago',
		isUnread: true,
		hasAttachment: false,
		avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AI',
		needsFollowUp: true,
	},
	{
		id: '4',
		sender: 'David Smith',
		email: 'david.smith123@gmail.com',
		subject: 'Re: Bachelor Flat Inquiry - Rosebank',
		preview:
			'Thanks for the quick response. When can I come view the property?',
		time: '30m ago',
		isUnread: true,
		hasAttachment: false,
		avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David',
		leadSource: 'Gumtree',
		needsFollowUp: true,
	},
	{
		id: '5',
		sender: 'Lisa Chen',
		email: 'lisa.chen@yahoo.com',
		subject: 'Rental Application - 3 Bed House Randburg',
		preview:
			"Hi, I'm interested in renting the house. Please find my documents attached...",
		time: '1hr ago',
		isUnread: false,
		hasAttachment: true,
		avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lisa',
		leadSource: 'Website',
		needsFollowUp: false,
	},
	{
		id: '6',
		sender: 'John Williams',
		email: 'john.w@corporatemail.co.za',
		subject: 'Corporate Rental Inquiry - Multiple Units',
		preview:
			"We're looking for 5 furnished apartments for our relocating employees...",
		time: 'Yesterday',
		isUnread: false,
		hasAttachment: false,
		avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
		leadSource: 'OLX',
		needsFollowUp: false,
	},
];

const Inbox = () => {
	const { setPageTitle } = usePageTitle();

	useEffect(() => {
		setPageTitle('Inbox');
	}, [setPageTitle]);

	const [selectedEmail, setSelectedEmail] = useState<Email | null>(
		mockEmails[0],
	);
	const [activeTab, setActiveTab] = useState('All');

	// Filter emails based on active tab
	const filteredEmails =
		activeTab === 'Follow-up'
			? mockEmails.filter((email) => email.needsFollowUp)
			: mockEmails;

	return (
		<div className='flex h-screen bg-gray-50'>
			{/* Main Content */}
			<div className='flex-1 flex'>
				{/* Email List */}
				<div className='w-80 bg-white border-r border-gray-200 flex flex-col'>
					{/* Header */}
					<InboxHeader activeTab={activeTab} setActiveTab={setActiveTab} />

					{/* Email List */}
					<EmailList
						emails={filteredEmails}
						selectedEmail={selectedEmail}
						onSelectEmail={setSelectedEmail}
					/>
				</div>

				{/* Email Detail */}
				<EmailDetail email={selectedEmail} />
			</div>
		</div>
	);
};

export default Inbox;
