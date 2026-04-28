import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import { useFeatureFlags } from './contexts/FeatureFlagsContext'
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
import {
  ecoAccessRoles,
  fileLibraryAccessRoles,
  fullNavigationRoles,
  getDefaultRouteForRole,
  userSettingsRoles,
} from './utils/accessControl'

const DefaultPage = ({ ecoEnabled }) => {
  const { user } = useAuth();
  const defaultRoute = getDefaultRouteForRole(user?.role, ecoEnabled);

  if (defaultRoute !== '/') {
    return <Navigate to={defaultRoute} replace />;
  }

  return <Dashboard />;
};

function App() {
  const { ecoEnabled, isLoading: featureFlagsLoading } = useFeatureFlags();

  if (featureFlagsLoading) {
    return null;
  }

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
          <Route path="file-library" element={<ProtectedRoute allowedRoles={fileLibraryAccessRoles}><FileLibrary /></ProtectedRoute>} />
          <Route path="inventory" element={<ProtectedRoute allowedRoles={fullNavigationRoles}><Inventory /></ProtectedRoute>} />
          <Route path="projects" element={<ProtectedRoute allowedRoles={fullNavigationRoles}><Projects /></ProtectedRoute>} />
          <Route path="vendor-search" element={<ProtectedRoute allowedRoles={fullNavigationRoles}><VendorSearch /></ProtectedRoute>} />
          <Route path="reports" element={<ProtectedRoute allowedRoles={fullNavigationRoles}><Reports /></ProtectedRoute>} />
          <Route path="audit" element={<ProtectedRoute allowedRoles={fullNavigationRoles}><Audit /></ProtectedRoute>} />

          {ecoEnabled && <Route path="eco" element={<ProtectedRoute allowedRoles={ecoAccessRoles}><ECO /></ProtectedRoute>} />}

          <Route path="user-settings" element={<ProtectedRoute allowedRoles={userSettingsRoles}><UserSettings /></ProtectedRoute>} />

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
