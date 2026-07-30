import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAllUsersMock = vi.fn();
const deleteUserMock = vi.fn();
const updateUserMock = vi.fn();
const showSuccessMock = vi.fn();
const showErrorMock = vi.fn();

vi.mock('../utils/api', () => ({
  api: {
    getAllUsers: (...args) => getAllUsersMock(...args),
    deleteUser: (...args) => deleteUserMock(...args),
    updateUser: (...args) => updateUserMock(...args),
  },
}));

vi.mock('../contexts/NotificationContext', () => ({
  useNotification: () => ({
    showSuccess: showSuccessMock,
    showError: showErrorMock,
  }),
}));

import UserManagement from '../components/settings/UserManagement';

const renderComponent = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <UserManagement />
    </QueryClientProvider>,
  );
};

describe('UserManagement', () => {
  beforeEach(() => {
    getAllUsersMock.mockReset();
    deleteUserMock.mockReset();
    updateUserMock.mockReset();
    showSuccessMock.mockReset();
    showErrorMock.mockReset();

    getAllUsersMock.mockResolvedValue({
      data: [
        {
          id: 'user-1',
          username: 'test-user',
          role: 'read-write',
          is_active: true,
          last_login: null,
          created_at: '2024-01-01T00:00:00.000Z',
        },
      ],
    });

    deleteUserMock.mockResolvedValue({ data: { success: true } });
    updateUserMock.mockResolvedValue({ data: { success: true } });
  });

  it("labels SSO users and allows local role and active edits without password controls", async () => {
    getAllUsersMock.mockResolvedValueOnce({
      data: [
        {
          id: 'oidc-user',
          username: 'sso.user',
          role: 'read-only',
          is_active: true,
          auth_provider: 'oidc',
          last_login: null,
          created_at: '2024-01-01T00:00:00.000Z',
        },
      ],
    });

    renderComponent();

    expect(await screen.findByText('SSO')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getByText(/identity-provider role or group claims do not restore access/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Leave blank to keep current password')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'approver' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Account is active' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update User' }));

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith('oidc-user', {
        username: 'sso.user',
        role: 'approver',
        is_active: false,
      });
    });
  });

  it('deactivate confirmation retains the user row', async () => {
    renderComponent();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('heading', { name: 'Edit User' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate User' }));
    expect(screen.getByRole('heading', { name: 'Deactivate User' })).toBeInTheDocument();
    expect(screen.getByText(/retains the user and audit history/i)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Deactivate User' })[1]);

    await waitFor(() => {
      expect(deleteUserMock).toHaveBeenCalledWith('user-1');
      expect(screen.queryByRole('heading', { name: 'Edit User' })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Deactivate User' })).not.toBeInTheDocument();
      expect(showSuccessMock).toHaveBeenCalledWith('User deactivated successfully!');
    });

    expect(screen.getByText('test-user')).toBeInTheDocument();
  });

  it('makes an already inactive account explicit without another deactivate action', async () => {
    getAllUsersMock.mockResolvedValueOnce({
      data: [
        {
          id: 'inactive-user',
          username: 'inactive.user',
          role: 'read-only',
          is_active: false,
          auth_provider: 'local',
          last_login: null,
          created_at: '2024-01-01T00:00:00.000Z',
        },
      ],
    });

    renderComponent();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));

    expect(screen.queryByRole('button', { name: 'Deactivate User' })).not.toBeInTheDocument();
    expect(screen.getByText('Account is already inactive.')).toBeInTheDocument();
  });

  it('offers the lab role in the create-user form', async () => {
    renderComponent();

    fireEvent.click(await screen.findByRole('button', { name: 'Create User' }));

    expect(screen.getByRole('option', { name: 'Lab' })).toBeInTheDocument();
  });
});
