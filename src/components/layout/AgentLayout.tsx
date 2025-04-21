import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { usePageTitle } from '../../context/PageTitleContext';
import {
	Home,
	FileText,
	Calendar,
	LogOut,
	User,
	Workflow,
	Home as HomeIcon,
	ChevronLeft,
	ChevronRight,
	Menu,
	CreditCard,
} from 'lucide-react';
import Button from '../ui/Button';

const AgentLayout: React.FC = () => {
	const { user, logout } = useAuthStore();
	const { pageTitle } = usePageTitle();
	const navigate = useNavigate();
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

	const handleLogout = async () => {
		await logout();
		navigate('/login');
	};

	const toggleSidebar = () => {
		setIsCollapsed(!isCollapsed);
	};

	const toggleMobileMenu = () => {
		setIsMobileMenuOpen(!isMobileMenuOpen);
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
			label: 'Prospects',
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
		{
			to: '/agent/subscription',
			icon: <CreditCard size={20} />,
			label: 'Subscription',
		},
	];

	return (
		<div className='min-h-screen bg-gray-100 flex flex-col md:flex-row'>
			{/* Mobile Menu Button - Made sticky */}
			<div className='md:hidden bg-white p-4 flex justify-between items-center shadow-md sticky top-0 z-40'>
				<img
					src='/assets/amara-logo-black.svg'
					alt='Amara Logo'
					className='h-4 w-auto'
				/>
				<Button variant='outline' size='sm' onClick={toggleMobileMenu}>
					<Menu size={24} />
				</Button>
			</div>

			{/* Sidebar - Fixed on both mobile and desktop */}
			<div
				className={`fixed inset-y-0 left-0 z-40 transform bg-white shadow-md transition-all duration-300 
				${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
				md:translate-x-0 ${isCollapsed ? 'md:w-20' : 'md:w-64'}`}
			>
				<div
					className={`p-6 flex ${
						isCollapsed ? 'justify-center' : 'items-center space-x-3'
					}`}
				>
					{isCollapsed ? (
						<img
							src='/assets/arda-icon-black-alt.svg'
							alt='Amara Icon'
							className='h-6 w-auto'
						/>
					) : (
						<img
							src='/assets/amara-logo-black.svg'
							alt='Amara Logo'
							className='h-6 w-auto'
						/>
					)}
				</div>

				<nav className='mt-6'>
					<div className='flex flex-col items-center space-y-2 py-8 md:hidden'>
						<div className='bg-blue-100 p-2 rounded-full'>
							<User size={20} className='text-blue-700' />
						</div>
						<span className='text-sm font-medium'>{user?.email}</span>
					</div>
					<ul>
						{navItems.map((item) => (
							<li key={item.to}>
								<NavLink
									to={item.to}
									end={item.to === '/agent'}
									className={({ isActive }) =>
										`flex items-center ${
											isCollapsed ? 'justify-center' : 'px-6'
										} py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-700 ${
											isActive
												? 'bg-blue-50 text-blue-700 border-r-4 border-blue-700'
												: ''
										}`
									}
								>
									<span className={isCollapsed ? '' : 'mr-3'}>{item.icon}</span>
									{!isCollapsed && item.label}
								</NavLink>
							</li>
						))}
					</ul>

					<div className='flex flex-col py-12 items-center md:hidden'>
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
				</nav>

				{/* Toggle button - only visible on desktop */}
				<button
					onClick={toggleSidebar}
					className='hidden md:flex items-center justify-center absolute -right-3 top-20 bg-white rounded-full w-6 h-6 shadow-md border border-gray-200'
				>
					{isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
				</button>

				{/* Mobile close button - only visible on mobile when menu is open */}
				<button
					onClick={toggleMobileMenu}
					className='md:hidden absolute top-4 right-4 text-gray-500'
					aria-label='Close Menu'
				>
					<ChevronLeft size={24} />
				</button>
			</div>

			{/* Main Content - Add left margin to account for fixed sidebar */}
			<div
				className='flex-1 flex flex-col md:ml-[256px] transition-all duration-300'
				style={{ marginLeft: isCollapsed ? '80px' : '' }}
			>
				{/* Header - Made sticky */}
				<header className='bg-white shadow-sm hidden md:block sticky top-0 z-40'>
					<div className='px-6 py-4 flex items-center justify-between'>
						<h1 className='text-xl font-semibold text-gray-800'>{pageTitle}</h1>
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

			{/* Mobile overlay when menu is open */}
			{isMobileMenuOpen && (
				<div
					className='md:hidden fixed inset-0 bg-black bg-opacity-50 z-30'
					onClick={toggleMobileMenu}
				/>
			)}
		</div>
	);
};

export default AgentLayout;
