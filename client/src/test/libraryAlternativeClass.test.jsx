import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ComponentEditForm from '../components/library/ComponentEditForm';
import ComponentDetailView from '../components/library/ComponentDetailView';
import Library from '../pages/Library';

const libraryApi = vi.hoisted(() => ({
  getCategories: vi.fn(),
  getComponents: vi.fn(),
  getManufacturers: vi.fn(),
  getProjects: vi.fn(),
  getDistributors: vi.fn(),
  bulkDeleteComponents: vi.fn(),
}));
const libraryFlags = vi.hoisted(() => ({ ecoEnabled: true }));

vi.mock('../components/library/ComponentFiles', () => ({ default: () => null }));
vi.mock('../utils/api', () => ({ api: libraryApi }));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    canWrite: () => true,
    canApprove: () => false,
    user: { id: 'user-1', role: 'read-write' },
  }),
}));
vi.mock('../contexts/FeatureFlagsContext', () => ({
  useFeatureFlags: () => libraryFlags,
}));
vi.mock('../contexts/NotificationContext', () => ({
  useNotification: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showInfo: vi.fn() }),
}));
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }) => ({
    getTotalSize: () => count * 45,
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ index, start: index * 45 })),
    measureElement: () => {},
  }),
}));
vi.mock('../components/library', () => ({
  AssignedProjectsView: () => null,
  ComponentEditForm: () => null,
  ComponentDetailView: () => null,
  DistributorInfoSection: () => null,
}));
vi.mock('../components/library/LibraryModals', () => ({
  DeleteConfirmationModal: ({ deleteConfirmation, isPending, onConfirm, onCancel }) => deleteConfirmation.show ? (
    <div>
      <p>Delete {deleteConfirmation.count} component(s)?</p>
      <button onClick={onCancel} disabled={isPending}>Cancel deletion</button>
      <button onClick={onConfirm} disabled={isPending}>{isPending ? 'Deleting...' : 'Delete'}</button>
    </div>
  ) : null,
  PromoteConfirmationModal: () => null,
  CategoryChangeModal: () => null,
  WarningModal: ({ warningModal, onClose }) => warningModal.show ? (
    <div role="alert">
      {warningModal.message}
      <button onClick={onClose}>Dismiss warning</button>
    </div>
  ) : null,
  AddToProjectModal: () => null,
  AutoFillToast: () => null,
  VendorMappingModal: () => null,
}));

const libraryComponents = [
  {
    id: 'new-part',
    part_number: 'NEW-00001',
    manufacturer_pn: 'YAGEO-NEW',
    value: '10k',
    description: 'New resistor',
    approval_status: 'new',
    alt_class: 'A',
  },
  {
    id: 'controlled-part',
    part_number: 'PROD-00001',
    manufacturer_pn: 'TDK-PROD',
    value: '1uF',
    description: 'Production capacitor',
    approval_status: 'production',
    alt_class: 'B',
  },
  {
    id: 'archived-part',
    part_number: 'ARCH-00001',
    manufacturer_pn: 'ADI-ARCH',
    value: 'MCU',
    description: 'Archived controller',
    approval_status: 'archived',
    alt_class: 'C',
  },
];

const renderLibrary = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Library />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  sessionStorage.clear();
  libraryFlags.ecoEnabled = true;
  libraryApi.getCategories.mockResolvedValue({ data: [] });
  libraryApi.getComponents.mockResolvedValue({ data: libraryComponents });
  libraryApi.getManufacturers.mockResolvedValue({ data: [] });
  libraryApi.getProjects.mockResolvedValue({ data: [] });
  libraryApi.getDistributors.mockResolvedValue({ data: [] });
  libraryApi.bulkDeleteComponents.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Library browse cleanup (§V39/§V41)', () => {
  it('removes the browse-list alt class column and bulk action', async () => {
    renderLibrary();
    await screen.findByText('NEW-00001');

    expect(screen.queryByText('Set Alternative Class')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Class$/)).not.toBeInTheDocument();
  });

  it('colors only the P/N cell by approval status', async () => {
    renderLibrary();

    const newPn = await screen.findByText('NEW-00001');
    const productionPn = screen.getByText('PROD-00001');
    fireEvent.click(screen.getByRole('button', { name: 'Archived' }));
    const archivedPn = screen.getByText('ARCH-00001');

    expect(newPn.className).toContain('text-amber-700');
    expect(productionPn.className).toContain('text-emerald-700');
    expect(archivedPn.className).toContain('text-gray-500');

    expect(screen.getByText('YAGEO-NEW').className).toContain('text-gray-700');
    expect(screen.getByText('1uF').className).toContain('text-gray-700');
    expect(screen.getByText('Archived controller').className).toContain('text-gray-700');
  });
});

describe('Library bulk-delete wiring (F7)', () => {
  it('sends one immutable bulk request and keeps the confirmation pending until success', async () => {
    let resolveDelete;
    libraryFlags.ecoEnabled = false;
    libraryApi.bulkDeleteComponents.mockImplementation(() => new Promise((resolve) => {
      resolveDelete = resolve;
    }));

    renderLibrary();
    await screen.findByText('NEW-00001');

    fireEvent.click(screen.getByRole('button', { name: 'Delete Components' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select NEW-00001' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select PROD-00001' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Selected (2)' }));

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButton);
    fireEvent.click(deleteButton);

    await waitFor(() => expect(libraryApi.bulkDeleteComponents).toHaveBeenCalledTimes(1));
    expect(libraryApi.bulkDeleteComponents).toHaveBeenCalledWith(['new-part', 'controlled-part']);
    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel deletion' })).toBeDisabled();

    await act(async () => {
      resolveDelete({ data: { deleted: 2 } });
    });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Deleting...' })).not.toBeInTheDocument());
  });

  it('retains the snapshot after a rejected bulk delete so it can be retried', async () => {
    libraryFlags.ecoEnabled = false;
    libraryApi.bulkDeleteComponents
      .mockRejectedValueOnce({ response: { data: { error: 'One or more components were not found' } } });

    renderLibrary();
    await screen.findByText('NEW-00001');

    fireEvent.click(screen.getByRole('button', { name: 'Delete Components' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select NEW-00001' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Selected (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('One or more components were not found');
    expect(screen.getByText('Delete 1 component(s)?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
  });
});

describe('ComponentEditForm alternative class (§V41)', () => {
  const mountForm = (editData) => {
    const onFieldChange = vi.fn();
    render(
      <ComponentEditForm
        editData={editData}
        isAddMode
        isEditMode={false}
        categories={[]}
        manufacturers={[]}
        onFieldChange={onFieldChange}
        manufacturerInput=""
        setManufacturerInput={vi.fn()}
        manufacturerOpen={false}
        setManufacturerOpen={vi.fn()}
        packageSuggestions={[]}
        packageOpen={false}
        setPackageOpen={vi.fn()}
        subCat1Suggestions={[]}
        subCat2Suggestions={[]}
        subCat3Suggestions={[]}
        subCat4Suggestions={[]}
        setEditData={vi.fn()}
      />,
    );
    return onFieldChange;
  };

  it('shows the stored class for the part being edited', () => {
    mountForm({ alt_class: 'C' });

    expect(screen.getByLabelText('Alternative Class')).toHaveValue('C');
  });

  it('defaults a new part to Unrated', () => {
    mountForm({ alt_class: null });

    expect(screen.getByLabelText('Alternative Class')).toHaveValue('');
  });

  it('sends the letter when a class is picked', () => {
    const onFieldChange = mountForm({ alt_class: null });

    fireEvent.change(screen.getByLabelText('Alternative Class'), { target: { value: 'A' } });

    expect(onFieldChange).toHaveBeenCalledWith('alt_class', 'A');
  });

  it('sends null when the class is cleared back to Unrated', () => {
    const onFieldChange = mountForm({ alt_class: 'A' });

    fireEvent.change(screen.getByLabelText('Alternative Class'), { target: { value: '' } });

    expect(onFieldChange).toHaveBeenCalledWith('alt_class', null);
  });
});

describe('ComponentDetailView alternative class (§V41)', () => {
  const renderDetail = (altClass) => render(
    <MemoryRouter>
      <ComponentDetailView
        componentDetails={{ id: 'c1', part_number: 'IC-00001', alt_class: altClass }}
        selectedComponent={{ id: 'c1' }}
        alternatives={[]}
        selectedAlternative={null}
        setSelectedAlternative={vi.fn()}
        onCopy={vi.fn()}
        canAccessFileLibrary={false}
        canApprove={() => false}
        canWrite={() => false}
        updatingApproval={false}
        onApprovalAction={vi.fn()}
      />
    </MemoryRouter>,
  );

  it('shows the rated class with its substitution rule', () => {
    renderDetail('B');

    expect(screen.getByText('Alternative Class:')).toBeInTheDocument();
    expect(screen.getByTitle('Substitute per drawing notes.')).toHaveTextContent('Class B');
  });

  it('shows Unrated rather than a blank when the part has no class', () => {
    renderDetail(null);

    expect(screen.getByText('Unrated')).toBeInTheDocument();
  });
});
