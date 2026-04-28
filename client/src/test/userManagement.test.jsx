import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAllUsersMock = vi.fn();
const deleteUserMock = vi.fn();
const showSuccessMock = vi.fn();
const showErrorMock = vi.fn();

vi.mock('../utils/api', () => ({
  api: {
    getAllUsers: (...args) => getAllUsersMock(...args),
    deleteUser: (...args) => deleteUserMock(...args),
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
  });

  it('closes both delete confirm and edit modal after deleting a user', async () => {
    renderComponent();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('heading', { name: 'Edit User' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete User' }));
    expect(screen.getByRole('heading', { name: 'Delete User' })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete User' })[1]);

    await waitFor(() => {
      expect(deleteUserMock).toHaveBeenCalledWith('user-1');
      expect(screen.queryByRole('heading', { name: 'Edit User' })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Delete User' })).not.toBeInTheDocument();
    });
  });

  it('offers the lab role in the create-user form', async () => {
    renderComponent();

    fireEvent.click(await screen.findByRole('button', { name: 'Create User' }));

    expect(screen.getByRole('option', { name: 'Lab' })).toBeInTheDocument();
  });
});
