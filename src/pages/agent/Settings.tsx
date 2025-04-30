import React, { useState } from 'react';
import { usePageTitle } from '../../context/PageTitleContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/Card';
import CalendarSettings from './CalendarSettings';
import SubscriptionPage from './SubscriptionPage';
import AgentProfileForm from '../../components/agent/AgentProfileForm';
import InboxIntegration from '../../components/agent/InboxIntegration';
import Teams from './Teams';

const Settings: React.FC = () => {
	const { setPageTitle } = usePageTitle();
	const [activeTab, setActiveTab] = useState('profile');

	React.useEffect(() => {
		setPageTitle('Settings');
	}, [setPageTitle]);

	return (
		<div>
			<Tabs
				defaultValue='profile'
				value={activeTab}
				onValueChange={setActiveTab}
				className='w-full'
			>
				<TabsList className='flex w-full bg-black rounded-lg p-0'>
					<TabsTrigger
						value='profile'
						className={`flex-1 px-4 py-2 text-center text-base font-semibold transition-colors duration-150 rounded-lg
							${
								activeTab === 'profile'
									? 'bg-white text-black shadow-none'
									: 'bg-transparent text-gray-400'
							}`}
					>
						Profile
					</TabsTrigger>
					<TabsTrigger
						value='billing'
						className={`flex-1 px-4 py-2 text-center text-base font-semibold transition-colors duration-150 rounded-lg
							${
								activeTab === 'billing'
									? 'bg-white text-black shadow-none'
									: 'bg-transparent text-gray-400'
							}`}
					>
						Billing
					</TabsTrigger>
					<TabsTrigger
						value='team'
						className={`flex-1 px-4 py-2 text-center text-base font-semibold transition-colors duration-150 rounded-lg
							${
								activeTab === 'team'
									? 'bg-white text-black shadow-none'
									: 'bg-transparent text-gray-400'
							}`}
					>
						Team
					</TabsTrigger>
					<TabsTrigger
						value='integrations'
						className={`flex-1 px-4 py-2 text-center text-base font-semibold transition-colors duration-150 rounded-lg
							${
								activeTab === 'integrations'
									? 'bg-white text-black shadow-none'
									: 'bg-transparent text-gray-400'
							}`}
					>
						Integrations
					</TabsTrigger>
				</TabsList>

				<TabsContent value='profile'>
					<Card>
						<CardHeader>
							<CardTitle>Personal Information</CardTitle>
							<CardDescription>
								Update your personal and company information
							</CardDescription>
						</CardHeader>
						<CardContent>
							<AgentProfileForm />
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value='billing'>
					<Card>
						<CardHeader>
							<CardTitle>Billing Information</CardTitle>
							<CardDescription>
								Manage your billing details and subscription
							</CardDescription>
						</CardHeader>
						<CardContent>
							{activeTab === 'billing' && <SubscriptionPage />}
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value='team'>
					<Card>
						<CardHeader>
							<CardTitle>Your Team</CardTitle>
							<CardDescription>
								Manage your team members and their roles
							</CardDescription>
						</CardHeader>
						<CardContent>{activeTab === 'team' && <Teams />}</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value='integrations'>
					<div className='space-y-4'>
						<CalendarSettings hideTitle={true} />
						<InboxIntegration />
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
};

export default Settings;
