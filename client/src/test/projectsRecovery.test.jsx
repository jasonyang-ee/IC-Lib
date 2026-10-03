import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  getProjects: vi.fn(), getProjectById: vi.fn(), getSettings: vi.fn(), updateProject: vi.fn(),
  getComponentById: vi.fn(), getComponentDistributors: vi.fn(), getComponentAlternatives: vi.fn(), showError: vi.fn(),
}));
vi.mock('../utils/api', () => ({ api: mocks }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ canWrite: () => true }) }));
vi.mock('../contexts/NotificationContext', () => ({ useNotification: () => ({ showError: mocks.showError, showSuccess: vi.fn() }) }));
import Projects from '../pages/Projects';

const openProject = async () => {
  render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Projects /></QueryClientProvider></MemoryRouter>);
  fireEvent.click(await screen.findByText('Board'));
  await screen.findByRole('heading', { name: 'Board', level: 2 });
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getProjects.mockResolvedValue({ data: [{ id: 'p1', name: 'Board', status: 'active' }] });
  mocks.getProjectById.mockResolvedValue({ data: { id: 'p1', name: 'Board', status: 'active', components: [{ id: 'pc1', component_id: 'c1', part_number: 'P-1', quantity: 2, unit_price: null }] } });
  mocks.getSettings.mockResolvedValue({ data: {} });
});

it('keeps cancelled edits out of the selected project and keeps unknown pricing visible', async () => {
  await openProject();
  expect(screen.getByText('Project total: No pricing data')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Edit', exact: true }));
  fireEvent.change(screen.getByDisplayValue('Board'), { target: { value: 'Unsaved' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
  expect(screen.queryByText('Unsaved')).not.toBeInTheDocument();
  expect(mocks.updateProject).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Edit', exact: true }));
  expect(screen.getByDisplayValue('Board')).toBeInTheDocument();
});

it('reports failed BOM enrichment instead of exporting incomplete records', async () => {
  await openProject();
  mocks.getComponentById.mockRejectedValue(new Error('Part lookup unavailable'));
  mocks.getComponentDistributors.mockResolvedValue({ data: [] });
  mocks.getComponentAlternatives.mockResolvedValue({ data: [] });
  fireEvent.click(screen.getByRole('button', { name: /Generate BOM/ }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Generate BOM', exact: true }).at(-1));
  await waitFor(() => expect(mocks.showError).toHaveBeenCalledWith('Failed to generate BOM: Part lookup unavailable'));
});
