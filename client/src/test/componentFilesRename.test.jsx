import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { api, notifications } = vi.hoisted(() => ({
  api: {
    listComponentFiles: vi.fn(),
    renameComponentFile: vi.fn(),
    renameStagedFootprintGroup: vi.fn(),
    getFileExportUrl: vi.fn(() => '/files/export/test'),
    getFileDownloadUrl: vi.fn(() => '/files/download/test'),
  },
  notifications: { showSuccess: vi.fn(), showError: vi.fn() },
}));

vi.mock('../utils/api', () => ({ api }));
vi.mock('../contexts/NotificationContext', () => ({ useNotification: () => notifications }));
vi.mock('../components/library/CadFilePickerModal', () => ({ default: () => null }));
vi.mock('../components/library/OlbAssignmentModal', () => ({ default: () => null }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: {
      files: {
        footprint: [
          { name: 'old.psm', tempFilename: '100-200-OLD.PSM', size: 0 },
          { name: 'old.dra', tempFilename: '300-400-OLD.DRA', size: 0 },
        ],
      },
    },
    isLoading: false,
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: (config) => ({
    isPending: false,
    mutate: (variables) => Promise.resolve(config.mutationFn(variables))
      .then((result) => config.onSuccess?.(result, variables))
      .catch((error) => config.onError?.(error, variables)),
    mutateAsync: (variables) => Promise.resolve(config.mutationFn(variables))
      .then((result) => {
        config.onSuccess?.(result, variables);
        return result;
      })
      .catch((error) => {
        config.onError?.(error, variables);
        throw error;
      }),
  }),
}));

import ComponentFiles from '../components/library/ComponentFiles';

function renderFiles(onFileRenamed = vi.fn()) {
  render(<ComponentFiles mfgPartNumber="TEST-1" canEdit onFileRenamed={onFileRenamed} />);
  return onFileRenamed;
}

describe('ComponentFiles staged footprint rename', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates both staged names only after one group rename succeeds', async () => {
    api.renameStagedFootprintGroup.mockResolvedValue({
      data: {
        renamedFiles: [
          { oldFilename: 'old.psm', newFilename: 'new.psm', oldTempFilename: '100-200-OLD.PSM', newTempFilename: '100-200-new.psm', isTemp: true },
          { oldFilename: 'old.dra', newFilename: 'new.dra', oldTempFilename: '300-400-OLD.DRA', newTempFilename: '300-400-new.dra', isTemp: true },
        ],
      },
    });

    renderFiles();
    fireEvent.click(screen.getByTitle('Rename file pair'));
    fireEvent.change(screen.getByDisplayValue('old'), { target: { value: 'new' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(api.renameStagedFootprintGroup).toHaveBeenCalledWith([
      { tempFilename: '100-200-OLD.PSM', filename: 'old.psm' },
      { tempFilename: '300-400-OLD.DRA', filename: 'old.dra' },
    ], 'new'));
    expect(api.renameComponentFile).not.toHaveBeenCalled();
    expect(notifications.showSuccess).toHaveBeenCalledWith('Renamed to new.psm');
  });

  it('keeps both names and shows one error when group rename fails', async () => {
    api.renameStagedFootprintGroup.mockRejectedValue({ response: { data: { error: 'Pair rename failed' } } });

    const onFileRenamed = renderFiles();
    fireEvent.click(screen.getByTitle('Rename file pair'));
    fireEvent.change(screen.getByDisplayValue('old'), { target: { value: 'new' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(notifications.showError).toHaveBeenCalledWith('Rename failed: Pair rename failed'));
    expect(api.renameComponentFile).not.toHaveBeenCalled();
    expect(onFileRenamed).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('new')).toBeInTheDocument();
  });
});
