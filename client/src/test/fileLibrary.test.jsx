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

vi.mock('../components/fileLibrary', () => ({
  FileTypesView: ({ onOpenRename }) => (
    <button onClick={() => onOpenRename(mockRenameEntry, 'schematic')}>
      Open Rename
    </button>
  ),
  CategoryView: () => <div>Category View</div>,
  RenameModal: ({ setRenameData, onSubmit, isPending }) => (
    <div>
      <button
        onClick={() => setRenameData((previous) => ({ ...previous, newName: 'renamed-symbol.olb' }))}
      >
        Set New Name
      </button>
      <button onClick={onSubmit} disabled={isPending}>
        Submit Rename
      </button>
    </div>
  ),
  DeleteModal: () => null,
}));

import FileLibrary from '../pages/FileLibrary';

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

describe('FileLibrary shared rename flow', () => {
  beforeEach(() => {
    authState.user = { role: 'read-write' };
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
    renamePhysicalFileMock.mockResolvedValue({
      data: {
        success: true,
        newFileName: 'renamed-symbol.olb',
        updatedCount: 2,
      },
    });
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
