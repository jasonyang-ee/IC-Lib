import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import BulkAlternativeClassModal from '../components/library/BulkAlternativeClassModal';
import ComponentEditForm from '../components/library/ComponentEditForm';
import ComponentDetailView from '../components/library/ComponentDetailView';
import Library from '../pages/Library';
import { canBulkSetAlternativeClass } from '../utils/accessControl';
import { getVisibleBulkIds } from '../utils/libraryUtils';

const libraryApi = vi.hoisted(() => ({
  getCategories: vi.fn(),
  getComponents: vi.fn(),
  getManufacturers: vi.fn(),
  getProjects: vi.fn(),
  getDistributors: vi.fn(),
  bulkSetComponentAlternativeClass: vi.fn(),
  bulkDeleteComponents: vi.fn(),
}));
const libraryFlags = vi.hoisted(() => ({ ecoEnabled: true }));

// The edit form embeds the CAD file manager, which pulls in the query client,
// notifications and upload endpoints. None of that is under test here.
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
vi.mock('../components/common', () => ({
  AlternativeClassBadge: ({ value }) => <span>{value || 'Unrated'}</span>,
}));

const libraryComponents = [
  { id: 'new-part', part_number: 'NEW-00001', approval_status: 'new', alt_class: 'A' },
  { id: 'controlled-part', part_number: 'PROD-00001', approval_status: 'production', alt_class: 'B' },
  { id: 'archived-part', part_number: 'ARCH-00001', approval_status: 'archived', alt_class: 'C' },
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
  libraryApi.bulkSetComponentAlternativeClass.mockReset();
  libraryApi.bulkDeleteComponents.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// §V41/§V59: the Library carries the component's library default - a field in
// add/edit, a badge in the detail view, and one all-or-none bulk set over the
// current selection. With ECO on, a non-admin may only include parts they
// could direct-edit (§V15); the server stays the authority either way.

describe('bulk class selection eligibility (§V15/§V59)', () => {
  it('lets any write role include any part when ECO is off', () => {
    expect(canBulkSetAlternativeClass('read-write', 'production', false)).toBe(true);
    expect(canBulkSetAlternativeClass('read-write', 'new', false)).toBe(true);
  });

  it('lets an admin include a controlled part when ECO is on', () => {
    expect(canBulkSetAlternativeClass('admin', 'production', true)).toBe(true);
    expect(canBulkSetAlternativeClass('admin', 'archived', true)).toBe(true);
  });

  it('limits a non-admin to new parts when ECO is on', () => {
    expect(canBulkSetAlternativeClass('read-write', 'new', true)).toBe(true);
    expect(canBulkSetAlternativeClass('read-write', 'production', true)).toBe(false);
    expect(canBulkSetAlternativeClass('read-write', 'reviewing', true)).toBe(false);
    expect(canBulkSetAlternativeClass('read-only', 'new', true)).toBe(false);
  });
});

describe('visible bulk mutation boundary (§V59)', () => {
  const visibleComponents = [
    { id: 'visible-a', approval_status: 'new' },
    { id: 'visible-b', approval_status: 'production' },
  ];

  it('drops selected IDs that are no longer visible', () => {
    expect(getVisibleBulkIds(new Set(['visible-a', 'hidden']), visibleComponents)).toEqual(['visible-a']);
    expect(getVisibleBulkIds(new Set(['hidden']), visibleComponents)).toEqual([]);
  });

  it('keeps only visible eligible IDs for alternative-class mutation', () => {
    expect(getVisibleBulkIds(
      new Set(['visible-a', 'visible-b', 'hidden']),
      visibleComponents,
      (component) => component.approval_status === 'new',
    )).toEqual(['visible-a']);
  });
});

describe('BulkAlternativeClassModal (§V59)', () => {
  const renderModal = (props = {}) => render(
    <BulkAlternativeClassModal
      isOpen
      selectedCount={3}
      excludedCount={0}
      onApply={vi.fn()}
      onClose={vi.fn()}
      {...props}
    />,
  );

  it('names the number of components the change will touch', () => {
    renderModal();

    expect(screen.getByRole('button', { name: 'Apply to 3 Components' })).toBeEnabled();
  });

  it('applies the chosen class in one call', () => {
    const onApply = vi.fn();
    renderModal({ onApply });

    fireEvent.change(screen.getByLabelText('Alternative Class'), { target: { value: 'B' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply to 3 Components' }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith('B');
  });

  it('clears the class by applying null, never an empty string', () => {
    const onApply = vi.fn();
    renderModal({ onApply });

    fireEvent.click(screen.getByRole('button', { name: 'Apply to 3 Components' }));

    expect(onApply).toHaveBeenCalledWith(null);
  });

  it('cannot be applied with nothing selected', () => {
    const onApply = vi.fn();
    renderModal({ selectedCount: 0, onApply });

    expect(screen.getByRole('button', { name: 'Apply to 0 Components' })).toBeDisabled();
  });

  it('locks the class, cancel, and close controls while applying', () => {
    renderModal({ isPending: true });

    expect(screen.getByLabelText('Alternative Class')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Applying...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel alternative-class update' })).toBeDisabled();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('closes without applying on cancel', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    renderModal({ onApply, onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel alternative-class update' }));

    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('says which parts were held back for an ECO', () => {
    renderModal({ excludedCount: 2 });

    expect(screen.getByText(/2 components in this list are under change control/)).toBeInTheDocument();
    expect(screen.getByText(/use an ECO/)).toBeInTheDocument();
  });

  it('renders nothing while closed', () => {
    const { container } = renderModal({ isOpen: false });

    expect(container).toBeEmptyDOMElement();
  });
});

describe('Library bulk alternative-class wiring (§V15/§V59)', () => {
  it('uses the current visible selection once, preserves an explicit clear, and resets mode state after success', async () => {
    let resolveBulkRequest;
    libraryApi.bulkSetComponentAlternativeClass.mockImplementation(() => new Promise((resolve) => {
      resolveBulkRequest = resolve;
    }));

    renderLibrary();
    await screen.findByText('NEW-00001');

    fireEvent.click(screen.getByRole('button', { name: 'Set Alternative Class' }));
    expect(screen.getByRole('checkbox', { name: 'Select PROD-00001' })).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select NEW-00001' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set Class (1)' }));
    expect(screen.getByText(/1 component in this list is under change control/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel alternative-class update' }));
    fireEvent.click(screen.getByRole('button', { name: 'Production' }));
    await waitFor(() => expect(screen.queryByText('PROD-00001')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Set Class (1)' }));
    expect(screen.queryByText(/under change control/)).not.toBeInTheDocument();

    const applyButton = screen.getByRole('button', { name: 'Apply to 1 Component' });
    fireEvent.click(applyButton);
    fireEvent.click(applyButton);

    await waitFor(() => expect(libraryApi.bulkSetComponentAlternativeClass).toHaveBeenCalledTimes(1));
    expect(libraryApi.bulkSetComponentAlternativeClass).toHaveBeenCalledWith(['new-part'], null);
    expect(screen.getByRole('button', { name: 'Applying...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel alternative-class update' })).toBeDisabled();
    expect(screen.getByText('Set Alternative Class')).toBeInTheDocument();

    await act(async () => {
      resolveBulkRequest({ data: {} });
    });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Applying...' })).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Set Alternative Class' }));
    expect(screen.getByRole('button', { name: 'Set Class (0)' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set Alternative Class' }));
    expect(screen.getByRole('button', { name: 'Set Class (0)' })).toBeDisabled();
  });

  it('keeps a failed bulk update visible and retryable', async () => {
    libraryApi.bulkSetComponentAlternativeClass
      .mockRejectedValueOnce({ response: { data: { error: 'The selected component changed before it could be updated.' } } })
      .mockResolvedValueOnce({ data: {} });

    renderLibrary();
    await screen.findByText('NEW-00001');

    fireEvent.click(screen.getByRole('button', { name: 'Set Alternative Class' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select NEW-00001' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set Class (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply to 1 Component' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The selected component changed before it could be updated.');
    expect(screen.getByRole('button', { name: 'Apply to 1 Component' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss warning' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply to 1 Component' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Apply to 1 Component' })).not.toBeInTheDocument());

    expect(libraryApi.bulkSetComponentAlternativeClass).toHaveBeenCalledTimes(2);
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
