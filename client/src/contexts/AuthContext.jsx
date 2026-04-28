import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';

const AuthContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if the server-issued auth cookie is still valid on app load.
  const verifyAuth = useCallback(async () => {
    try {
      const response = await api.verifyAuth();
      setUser(response.data.user);
      setIsAuthenticated(true);
    } catch (error) {
      if (error.response?.status !== 401) {
        console.error('Auth verification failed:', error);
      }
      queryClient.clear();
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, [queryClient]);

  useEffect(() => {
    verifyAuth();
  }, [verifyAuth]);

  const login = async (username, password) => {
    try {
      const response = await api.login({ username, password });
      const { user } = response.data;
      
      queryClient.clear();
      setUser(user);
      setIsAuthenticated(true);
      
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Login failed';
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      queryClient.clear();
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const hasRole = (...roles) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const isAdmin = () => hasRole('admin');
  const canWrite = () => hasRole('lab', 'read-write', 'approver', 'admin');
  const canApprove = () => hasRole('reviewer', 'approver', 'admin');
  const canRead = () => hasRole('read-only', 'reviewer', 'lab', 'read-write', 'approver', 'admin');

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    verifyAuth,
    hasRole,
    isAdmin,
    canWrite,
    canApprove,
    canRead
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
