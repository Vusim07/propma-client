import React, { useEffect, useState } from 'react';
import {
	BrowserRouter as Router,
	Routes,
	Route,
	Navigate,
	useNavigate,
} from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { PageTitleProvider } from './context/PageTitleContext';
import { Tables } from './services/database.types'; // Add this import

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import AuthCallback from './pages/auth/AuthCallback';
import ProfileCompletion from './pages/auth/ProfileCompletion';
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
import WorkflowManagement from './pages/agent/WorkflowManagement';
import PropertyManagement from './pages/agent/PropertyManagement';
import PropertyDetail from './pages/agent/PropertyDetail';
import PropertyForm from './pages/agent/PropertyForm';
import SubscriptionPage from './pages/agent/SubscriptionPage';
import CalendarSettings from './pages/agent/CalendarSettings';
import Settings from './pages/agent/Settings';
import Teams from './pages/agent/Teams'; // Add this import

// Layout Components
import TenantLayout from './components/layout/TenantLayout';
import AgentLayout from './components/layout/AgentLayout';
import Spinner from './components/ui/Spinner';
import { Toaster } from './components/ui/Toaster';

// Enhanced Protected Route Component with profile completion check
const ProtectedRoute = ({
	children,
	allowedRoles,
}: {
	children: React.ReactNode;
	allowedRoles: string[];
}) => {
	const { user, isLoading } = useAuthStore();
	const [isCheckingAuth, setIsCheckingAuth] = useState(true);
	const navigate = useNavigate();

	useEffect(() => {
		// Extra check to ensure auth state is stable
		const checkAuthState = async () => {
			console.log('ProtectedRoute - Initial user state:', user?.role);

			// Brief delay to ensure auth state is settled
			await new Promise((r) => setTimeout(r, 100));

			const currentUser = useAuthStore.getState().user;
			console.log(
				'ProtectedRoute - After delay, user state:',
				currentUser?.role,
			);

			// Check if profile is complete enough
			if (currentUser && isProfileIncomplete(currentUser)) {
				console.log(
					'User profile is incomplete, redirecting to profile completion',
				);
				navigate('/profile-completion');
				return;
			}

			setIsCheckingAuth(false);
		};

		checkAuthState();
	}, [user, navigate]);

	// Function to check if a profile has minimal required fields
	const isProfileIncomplete = (profile: Tables<'users'>): boolean => {
		// More explicit check to ensure we're only redirecting profiles that are truly incomplete
		const isMissingRequiredFields =
			!profile.first_name || !profile.last_name || !profile.phone;

		console.log('Profile completeness check:', {
			first_name: profile.first_name ? 'present' : 'missing',
			last_name: profile.last_name ? 'present' : 'missing',
			phone: profile.phone ? 'present' : 'missing',
			isIncomplete: isMissingRequiredFields,
		});

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

	// Get current user state directly from store
	const currentUser = useAuthStore.getState().user;
	console.log(
		'ProtectedRoute - Current user check:',
		currentUser?.role,
		'Allowed:',
		allowedRoles,
	);

	if (!currentUser || !allowedRoles.includes(currentUser.role)) {
		console.log('Access denied, redirecting to login');
		return <Navigate to='/login' replace />;
	}

	console.log('Access granted, rendering content');
	return <>{children}</>;
};

function App() {
	const { initialize, loading, isLoading } = useAuthStore();
	const [initializing, setInitializing] = useState(true);

	// Add a new initialization effect that runs only once
	useEffect(() => {
		const initAuth = async () => {
			setInitializing(true);
			try {
				// Call our new initialize method
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

	// Remove or update the existing checkAuth effect
	// since it's redundant with our new initialization

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
						<Route path='workflows' element={<WorkflowManagement />} />
						<Route path='teams' element={<Teams />} />
						<Route path='subscription' element={<SubscriptionPage />} />
						<Route path='settings' element={<Settings />} />
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
