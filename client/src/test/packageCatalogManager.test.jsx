import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  getPackages: vi.fn(),
  createPackage: vi.fn(),
  updatePackage: vi.fn(),
  deletePackage: vi.fn(),
  createPackageAlias: vi.fn(),
  deletePackageAlias: vi.fn(),
  promotePackageAlias: vi.fn(),
}));

vi.mock('../utils/api', () => ({ api: apiMocks }));
vi.mock('../contexts/NotificationContext', () => ({
  useNotification: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));

import PackageCatalogManager from '../components/settings/PackageCatalogManager';

const packageRow = {
  id: 'pkg-1',
  short_name: 'SOIC',
  family: 'SOIC',
  mount: 'SMT',
  count_policy: 'append',
  aliases: [{ id: 'a-1', alias: 'SOIC' }, { id: 'a-2', alias: 'SO' }],
};

const renderManager = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <PackageCatalogManager />
  </QueryClientProvider>,
);

describe('PackageCatalogManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getPackages.mockResolvedValue({ data: [packageRow] });
    ['createPackage', 'updatePackage', 'deletePackage', 'createPackageAlias', 'deletePackageAlias', 'promotePackageAlias']
      .forEach((name) => apiMocks[name].mockResolvedValue({ data: {} }));
  });

  it('creates a package with the chosen count policy and shows the resulting name', async () => {
    renderManager();
    await screen.findAllByText('SOIC');

    fireEvent.click(screen.getByRole('button', { name: 'Add Package' }));
    fireEvent.change(screen.getByLabelText('New package short name'), { target: { value: 'QFN' } });
    expect(screen.getByText(/QFN-8_B/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'No pin count' }));
    expect(screen.getByText(/QFN_B/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save Package' }));
    await waitFor(() => expect(apiMocks.createPackage).toHaveBeenCalledWith(
      { short_name: 'QFN', family: '', mount: '', count_policy: 'none' },
    ));
  });

  it('edits a package and changes its count policy', async () => {
    renderManager();
    await screen.findAllByText('SOIC');

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Count already in the name' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(apiMocks.updatePackage).toHaveBeenCalledWith('pkg-1', {
      short_name: 'SOIC', family: 'SOIC', mount: 'SMT', count_policy: 'embedded',
    }));
  });

  it('deletes a package', async () => {
    renderManager();
    await screen.findAllByText('SOIC');

    fireEvent.click(screen.getByRole('button', { name: 'Delete SOIC' }));

    await waitFor(() => expect(apiMocks.deletePackage).toHaveBeenCalledWith('pkg-1'));
  });

  it('adds and removes aliases', async () => {
    renderManager();
    await screen.findAllByText('SOIC');

    fireEvent.change(screen.getByLabelText('New alias for SOIC'), { target: { value: 'SOP' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(apiMocks.createPackageAlias).toHaveBeenCalledWith('pkg-1', 'SOP'));

    fireEvent.click(screen.getByRole('button', { name: 'Remove alias SO' }));
    await waitFor(() => expect(apiMocks.deletePackageAlias).toHaveBeenCalledWith('pkg-1', 'a-2'));
  });

  it('promotes an alias to canonical and never offers to promote or drop the self-alias', async () => {
    renderManager();
    await screen.findAllByText('SOIC');

    fireEvent.click(screen.getByRole('button', { name: 'Promote SO to canonical' }));
    await waitFor(() => expect(apiMocks.promotePackageAlias).toHaveBeenCalledWith('pkg-1', 'SO'));

    // The alias equal to the canonical name keeps the package resolvable from
    // both names after a promotion, so it is not removable here.
    expect(screen.queryByRole('button', { name: 'Promote SOIC to canonical' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove alias SOIC' })).toBeNull();
  });
});
