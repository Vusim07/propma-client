import React, { useEffect, useState } from 'react';
import {
	BrowserRouter as Router,
	Routes,
	Route,
	Navigate,
	useNavigate,
	useLocation,
} from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { PageTitleProvider } from './context/PageTitleContext';
import { Tables } from './services/database.types'; // Add this import

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import AuthCallback from './pages/auth/AuthCallback';
import ProfileCompletion from './pages/auth/ProfileCompletion';
import PaymentCallback from './pages/auth/PaymentCallback';
import AuthLayout from './components/layout/AuthLayout';

// Add this import
import PropertyApplication from './pages/tenant/PropertyApplication';

// Tenant Pages
import TenantDashboard from './pages/tenant/Dashboard';
import DocumentUpload from './pages/tenant/DocumentUpload';
import ScreeningResults from './pages/tenant/ScreeningResults';
import AppointmentScheduling from './pages/tenant/AppointmentScheduling';

// Agent/Landlord Pages
import AgentDashboard from './pages/agent/Dashboard';
import ReviewApplications from './pages/agent/ReviewApplications';
import DetailedScreening from './pages/agent/DetailedScreening';
import ManageAppointments from './pages/agent/ManageAppointments';
import PropertyManagement from './pages/agent/PropertyManagement';
import PropertyDetail from './pages/agent/PropertyDetail';
import PropertyForm from './pages/agent/PropertyForm';
import SubscriptionPage from './pages/agent/SubscriptionPage';
import CalendarSettings from './pages/agent/CalendarSettings';
import Settings from './pages/agent/Settings';
import Teams from './pages/agent/Teams';
import Inbox from './pages/agent/Inbox';

// Layout Components
import TenantLayout from './components/layout/TenantLayout';
import AgentLayout from './components/layout/AgentLayout';
import Spinner from './components/ui/spinner';
import { Toaster } from './components/ui/toaster';

// Enhanced Protected Route Component with profile completion check
const ProtectedRoute = ({
	children,
	allowedRoles,
}: {
	children: React.ReactNode;
	allowedRoles: string[];
}) => {
	const { user, isLoading, initialize } = useAuthStore();
	const [isCheckingAuth, setIsCheckingAuth] = useState(true);
	const navigate = useNavigate();
	const location = useLocation();

	useEffect(() => {
		const checkAuthState = async () => {
			const searchParams = new URLSearchParams(location.search);
			const isReturningFromPayment =
				searchParams.has('reference') || searchParams.has('trxref');

			if (isReturningFromPayment) {
				await initialize();
				if (window.history.replaceState) {
					window.history.replaceState({}, document.title, location.pathname);
				}
			}

			await new Promise((r) => setTimeout(r, 100));

			const currentUser = useAuthStore.getState().user;
			// const { data } = await import('./services/supabase').then((m) =>
			// 	m.supabase.auth.getSession(),
			// );
			// const sessionUser = data?.session?.user;

			if (currentUser && isProfileIncomplete(currentUser)) {
				navigate('/profile-completion');
				return;
			}

			setIsCheckingAuth(false);
		};

		checkAuthState();
	}, [user, navigate, location.search, location.pathname, initialize]);

	const isProfileIncomplete = (profile: Tables<'users'>): boolean => {
		const isMissingRequiredFields =
			!profile.first_name || !profile.last_name || !profile.phone;
		return isMissingRequiredFields;
	};

	if (isLoading || isCheckingAuth) {
		return (
			<div className='min-h-screen flex items-center justify-center'>
				<Spinner size='lg' />
				<p className='ml-2 text-gray-500'>Verifying access...</p>
			</div>
		);
	}

	const currentUser = useAuthStore.getState().user;

	if (!currentUser || !allowedRoles.includes(currentUser.role)) {
		return <Navigate to='/login' replace />;
	}

	return <>{children}</>;
};

function App() {
	const { initialize, loading, isLoading } = useAuthStore();
	const [initializing, setInitializing] = useState(true);

	useEffect(() => {
		const initAuth = async () => {
			setInitializing(true);
			try {
				const success = await initialize();
				console.log('Auth initialization result:', success);
			} catch (err) {
				console.error('Error initializing auth:', err);
			} finally {
				setInitializing(false);
			}
		};

		initAuth();
	}, [initialize]);

	if (initializing || loading || isLoading) {
		return (
			<div className='min-h-screen flex items-center justify-center'>
				<Spinner size='lg' />
			</div>
		);
	}

	return (
		<Router>
			<PageTitleProvider>
				<Routes>
					{/* Public Routes */}
					<Route
						path='/login'
						element={
							<AuthLayout title='Sign in to your account'>
								<Login />
							</AuthLayout>
						}
					/>
					<Route
						path='/register'
						element={
							<AuthLayout
								title='Create your account'
								subtitle='Choose your role to get started'
							>
								<Register />
							</AuthLayout>
						}
					/>
					<Route path='/auth/callback' element={<AuthCallback />} />
					<Route path='/payment/callback' element={<PaymentCallback />} />
					<Route
						path='/profile-completion'
						element={
							<AuthLayout
								title='Complete Your Profile'
								subtitle='Just a few more details to get started'
							>
								<ProfileCompletion />
							</AuthLayout>
						}
					/>

					{/* Property Application Route - Add this */}
					<Route path='/apply/:token' element={<PropertyApplication />} />

					{/* Tenant Routes */}
					<Route
						path='/tenant'
						element={
							<ProtectedRoute allowedRoles={['tenant']}>
								<TenantLayout />
							</ProtectedRoute>
						}
					>
						<Route index element={<TenantDashboard />} />
						<Route path='documents' element={<DocumentUpload />} />
						<Route path='screening' element={<ScreeningResults />} />
						<Route path='appointments' element={<AppointmentScheduling />} />
					</Route>

					{/* Agent/Landlord Routes */}
					<Route
						path='/agent'
						element={
							<ProtectedRoute allowedRoles={['agent', 'landlord']}>
								<AgentLayout />
							</ProtectedRoute>
						}
					>
						<Route index element={<AgentDashboard />} />
						<Route path='properties' element={<PropertyManagement />} />
						<Route path='properties/new' element={<PropertyForm />} />
						<Route path='properties/:id' element={<PropertyDetail />} />
						<Route path='properties/:id/edit' element={<PropertyForm />} />
						<Route path='applications' element={<ReviewApplications />} />
						<Route path='screening/:id' element={<DetailedScreening />} />
						<Route path='appointments' element={<ManageAppointments />} />
						<Route path='calendar-settings' element={<CalendarSettings />} />

						<Route path='teams' element={<Teams />} />
						<Route path='subscription' element={<SubscriptionPage />} />
						<Route path='settings' element={<Settings />} />
						<Route path='inbox' element={<Inbox />} />
					</Route>

					{/* Redirect root to appropriate dashboard based on role */}
					<Route path='/' element={<Navigate to='/login' replace />} />

					{/* Catch all - redirect to login */}
					<Route path='*' element={<Navigate to='/login' replace />} />
				</Routes>

				{/* Toast notifications */}
				<Toaster />
			</PageTitleProvider>
		</Router>
	);
}

export default App;
