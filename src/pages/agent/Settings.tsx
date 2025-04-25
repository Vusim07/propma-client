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
import { User, CreditCard, Plug } from 'lucide-react';
import CalendarSettings from './CalendarSettings';
import SubscriptionPage from './SubscriptionPage';
import AgentProfileForm from '../../components/agent/AgentProfileForm';
import InboxIntegration from '../../components/agent/InboxIntegration';

const Settings: React.FC = () => {
	const { setPageTitle } = usePageTitle();
	const [activeTab, setActiveTab] = useState('profile');

	React.useEffect(() => {
		setPageTitle('Settings');
	}, [setPageTitle]);

	return (
		<div>
			<div className='mb-6'>
				<p className='text-gray-600 mt-1'>
					Manage your account settings and preferences
				</p>
			</div>

			<Tabs
				defaultValue='profile'
				value={activeTab}
				onValueChange={setActiveTab}
				className='w-full'
			>
				<TabsList className='grid w-full grid-cols-3 mb-8'>
					<TabsTrigger value='profile' className='flex items-center'>
						<User className='h-4 w-4 mr-2' />
						<span>Profile</span>
					</TabsTrigger>
					<TabsTrigger value='billing' className='flex items-center'>
						<CreditCard className='h-4 w-4 mr-2' />
						<span>Billing</span>
					</TabsTrigger>
					<TabsTrigger value='integrations' className='flex items-center'>
						<Plug className='h-4 w-4 mr-2' />
						<span>Integrations</span>
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
							<SubscriptionPage />
						</CardContent>
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
