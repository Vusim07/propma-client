import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
	Home,
	FileText,
	Calendar,
	LogOut,
	User,
	Workflow,
	Home as HomeIcon,
} from 'lucide-react';
import Button from '../ui/Button';

const AgentLayout: React.FC = () => {
	const { user, logout } = useAuthStore();
	const navigate = useNavigate();

	const handleLogout = async () => {
		await logout();
		navigate('/login');
	};

	const navItems = [
		{ to: '/agent', icon: <Home size={20} />, label: 'Dashboard' },
		{
			to: '/agent/properties',
			icon: <HomeIcon size={20} />,
			label: 'Properties',
		},
		{
			to: '/agent/applications',
			icon: <FileText size={20} />,
			label: 'Applications',
		},
		{
			to: '/agent/appointments',
			icon: <Calendar size={20} />,
			label: 'Appointments',
		},
		{
			to: '/agent/workflows',
			icon: <Workflow size={20} />,
			label: 'Workflows',
		},
	];

	return (
		<div className='min-h-screen bg-gray-100 flex'>
			{/* Sidebar */}
			<div className='w-64 bg-white shadow-md'>
				<div className='p-6 flex items-center space-x-3'>
					<img
						src='/assets/amara-logo-black.svg'
						alt='Amara Logo'
						className='h-4 w-auto'
					/>
				</div>

				<nav className='mt-6'>
					<ul>
						{navItems.map((item) => (
							<li key={item.to}>
								<NavLink
									to={item.to}
									end={item.to === '/agent'}
									className={({ isActive }) =>
										`flex items-center px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-700 ${
											isActive
												? 'bg-blue-50 text-blue-700 border-r-4 border-blue-700'
												: ''
										}`
									}
								>
									<span className='mr-3'>{item.icon}</span>
									{item.label}
								</NavLink>
							</li>
						))}
					</ul>
				</nav>
			</div>

			{/* Main Content */}
			<div className='flex-1 flex flex-col'>
				{/* Header */}
				<header className='bg-white shadow-sm'>
					<div className='px-6 py-4 flex items-center justify-between'>
						<h1 className='text-xl font-semibold text-gray-800'>
							{user?.role === 'agent' ? 'Agent Portal' : 'Landlord Portal'}
						</h1>
						<div className='flex items-center space-x-4'>
							<div className='flex items-center space-x-2'>
								<div className='bg-blue-100 p-2 rounded-full'>
									<User size={20} className='text-blue-700' />
								</div>
								<span className='text-sm font-medium'>{user?.email}</span>
							</div>
							<Button
								variant='outline'
								size='sm'
								onClick={handleLogout}
								className='flex items-center'
							>
								<LogOut size={16} className='mr-1' />
								Logout
							</Button>
						</div>
					</div>
				</header>

				{/* Page Content */}
				<main className='flex-1 p-6 overflow-auto'>
					<Outlet />
				</main>
			</div>
		</div>
	);
};

export default AgentLayout;
