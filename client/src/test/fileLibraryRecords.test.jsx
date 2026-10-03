import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FileLibrary from '../pages/FileLibrary';

const { api, notifications } = vi.hoisted(() => ({
  api: Object.fromEntries(['getFileTypeStats', 'getCISFiles', 'getFileStoragePath', 'getFilesByType',
    'getOrphanFiles', 'getComponentsByFile', 'getCategories', 'getComponentsByCategoryForFiles',
    'getCadFilesForComponent', 'getSharingComponents', 'renameFootprintGroup', 'renamePhysicalFile',
  ].map(name => [name, vi.fn()])),
  notifications: { showSuccess: vi.fn(), showError: vi.fn() },
}));
vi.mock('../utils/api', () => ({ api }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' }, canWrite: () => true }) }));
vi.mock('../contexts/FeatureFlagsContext', () => ({ useFeatureFlags: () => ({ ecoEnabled: true }) }));
vi.mock('../contexts/NotificationContext', () => ({ useNotification: () => notifications }));
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }) => ({
    getTotalSize: () => count * 60,
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ index, start: index * 60 })),
    measureElement: () => {},
  }),
}));

const pair = ['part.psm', 'part.dra'].map((file_name, index) => ({
  id: `file-${index}`, file_type: 'footprint', file_name, component_count: 1,
}));
const renderPage = (url = '/file-library') => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(['componentDetails', 'part'], { pcb_footprint: 'part' });
  client.setQueryData(['componentFiles', 'part'], { files: {} });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[url]}><FileLibrary /></MemoryRouter></QueryClientProvider>);
  return { queryClient: client };
};

beforeEach(() => {
  vi.resetAllMocks();
  api.getFileTypeStats.mockResolvedValue({ data: { footprint: 2 } });
  api.getCISFiles.mockResolvedValue({ data: [] });
  api.getFileStoragePath.mockResolvedValue({ data: { path: '/cad' } });
  api.getFilesByType.mockResolvedValue({ data: { files: pair } });
  api.getComponentsByFile.mockResolvedValue({ data: { components: [{ id: 'part', part_number: 'PART-1', manufacturer_pn: 'MPN', approval_status: 'production' }] } });
  api.getCategories.mockResolvedValue({ data: [] });
  api.getComponentsByCategoryForFiles.mockResolvedValue({ data: { components: [{ id: 'part', part_number: 'PART-1', manufacturer_pn: 'MPN' }] } });
  api.getCadFilesForComponent.mockResolvedValue({ data: { files: { footprint: pair } } });
  api.getSharingComponents.mockResolvedValue({ data: { components: [] } });
  api.renameFootprintGroup.mockResolvedValue({ data: { updatedCount: 1, renamedFiles: pair.map(file => ({ newFileName: file.file_name.replace('part', 'renamed') })) } });
});

describe('File Library record consistency', () => {
  it('shows missing and pending ECO tags and prevents unavailable rename or protected deletion', async () => {
    api.getFilesByType.mockResolvedValue({ data: { files: [{ ...pair[0], component_count: 0, missing: true, pending_eco: true }] } });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /PART.psm Missing file Pending ECO/ }));
    expect(screen.getAllByText('Missing file')).toHaveLength(2);
    expect(screen.getAllByText('Pending ECO')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Rename', exact: true })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Delete', exact: true })).not.toBeInTheDocument();
    expect(await screen.findByText('Production')).toBeInTheDocument();
  });

  it('renames the footprint pair from Category view and refreshes cached part records', async () => {
    const { queryClient } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Category', exact: true }));
    fireEvent.click(await screen.findByRole('button', { name: /PART-1/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Rename', exact: true }));
    const input = await screen.findByRole('textbox', { name: 'New Base Name' });
    await waitFor(() => expect(input).toBeEnabled());
    expect(screen.getByText(/1 component\(s\) referencing these files/)).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'renamed' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Rename', exact: true }).at(-1));
    await waitFor(() => expect(api.renameFootprintGroup).toHaveBeenCalledWith(['part.dra', 'part.psm'], 'renamed'));
    await waitFor(() => expect(queryClient.getQueryState(['componentDetails', 'part']).isInvalidated).toBe(true));
    expect(queryClient.getQueryState(['componentFiles', 'part']).isInvalidated).toBe(true);
    expect(api.renamePhysicalFile).not.toHaveBeenCalled();
  });

  it('preserves case-sensitive file identities and filters short search terms consistently', async () => {
    api.getFilesByType.mockResolvedValue({ data: { files: [
      { id: 'a', file_type: 'symbol', file_name: 'PART.olb' },
      { id: 'b', file_type: 'symbol', file_name: 'part.olb' },
      { id: 'c', file_type: 'symbol', file_name: 'other.olb' },
    ] } });
    renderPage('/file-library?type=schematic');
    fireEvent.click(await screen.findByRole('button', { name: 'PART.olb', exact: true }));
    await waitFor(() => expect(api.getComponentsByFile).toHaveBeenCalledWith('schematic', 'PART.olb', undefined));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search files or components' }), { target: { value: 'p' } });
    expect(screen.queryByRole('button', { name: 'other.olb', exact: true })).not.toBeInTheDocument();
  });

  it('accepts literal percent signs in file deep links', async () => {
    renderPage('/file-library?type=footprint&file=100%25');
    expect(screen.getByRole('textbox', { name: 'Search files or components' })).toHaveValue('100%');
  });

  it('reports failed file reads and offers retry', async () => {
    api.getFilesByType.mockRejectedValueOnce(new Error('Disconnected'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Disconnected');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('button', { name: /^PART PART.dra PART.psm$/ })).toBeInTheDocument();
  });
});
