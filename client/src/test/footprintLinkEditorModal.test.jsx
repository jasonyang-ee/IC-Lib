import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FootprintLinkEditorModal from '../components/fileLibrary/FootprintLinkEditorModal';

const queryState = {
  data: [],
  isLoading: false,
  refetch: vi.fn(),
};

const apiMocks = vi.hoisted(() => ({
  getAvailableFiles: vi.fn(),
  uploadTempFiles: vi.fn(),
  finalizeTempFiles: vi.fn(),
}));

const showSuccessMock = vi.fn();
const showErrorMock = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => queryState,
}));

vi.mock('../utils/api', () => ({
  api: apiMocks,
}));

vi.mock('../contexts/NotificationContext', () => ({
  useNotification: () => ({
    showSuccess: showSuccessMock,
    showError: showErrorMock,
  }),
}));

describe('FootprintLinkEditorModal', () => {
  beforeEach(() => {
    queryState.data = [
      { id: 'model-1', file_name: 'existing.step', file_type: 'model', component_count: 1 },
    ];
    queryState.isLoading = false;
    queryState.refetch = vi.fn().mockResolvedValue({ data: queryState.data });
    apiMocks.uploadTempFiles.mockReset();
    apiMocks.finalizeTempFiles.mockReset();
    showSuccessMock.mockReset();
    showErrorMock.mockReset();
  });

  it.each([['model', 'step', '3d model'], ['pad', 'pad', 'pad']])('uploads a new %s file, selects it, and saves the new CAD id', async (fileType, extension, label) => {
    apiMocks.uploadTempFiles.mockResolvedValue({
      data: {
        results: [
          { type: fileType, filename: `new.${extension}`, tempFilename: `123-new.${extension}` },
        ],
      },
    });
    apiMocks.finalizeTempFiles.mockResolvedValue({
      data: {
        results: [
          { type: fileType, filename: `new.${extension}`, cadFileId: `${fileType}-2`, collision: false },
        ],
      },
    });

    const onSave = vi.fn();
    render(
      <FootprintLinkEditorModal
        isOpen
        onClose={vi.fn()}
        onSave={onSave}
        selectedEntry={{ displayName: 'SOIC8' }}
        relatedFileType={fileType}
        initialFiles={[]}
      />,
    );

    const input = screen.getByTestId('footprint-link-upload-input');
    fireEvent.change(input, {
      target: {
        files: [new File(['step'], `new.${extension}`, { type: 'application/step' })],
      },
    });

    await waitFor(() => expect(apiMocks.uploadTempFiles).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(apiMocks.finalizeTempFiles).toHaveBeenCalledWith({
      files: [{ tempFilename: `123-new.${extension}`, category: fileType }],
    }));
    expect(showSuccessMock).toHaveBeenCalledWith(`Added 1 ${label} file`);

    fireEvent.click(screen.getByRole('button', { name: 'Save Links' }));

    expect(onSave).toHaveBeenCalledWith({
      relatedFileType: fileType,
      addFileIds: [`${fileType}-2`],
      removeFileIds: [],
    });
  });
});