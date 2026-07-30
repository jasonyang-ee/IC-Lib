import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getFileTypeStatsMock = vi.fn();
const getCISFilesMock = vi.fn();
const getFileStoragePathMock = vi.fn();
const getFilesByTypeMock = vi.fn();
const getOrphanFilesMock = vi.fn();
const searchFilesMock = vi.fn();
const getComponentsByFileMock = vi.fn();
const getCategoriesMock = vi.fn();
const getComponentsByCategoryForFilesMock = vi.fn();
const getCadFilesForComponentMock = vi.fn();
const getSharingComponentsMock = vi.fn();
const renamePhysicalFileMock = vi.fn();
const renameFootprintGroupMock = vi.fn();
const linkFootprintRelatedFilesMock = vi.fn();
const unlinkFootprintRelatedFilesMock = vi.fn();
const showSuccessMock = vi.fn();
const showErrorMock = vi.fn();

const authState = {
  user: { role: 'read-write' },
  canWrite: () => true,
};

const featureFlagState = {
  ecoEnabled: true,
  isLoading: false,
};

const mockRenameEntry = {
  key: 'file:shared-symbol.olb',
  kind: 'single',
  displayName: 'shared-symbol.olb',
  file_type: 'symbol',
  fileNames: ['shared-symbol.olb'],
  files: [{ file_name: 'shared-symbol.olb' }],
  componentCount: 2,
  canDelete: false,
  searchText: 'shared-symbol.olb',
};

vi.mock('../utils/api', () => ({
  api: {
    getFileTypeStats: (...args) => getFileTypeStatsMock(...args),
    getCISFiles: (...args) => getCISFilesMock(...args),
    getFileStoragePath: (...args) => getFileStoragePathMock(...args),
    getFilesByType: (...args) => getFilesByTypeMock(...args),
    getOrphanFiles: (...args) => getOrphanFilesMock(...args),
    searchFiles: (...args) => searchFilesMock(...args),
    getComponentsByFile: (...args) => getComponentsByFileMock(...args),
    getCategories: (...args) => getCategoriesMock(...args),
    getComponentsByCategoryForFiles: (...args) => getComponentsByCategoryForFilesMock(...args),
    getCadFilesForComponent: (...args) => getCadFilesForComponentMock(...args),
    getSharingComponents: (...args) => getSharingComponentsMock(...args),
    renamePhysicalFile: (...args) => renamePhysicalFileMock(...args),
    renameFootprintGroup: (...args) => renameFootprintGroupMock(...args),
    linkFootprintRelatedFiles: (...args) => linkFootprintRelatedFilesMock(...args),
    unlinkFootprintRelatedFiles: (...args) => unlinkFootprintRelatedFilesMock(...args),
  },
}));

vi.mock('../contexts/NotificationContext', () => ({
  useNotification: () => ({
    showSuccess: showSuccessMock,
    showError: showErrorMock,
  }),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('../contexts/FeatureFlagsContext', () => ({
  useFeatureFlags: () => featureFlagState,
}));

const mockFootprintSingleEntry = {
  key: 'file:soic8.psm',
  kind: 'single',
  displayName: 'soic8.psm',
  file_type: 'footprint',
  fileNames: ['soic8.psm'],
  files: [{ file_name: 'soic8.psm' }],
  componentCount: 1,
  canDelete: false,
  searchText: 'soic8.psm',
};

const mockFootprintPairEntry = {
  key: 'pair:soic8',
  kind: 'pair',
  displayName: 'soic8 (.psm/.dra)',
  file_type: 'footprint',
  fileNames: ['soic8.psm', 'soic8.dra'],
  files: [{ file_name: 'soic8.psm' }, { file_name: 'soic8.dra' }],
  componentCount: 1,
  canDelete: false,
  searchText: 'soic8',
};

vi.mock('../components/fileLibrary', () => ({
  FileTypesView: ({ onOpenRename }) => (
    <div>
      <button onClick={() => onOpenRename(mockRenameEntry, 'schematic')}>
        Open Rename
      </button>
      <button onClick={() => onOpenRename(mockFootprintSingleEntry, 'footprint')}>
        Open Footprint Rename
      </button>
      <button onClick={() => onOpenRename(mockFootprintPairEntry, 'footprint')}>
        Open Footprint Pair Rename
      </button>
    </div>
  ),
  CategoryView: () => <div>Category View</div>,
  RenameModal: ({ renameData, setRenameData, onSubmit, isPending }) => (
    <div>
      <div data-testid="rename-current-name">{renameData?.newName}</div>
      <button
        onClick={() => setRenameData((previous) => ({ ...previous, newName: 'renamed-symbol.olb' }))}
      >
        Set New Name
      </button>
      <button
        onClick={() => setRenameData((previous) => ({ ...previous, newName: 'so+ic8' }))}
      >
        Set Plus Name
      </button>
      <button onClick={onSubmit} disabled={isPending}>
        Submit Rename
      </button>
    </div>
  ),
  DeleteModal: () => null,
  FootprintLinkEditorModal: () => null,
}));

import FileLibrary from '../pages/FileLibrary';
import { FOOTPRINT_PLUS_ERROR_MESSAGE } from '../utils/footprintFiles';

const renderComponent = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <FileLibrary />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

/** Reset every api/notification double and re-prime the default happy path. */
const primeMocks = () => {
  featureFlagState.ecoEnabled = true;

  getFileTypeStatsMock.mockReset();
  getCISFilesMock.mockReset();
  getFileStoragePathMock.mockReset();
  getFilesByTypeMock.mockReset();
  getOrphanFilesMock.mockReset();
  searchFilesMock.mockReset();
  getComponentsByFileMock.mockReset();
  getCategoriesMock.mockReset();
  getComponentsByCategoryForFilesMock.mockReset();
  getCadFilesForComponentMock.mockReset();
  getSharingComponentsMock.mockReset();
  renamePhysicalFileMock.mockReset();
  renameFootprintGroupMock.mockReset();
  linkFootprintRelatedFilesMock.mockReset();
  unlinkFootprintRelatedFilesMock.mockReset();
  showSuccessMock.mockReset();
  showErrorMock.mockReset();

  getFileTypeStatsMock.mockResolvedValue({ data: { schematic: 1, footprint: 0, pad: 0, step: 0, pspice: 0 } });
  getCISFilesMock.mockResolvedValue({ data: [] });
  getFileStoragePathMock.mockResolvedValue({ data: { path: 'C:\\Library' } });
  getFilesByTypeMock.mockResolvedValue({ data: { files: [] } });
  getOrphanFilesMock.mockResolvedValue({ data: { orphans: [] } });
  searchFilesMock.mockResolvedValue({ data: { results: [] } });
  getCategoriesMock.mockResolvedValue({ data: [] });
  getComponentsByCategoryForFilesMock.mockResolvedValue({ data: { components: [] } });
  getCadFilesForComponentMock.mockResolvedValue({ data: { files: {} } });
  getSharingComponentsMock.mockResolvedValue({ data: { components: [] } });
  renameFootprintGroupMock.mockResolvedValue({ data: { success: true } });
  linkFootprintRelatedFilesMock.mockResolvedValue({ data: { success: true } });
  unlinkFootprintRelatedFilesMock.mockResolvedValue({ data: { success: true } });
  renamePhysicalFileMock.mockResolvedValue({
    data: {
      success: true,
      newFileName: 'renamed-symbol.olb',
      updatedCount: 2,
    },
  });
};

describe('FileLibrary shared rename flow', () => {
  beforeEach(() => {
    primeMocks();
    authState.user = { role: 'read-write' };
  });

  it('warns non-admin users before creating a shared rename ECO', async () => {
    getComponentsByFileMock.mockResolvedValue({
      data: {
        components: [
          { id: 'comp-1', approval_status: 'prototype' },
          { id: 'comp-2', approval_status: 'new' },
        ],
      },
    });
    renamePhysicalFileMock.mockResolvedValueOnce({
      data: {
        success: true,
        stagedEco: true,
        ecoNumber: 'ECO-12',
        updatedCount: 1,
      },
    });

    renderComponent();

    fireEvent.click(await screen.findByRole('button', { name: 'Open Rename' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set New Name' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit Rename' }));

    expect(renamePhysicalFileMock).not.toHaveBeenCalled();

    expect(await screen.findByText('Create Shared Rename ECO')).toBeInTheDocument();
    expect(screen.getByText(/move 1 controlled part to reviewing/i)).toBeInTheDocument();
    expect(screen.getByText(/1 new part will stay editable/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create ECO' }));

    await waitFor(() => {
      expect(renamePhysicalFileMock).toHaveBeenCalledWith('schematic', {
        oldFileName: 'shared-symbol.olb',
        newFileName: 'renamed-symbol.olb',
      });
    });
  });

  it('renames shared files directly when every affected part is still new', async () => {
    getComponentsByFileMock.mockResolvedValue({
      data: {
        components: [
          { id: 'comp-1', approval_status: 'new' },
          { id: 'comp-2', approval_status: 'new' },
        ],
      },
    });

    renderComponent();

    fireEvent.click(await screen.findByRole('button', { name: 'Open Rename' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set New Name' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit Rename' }));

    await waitFor(() => {
      expect(renamePhysicalFileMock).toHaveBeenCalledWith('schematic', {
        oldFileName: 'shared-symbol.olb',
        newFileName: 'renamed-symbol.olb',
      });
    });

    expect(screen.queryByText('Create Shared Rename ECO')).not.toBeInTheDocument();
  });

  it('lets admin users rename shared files directly without the ECO warning', async () => {
    authState.user = { role: 'admin' };

    renderComponent();

    fireEvent.click(await screen.findByRole('button', { name: 'Open Rename' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set New Name' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit Rename' }));

    await waitFor(() => {
      expect(renamePhysicalFileMock).toHaveBeenCalledWith('schematic', {
        oldFileName: 'shared-symbol.olb',
        newFileName: 'renamed-symbol.olb',
      });
    });

    expect(getComponentsByFileMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Create Shared Rename ECO')).not.toBeInTheDocument();
  });
});

describe('FileLibrary footprint "+" rejection (V28)', () => {
  beforeEach(() => {
    primeMocks();
    authState.user = { role: 'admin' };
    getComponentsByFileMock.mockResolvedValue({ data: { components: [] } });
  });

  // §V28: "+" is OrCAD-illegal in footprint names and must be rejected, never
  // silently stripped. Admin is used so no shared-rename ECO warning can
  // intercept the submit before the name check runs.
  it('rejects a "+" in a footprint single rename and never calls the API', async () => {
    renderComponent();

    fireEvent.click(await screen.findByRole('button', { name: 'Open Footprint Rename' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set Plus Name' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit Rename' }));

    expect(showErrorMock).toHaveBeenCalledWith(FOOTPRINT_PLUS_ERROR_MESSAGE);
    expect(renamePhysicalFileMock).not.toHaveBeenCalled();
    expect(renameFootprintGroupMock).not.toHaveBeenCalled();

    // The modal stays open on the rejected value so the operator can fix it.
    expect(screen.getByTestId('rename-current-name')).toHaveTextContent('so+ic8');
  });

  it('rejects a "+" in a footprint pair rename and never calls the API', async () => {
    renderComponent();

    fireEvent.click(await screen.findByRole('button', { name: 'Open Footprint Pair Rename' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set Plus Name' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit Rename' }));

    expect(showErrorMock).toHaveBeenCalledWith(FOOTPRINT_PLUS_ERROR_MESSAGE);
    expect(renameFootprintGroupMock).not.toHaveBeenCalled();
    expect(renamePhysicalFileMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('rename-current-name')).toHaveTextContent('so+ic8');
  });

  it('accepts a legal footprint pair rename, proving the guard is not blanket', async () => {
    renderComponent();

    fireEvent.click(await screen.findByRole('button', { name: 'Open Footprint Pair Rename' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set New Name' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit Rename' }));

    await waitFor(() => {
      expect(renameFootprintGroupMock).toHaveBeenCalled();
    });
    expect(showErrorMock).not.toHaveBeenCalledWith(FOOTPRINT_PLUS_ERROR_MESSAGE);
  });
});
