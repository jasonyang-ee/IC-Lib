import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProtectedRoute from '../components/ProtectedRoute';

const useAuthMock = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

const renderProtectedRoute = (authValue, routePath = '/inventory', allowedRoles = ['admin']) => {
  useAuthMock.mockReturnValue(authValue);

  return render(
    <MemoryRouter initialEntries={[routePath]}>
      <Routes>
        <Route
          path="/inventory"
          element={(
            <ProtectedRoute allowedRoles={allowedRoles}>
              <div>Protected Content</div>
            </ProtectedRoute>
          )}
        />
        <Route path="/login" element={<div>Login Screen</div>} />
      </Routes>
    </MemoryRouter>,
  );
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  it('redirects unauthenticated users to login', () => {
    renderProtectedRoute({ isAuthenticated: false, user: null, loading: false });

    expect(screen.getByText('Login Screen')).toBeInTheDocument();
  });

  it('shows an access denied message when role requirements are not met', () => {
    renderProtectedRoute({
      isAuthenticated: true,
      user: { role: 'read-write' },
      loading: false,
    });

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText(/Required role: admin/)).toBeInTheDocument();
  });

  it('renders protected content for allowed roles', () => {
    renderProtectedRoute({
      isAuthenticated: true,
      user: { role: 'admin' },
      loading: false,
    });

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});