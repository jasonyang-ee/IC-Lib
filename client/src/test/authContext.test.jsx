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
    verifyAuthMock.mockRejectedValue({ response: { status: 401 } });
  });

  it('verifies auth state on mount without reading or writing localStorage', async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const queryClient = new QueryClient();

    renderAuthProvider(queryClient);

    await waitFor(() => expect(verifyAuthMock).toHaveBeenCalledTimes(1));
    expect(getItemSpy).not.toHaveBeenCalledWith('token');
    expect(setItemSpy).not.toHaveBeenCalledWith('token', expect.anything());
    expect(removeItemSpy).not.toHaveBeenCalledWith('token');
  });

  it('clears cached queries after login without persisting a token in localStorage', async () => {
    const queryClient = new QueryClient();
    const clearSpy = vi.spyOn(queryClient, 'clear');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    loginMock.mockResolvedValue({
      data: {
        user: { id: 'user-1', username: 'tester', role: 'approver', displayName: 'Tester' },
      },
    });

    renderAuthProvider(queryClient);
    fireEvent.click(screen.getByText('login'));

    await waitFor(() => expect(loginMock).toHaveBeenCalledWith({ username: 'tester', password: 'secret' }));
    await waitFor(() => expect(clearSpy).toHaveBeenCalledTimes(2));
    expect(setItemSpy).not.toHaveBeenCalledWith('token', expect.anything());
  });

  it('clears cached queries after logout without removing a local token', async () => {
    const queryClient = new QueryClient();
    const clearSpy = vi.spyOn(queryClient, 'clear');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');

    logoutMock.mockResolvedValue({});

    renderAuthProvider(queryClient);
    fireEvent.click(screen.getByText('logout'));

    await waitFor(() => expect(logoutMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(clearSpy).toHaveBeenCalledTimes(2));
    expect(removeItemSpy).not.toHaveBeenCalledWith('token');
  });
});