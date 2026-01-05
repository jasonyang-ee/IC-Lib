import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
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

function App() {
  // Check if ECO feature is enabled from environment variable
  const ecoEnabled = import.meta.env.VITE_CONFIG_ECO === 'true';
  
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
          <Route index element={<Dashboard />} />
          <Route path="library" element={<Library />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="projects" element={<Projects />} />
          <Route path="vendor-search" element={<VendorSearch />} />
          <Route path="reports" element={<Reports />} />
          <Route path="audit" element={<Audit />} />
          
          {/* ECO route - only if feature is enabled */}
          {ecoEnabled && <Route path="eco" element={<ECO />} />}
          
          {/* User Settings - available to all authenticated users */}
          <Route path="user-settings" element={<UserSettings />} />
          
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

