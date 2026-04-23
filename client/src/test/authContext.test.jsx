import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loginMock = vi.fn();
const logoutMock = vi.fn();
const verifyAuthMock = vi.fn();

vi.mock('../utils/api', () => ({
  api: {
    login: (...args) => loginMock(...args),
    logout: (...args) => logoutMock(...args),
    verifyAuth: (...args) => verifyAuthMock(...args),
  },
}));

import { AuthProvider, useAuth } from '../contexts/AuthContext';

const TestConsumer = () => {
  const { login, logout } = useAuth();

  return (
    <div>
      <button onClick={() => login('tester', 'secret')}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
};

const renderAuthProvider = (queryClient) => render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  </QueryClientProvider>,
);

describe('AuthProvider', () => {
  beforeEach(() => {
    loginMock.mockReset();
    logoutMock.mockReset();
    verifyAuthMock.mockReset();
    localStorage.clear();
  });

  it('clears cached queries after login', async () => {
    const queryClient = new QueryClient();
    const clearSpy = vi.spyOn(queryClient, 'clear');

    loginMock.mockResolvedValue({
      data: {
        token: 'token-123',
        user: { id: 'user-1', username: 'tester', role: 'approver', displayName: 'Tester' },
      },
    });

    renderAuthProvider(queryClient);
    fireEvent.click(screen.getByText('login'));

    await waitFor(() => expect(loginMock).toHaveBeenCalledWith({ username: 'tester', password: 'secret' }));
    await waitFor(() => expect(clearSpy).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem('token')).toBe('token-123');
  });

  it('clears cached queries after logout', async () => {
    const queryClient = new QueryClient();
    const clearSpy = vi.spyOn(queryClient, 'clear');

    logoutMock.mockResolvedValue({});

    renderAuthProvider(queryClient);
    localStorage.setItem('token', 'token-123');
    fireEvent.click(screen.getByText('logout'));

    await waitFor(() => expect(logoutMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(clearSpy).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem('token')).toBeNull();
  });
});