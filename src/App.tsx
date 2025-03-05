import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import AuthLayout from './components/layout/AuthLayout';

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

// Layout Components
import TenantLayout from './components/layout/TenantLayout';
import AgentLayout from './components/layout/AgentLayout';
import Spinner from './components/ui/Spinner';
import { Toaster } from './components/ui/Toaster';

// Protected Route Component
const ProtectedRoute = ({ 
  children, 
  allowedRoles,
}: { 
  children: React.ReactNode, 
  allowedRoles: string[] 
}) => {
  const { user, isLoading } = useAuthStore();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }
  
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

function App() {
  const { checkAuth, isLoading } = useAuthStore();
  
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }
  
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={
          <AuthLayout title="Sign in to your account">
            <Login />
          </AuthLayout>
        } />
        <Route path="/register" element={
          <AuthLayout title="Create your account" subtitle="Choose your role to get started">
            <Register />
          </AuthLayout>
        } />
        
        {/* Tenant Routes */}
        <Route path="/tenant" element={
          <ProtectedRoute allowedRoles={['tenant']}>
            <TenantLayout />
          </ProtectedRoute>
        }>
          <Route index element={<TenantDashboard />} />
          <Route path="documents" element={<DocumentUpload />} />
          <Route path="screening" element={<ScreeningResults />} />
          <Route path="appointments" element={<AppointmentScheduling />} />
        </Route>
        
        {/* Agent/Landlord Routes */}
        <Route path="/agent" element={
          <ProtectedRoute allowedRoles={['agent', 'landlord']}>
            <AgentLayout />
          </ProtectedRoute>
        }>
          <Route index element={<AgentDashboard />} />
          <Route path="properties" element={<PropertyManagement />} />
          <Route path="properties/new" element={<PropertyForm />} />
          <Route path="properties/:id" element={<PropertyDetail />} />
          <Route path="properties/:id/edit" element={<PropertyForm />} />
          <Route path="applications" element={<ReviewApplications />} />
          <Route path="screening/:id" element={<DetailedScreening />} />
          <Route path="appointments" element={<ManageAppointments />} />
          <Route path="workflows" element={<WorkflowManagement />} />
        </Route>
        
        {/* Redirect root to appropriate dashboard based on role */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* Catch all - redirect to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      
      {/* Toast notifications */}
      <Toaster />
    </Router>
  );
}

export default App;