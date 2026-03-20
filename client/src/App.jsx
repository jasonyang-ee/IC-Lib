import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Library from './pages/Library'
import Inventory from './pages/Inventory'
import Projects from './pages/Projects'
import VendorSearch from './pages/VendorSearch'
import Reports from './pages/Reports'
import Audit from './pages/Audit'
import Settings from './pages/Settings'
import UserSettings from './pages/UserSettings'
import ECO from './pages/ECO'
import FileLibrary from './pages/FileLibrary'

// Reviewer users land on ECO page (if enabled), others on Dashboard
const DefaultPage = ({ ecoEnabled }) => {
  const { hasRole } = useAuth();
  if (hasRole('reviewer') && ecoEnabled) {
    return <Navigate to="/eco" replace />;
  }
  return <Dashboard />;
};

function App() {
  // Check if ECO feature is enabled from environment variable
  const ecoEnabled = import.meta.env.VITE_CONFIG_ECO === 'true';
  // Roles that have full navigation access (everything except reviewer)
  const fullAccessRoles = ['read-only', 'read-write', 'approver', 'admin'];
  // Roles that include reviewer (for ECO and User Settings)
  const ecoAndSettingsRoles = ['read-only', 'reviewer', 'read-write', 'approver', 'admin'];

  return (
    <AuthProvider>
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<Login />} />

        {/* Protected routes - require authentication */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DefaultPage ecoEnabled={ecoEnabled} />} />
          <Route path="library" element={<Library />} />
          <Route path="file-library" element={<ProtectedRoute allowedRoles={fullAccessRoles}><FileLibrary /></ProtectedRoute>} />
          <Route path="inventory" element={<ProtectedRoute allowedRoles={fullAccessRoles}><Inventory /></ProtectedRoute>} />
          <Route path="projects" element={<ProtectedRoute allowedRoles={fullAccessRoles}><Projects /></ProtectedRoute>} />
          <Route path="vendor-search" element={<ProtectedRoute allowedRoles={fullAccessRoles}><VendorSearch /></ProtectedRoute>} />
          <Route path="reports" element={<ProtectedRoute allowedRoles={fullAccessRoles}><Reports /></ProtectedRoute>} />
          <Route path="audit" element={<ProtectedRoute allowedRoles={fullAccessRoles}><Audit /></ProtectedRoute>} />

          {/* ECO route - only if feature is enabled, includes reviewer */}
          {ecoEnabled && <Route path="eco" element={<ProtectedRoute allowedRoles={ecoAndSettingsRoles}><ECO /></ProtectedRoute>} />}

          {/* User Settings - includes reviewer */}
          <Route path="user-settings" element={<ProtectedRoute allowedRoles={ecoAndSettingsRoles}><UserSettings /></ProtectedRoute>} />

          {/* Admin Settings - admin only */}
          <Route
            path="admin-settings"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Settings />
              </ProtectedRoute>
            }
          />

          {/* Legacy route redirect */}
          <Route path="settings" element={<Navigate to="/admin-settings" replace />} />
        </Route>

        {/* Catch all - redirect to dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App

