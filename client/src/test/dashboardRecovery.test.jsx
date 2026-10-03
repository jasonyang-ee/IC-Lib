import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  getDashboardStats: vi.fn(), getCategoryBreakdown: vi.fn(), getExtendedDashboardStats: vi.fn(), getDatabaseInfo: vi.fn(),
}));
vi.mock('../utils/api', () => ({ api: mocks }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }));
import Dashboard from '../pages/Dashboard';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getDashboardStats.mockResolvedValue({ data: { totalComponents: 12 } });
  mocks.getCategoryBreakdown.mockResolvedValue({ data: [] });
  mocks.getExtendedDashboardStats.mockResolvedValue({ data: {} });
  mocks.getDatabaseInfo.mockResolvedValue({ data: {} });
});
const showDashboard = () => render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Dashboard /></QueryClientProvider></MemoryRouter>);

it('recovers an ordinary server failure without recommending database initialization', async () => {
  mocks.getDashboardStats.mockRejectedValueOnce({ response: { status: 500 } });
  showDashboard();
  expect(await screen.findByText('Unable to load dashboard')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Open Settings' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('12')).toBeInTheDocument();
});

it('links administrators to recovery settings only for an incomplete schema', async () => {
  mocks.getDashboardStats.mockRejectedValue({ response: { status: 503, data: { code: 'DATABASE_SCHEMA_INCOMPLETE' } } });
  showDashboard();
  expect(await screen.findByRole('link', { name: 'Open Settings' })).toHaveAttribute('href', '/admin-settings');
  expect(screen.getByText('Database setup required')).toBeInTheDocument();
});

it('does not turn a failed extended-statistics request into zero project and manufacturer counts', async () => {
  mocks.getExtendedDashboardStats.mockRejectedValue(new Error('offline'));
  showDashboard();
  expect(await screen.findByText('Unable to load dashboard')).toBeInTheDocument();
  expect(screen.queryByText('Manufacturers')).not.toBeInTheDocument();
});
