import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getProfile: vi.fn(), getNotificationPreferences: vi.fn(), showError: vi.fn() }));
vi.mock('../utils/api', () => ({ api: mocks }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { username: 'tester', role: 'admin' } }) }));
vi.mock('../contexts/NotificationContext', () => ({ useNotification: () => ({ showError: mocks.showError, showSuccess: vi.fn() }) }));
import UserSettings from '../pages/UserSettings';

it('blocks blank profile edits after a load failure and recovers through Retry', async () => {
  mocks.getProfile.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ data: { displayName: 'Saved Name', authProvider: 'oidc' } });
  mocks.getNotificationPreferences.mockResolvedValue({ data: {} });
  render(<QueryClientProvider client={new QueryClient()}><UserSettings /></QueryClientProvider>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load your settings');
  expect(screen.queryByRole('button', { name: 'Save Profile' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Retry'));
  expect(await screen.findByDisplayValue('Saved Name')).toBeInTheDocument();
  expect(screen.queryByPlaceholderText('Enter your current password')).not.toBeInTheDocument();
});
