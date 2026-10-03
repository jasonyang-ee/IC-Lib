import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getCategories: vi.fn(), getCategorySpecifications: vi.fn(), deleteCategorySpecification: vi.fn(), showError: vi.fn() }));
vi.mock('../utils/api', () => ({ api: mocks }));
vi.mock('../contexts/NotificationContext', () => ({ useNotification: () => ({ showError: mocks.showError, showSuccess: vi.fn() }) }));
import CategorySpecificationsManager from '../components/settings/CategorySpecificationsManager';

it('recovers failed reads and keeps a failed deletion open for retry', async () => {
  mocks.getCategories.mockResolvedValue({ data: [{ id: 'one', name: 'First' }] });
  mocks.getCategorySpecifications.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ data: [{ id: 'spec', spec_name: 'Voltage' }] });
  mocks.deleteCategorySpecification.mockRejectedValue({ response: { data: { error: 'Delete failed' } } });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CategorySpecificationsManager /></QueryClientProvider>);
  await screen.findByRole('option', { name: 'First' });
  fireEvent.change(screen.getByLabelText('Select Category'), { target: { value: 'one' } });
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load category specifications');
  expect(screen.queryByText('No specifications defined for this category yet.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Delete' }).at(-1));
  await waitFor(() => expect(mocks.showError).toHaveBeenCalledWith('Delete failed'));
  expect(screen.getByText('Delete Specification')).toBeInTheDocument();
});
