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
  cleanupTempFiles: vi.fn(),
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
    apiMocks.cleanupTempFiles.mockReset().mockResolvedValue({ data: { deleted: 1 } });
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
          { type: fileType, filename: `new.${extension}`, tempFilename: `123-new.${extension}`, cadFileId: `${fileType}-2`, collision: false },
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

  const renderPartialUpload = async () => {
    apiMocks.uploadTempFiles.mockResolvedValue({ data: { results: [
      { type: 'model', filename: 'good.step', tempFilename: 'temp-good.step' },
      { type: 'model', filename: 'retry.step', tempFilename: 'temp-retry.step' },
      { filename: 'broken.step', error: 'Upload rejected' },
    ] } });
    apiMocks.finalizeTempFiles.mockResolvedValueOnce({ data: { results: [
      { type: 'model', filename: 'good.step', tempFilename: 'temp-good.step', cadFileId: 'good-id' },
      { type: 'model', filename: 'retry.step', tempFilename: 'temp-retry.step', error: 'Disk unavailable' },
    ] } });
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<FootprintLinkEditorModal isOpen onClose={onClose} onSave={onSave} relatedFileType="model" initialFiles={[]} />);
    fireEvent.change(screen.getByTestId('footprint-link-upload-input'), { target: { files: [
      new File(['good'], 'good.step'), new File(['retry'], 'retry.step'), new File(['broken'], 'broken.step'),
    ] } });
    await screen.findByText('good.step');
    return { onSave, onClose };
  };

  it('reports partial failures, retains successful selections, and retries only unresolved temp tokens', async () => {
    const { onSave } = await renderPartialUpload();
    expect(screen.getByRole('alert')).toHaveTextContent('retry.step: Disk unavailable');
    expect(showErrorMock).toHaveBeenCalledWith(expect.stringContaining('broken.step: Upload rejected'));
    expect(screen.getByRole('button', { name: 'Save Links' })).toBeDisabled();
    apiMocks.finalizeTempFiles.mockResolvedValueOnce({ data: { results: [
      { type: 'model', filename: 'retry.step', tempFilename: 'temp-retry.step', cadFileId: 'retry-id' },
    ] } });
    fireEvent.click(screen.getByRole('button', { name: 'Retry Failed Uploads' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Links' })).toBeEnabled());
    expect(apiMocks.finalizeTempFiles).toHaveBeenLastCalledWith({ files: [{ tempFilename: 'temp-retry.step', category: 'model' }] });
    expect(apiMocks.uploadTempFiles).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Save Links' }));
    expect(onSave).toHaveBeenCalledWith({ relatedFileType: 'model', addFileIds: ['good-id', 'retry-id'], removeFileIds: [] });
  });

  it('keeps unresolved uploads on cleanup failure and cancels only after their cleanup succeeds', async () => {
    const { onClose } = await renderPartialUpload();
    apiMocks.cleanupTempFiles.mockRejectedValueOnce(new Error('Cleanup unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(showErrorMock).toHaveBeenCalledWith(expect.stringContaining('Cleanup unavailable')));
    expect(onClose).not.toHaveBeenCalled();
    expect(apiMocks.cleanupTempFiles).toHaveBeenLastCalledWith({ tempFilenames: ['temp-retry.step'] });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(apiMocks.cleanupTempFiles).toHaveBeenCalledTimes(2);
  });

  it('can discard failed uploads and save the successful selection', async () => {
    const { onSave, onClose } = await renderPartialUpload();
    fireEvent.click(screen.getByRole('button', { name: 'Discard Failed Uploads' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Links' })).toBeEnabled());
    expect(apiMocks.cleanupTempFiles).toHaveBeenCalledWith({ tempFilenames: ['temp-retry.step'] });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save Links' }));
    expect(onSave).toHaveBeenCalledWith({ relatedFileType: 'model', addFileIds: ['good-id'], removeFileIds: [] });
  });

  it('retains the token when a retry request fails without per-file results', async () => {
    await renderPartialUpload();
    apiMocks.finalizeTempFiles.mockRejectedValueOnce(new Error('Network unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'Retry Failed Uploads' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('retry.step: Network unavailable'));
    expect(screen.getByRole('button', { name: 'Save Links' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Discard Failed Uploads' }));
    await waitFor(() => expect(apiMocks.cleanupTempFiles).toHaveBeenCalledWith({ tempFilenames: ['temp-retry.step'] }));
  });
});
