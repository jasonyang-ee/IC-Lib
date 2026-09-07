import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Library from '../pages/Library';

const mocks = vi.hoisted(() => ({ api: {}, showError: vi.fn() }));
vi.mock('../utils/api', () => ({ api: mocks.api }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ canWrite: () => true, canApprove: () => false, user: { role: 'admin' } }) }));
vi.mock('../contexts/FeatureFlagsContext', () => ({ useFeatureFlags: () => ({ ecoEnabled: true }) }));
vi.mock('../contexts/NotificationContext', () => ({ useNotification: () => ({ showSuccess: vi.fn(), showInfo: vi.fn(), showError: mocks.showError }) }));
vi.mock('@tanstack/react-virtual', () => ({ useVirtualizer: ({ count }) => ({
  getTotalSize: () => count * 45, getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ index, start: index * 45 })), measureElement: () => {},
}) }));
// Keep the real page save/cancel orchestration; the form supplies staged uploads.
vi.mock('../components/library', () => ({
  AssignedProjectsView: () => null,
  DistributorInfoSection: () => null,
  ComponentDetailView: ({ componentDetails }) => <div>{componentDetails?.manufacturer_id ? 'Details loaded' : 'Loading details'}</div>,
  ComponentEditForm: ({ onTempFileStaged, setEditData }) => <button onClick={() => {
    setEditData(current => ({ ...current, category_id: 'category-1', part_number: 'PN-2', manufacturer_id: 'manufacturer-1', manufacturer_pn: 'CHANGED', manufacturer_part_number: 'CHANGED', value: '1k' }));
    onTempFileStaged({ tempFilename: '100-200-part.psm', filename: 'part.psm', category: 'footprint' });
    onTempFileStaged({ tempFilename: '100-201-part.dra', filename: 'part.dra', category: 'footprint' });
  }}>Stage uploads</button>,
}));
const component = { id: 'component-1', part_number: 'PN-1', manufacturer_pn: 'PART', manufacturer_id: 'manufacturer-1', value: '1k', approval_status: 'new' };
const first = { tempFilename: '100-200-part.psm', filename: 'part.psm', type: 'footprint', cadFileId: 'cad-1' };
const second = { tempFilename: '100-201-part.dra', filename: 'part.dra', type: 'footprint', error: 'Disk full; upload retained for retry' };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  for (const method of ['getCategories', 'getManufacturers', 'getProjects', 'getDistributors', 'getComponentSpecifications', 'getComponentDistributors', 'getComponentProjects', 'getComponentAlternatives', 'getCategorySpecifications', 'getSubCategorySuggestions', 'getPackageSuggestions', 'updateComponentSpecifications', 'updateComponentDistributors', 'cleanupTempFiles']) {
    mocks.api[method] = vi.fn().mockResolvedValue({ data: [] });
  }
  mocks.api.getComponents = vi.fn().mockResolvedValue({ data: [component] });
  mocks.api.getComponentById = vi.fn().mockResolvedValue({ data: component });
  mocks.api.getCadFilesForComponent = vi.fn().mockResolvedValue({ data: { files: {} } });
  mocks.api.updateComponent = vi.fn().mockResolvedValue({ data: component });
  mocks.api.createComponent = vi.fn().mockResolvedValue({ data: { ...component, id: 'new-component' } });
  mocks.api.checkCollisionsBatch = vi.fn().mockResolvedValue({ data: { collisions: [] } });
  mocks.api.finalizeTempFiles = vi.fn().mockResolvedValueOnce({ data: { results: [first, second] } })
    .mockResolvedValue({ data: { results: [{ ...second, error: undefined, cadFileId: 'cad-2' }] } });
});

const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
  <MemoryRouter><Library /></MemoryRouter>
</QueryClientProvider>);
const edit = async () => {
  mount();
  fireEvent.click(await screen.findByText('PN-1'));
  await screen.findByText('Details loaded');
  fireEvent.click(screen.getByRole('button', { name: 'Edit Component' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Stage uploads' }));
};

describe('Library upload failure recovery', () => {
  it('stops component saving on a partial batch and retries only the failed token using the stable component ID', async () => {
    await edit();
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await screen.findByText('part.dra: Disk full; upload retained for retry');
    expect(mocks.api.updateComponent).not.toHaveBeenCalled();
    expect(mocks.api.finalizeTempFiles).toHaveBeenLastCalledWith({ files: [
      { tempFilename: first.tempFilename, category: 'footprint', resolution: undefined },
      { tempFilename: second.tempFilename, category: 'footprint', resolution: undefined },
    ], componentId: component.id });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(mocks.api.updateComponent).toHaveBeenCalledTimes(1));
    expect(mocks.api.finalizeTempFiles).toHaveBeenLastCalledWith({ files: [
      { tempFilename: second.tempFilename, category: 'footprint', resolution: undefined },
    ], componentId: component.id });
  });

  it('cancels only the remaining staged uploads after a partial batch', async () => {
    await edit();
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await screen.findByText('part.dra: Disk full; upload retained for retry');
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(mocks.api.cleanupTempFiles).toHaveBeenCalledWith({ tempFilenames: [second.tempFilename] }));
    expect(mocks.api.updateComponent).not.toHaveBeenCalled();
  });

  it('does not link a new-part upload by a possibly duplicated MPN before creation', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Add Component' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Stage uploads' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Add' }));
    await waitFor(() => expect(mocks.showError).toHaveBeenCalledWith('part.dra: Disk full; upload retained for retry'));
    expect(mocks.api.createComponent).not.toHaveBeenCalled();
    expect(mocks.api.finalizeTempFiles.mock.calls[0][0]).not.toHaveProperty('mfgPartNumber');
    expect(mocks.api.finalizeTempFiles.mock.calls[0][0]).not.toHaveProperty('componentId');
  });
});
