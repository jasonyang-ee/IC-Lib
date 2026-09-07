import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectPersistedCadSelections, getSelectedRelatedCadFiles, getUniqueRelatedAutoFiles } from '../utils/cadFileRelatedLinks';
import ComponentFiles from '../components/library/ComponentFiles';

const { api, notifications } = vi.hoisted(() => ({
  api: {
    listComponentFiles: vi.fn(), getAvailableFiles: vi.fn(), linkFileToComponent: vi.fn(),
    deleteComponentFile: vi.fn(), cleanupTempFiles: vi.fn(), uploadTempFiles: vi.fn(),
    getFileExportUrl: vi.fn(() => '/export'), getFileDownloadUrl: vi.fn(() => '/download'),
  },
  notifications: { showSuccess: vi.fn(), showError: vi.fn() },
}));
vi.mock('../utils/api', () => ({ api }));
vi.mock('../contexts/NotificationContext', () => ({ useNotification: () => notifications }));

const cad = (id, file_name, file_type) => ({ id, file_name, file_type });
const oldModel = cad('old', 'old.step', 'model');
const model = cad('model', 'new.step', 'model');
const pad = cad('pad', 'chosen.pad', 'pad');
const otherPad = cad('other-pad', 'other.pad', 'pad');
const otherModel = cad('other-model', 'other.step', 'model');
const pair = [cad('psm', 'new.psm', 'footprint'), cad('dra', 'new.dra', 'footprint')];
let available;
let serverFiles;

const openCategory = async (label) => {
  fireEvent.click(await screen.findByRole('button', { name: `Link existing ${label} file` }));
};
const selectPair = async ({ choose = true, name = 'NEW' } = {}) => {
  await openCategory('Footprint');
  fireEvent.click(await screen.findByText(name, { exact: true }));
  if (screen.queryByText('Choose Related Files')) {
    if (choose) {
      fireEvent.click(screen.getByLabelText('chosen.pad'));
      fireEvent.click(screen.getByLabelText('new.step'));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Add Files' }));
  }
};
const renderSelection = async (mode, occupied = false) => {
  const utils = {
    onFileUploaded: vi.fn(), onCadFileAdded: vi.fn(), onCadFileRemoved: vi.fn(),
    onFileDeleted: vi.fn(), onCadSelectionChange: vi.fn(),
    onTempFileStaged: vi.fn(), onTempFileRemoved: vi.fn(),
  };
  if (occupied && mode !== 'add') serverFiles = { model: [{ ...oldModel, name: oldModel.file_name }] };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={queryClient}>
    <ComponentFiles mfgPartNumber="PART" componentId={mode === 'add' ? undefined : 'component'}
      ecoMode={mode === 'eco'} canEdit {...utils} />
  </QueryClientProvider>);
  await screen.findByText('Footprint', { selector: 'p' });
  if (occupied && mode === 'add') {
    await openCategory('3D Model');
    fireEvent.click(await screen.findByText('old.step', { exact: true }));
    await waitFor(() => expect(utils.onCadFileAdded).toHaveBeenCalledWith({ category: 'model', filename: 'old.step' }));
    utils.onFileUploaded.mockClear();
    utils.onCadFileAdded.mockClear();
  }
  return utils;
};

describe('ComponentFiles rendered selection orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverFiles = {};
    available = [...pair.map((file) => ({ ...file, related_files: [pad, otherPad, model, otherModel] })), oldModel];
    api.listComponentFiles.mockImplementation(async () => ({ data: { files: structuredClone(serverFiles) } }));
    api.getAvailableFiles.mockImplementation(async () => ({ data: { files: available } }));
    api.linkFileToComponent.mockImplementation(async (id) => {
      const file = [...pair, pad, model, oldModel].find((item) => item.id === id);
      serverFiles[file.file_type] = [...(serverFiles[file.file_type] || []).filter((item) => item.id !== id), { ...file, name: file.file_name }];
      return { data: { linkedCadFiles: [file] } };
    });
    api.deleteComponentFile.mockImplementation(async (category, _mpn, filename) => {
      serverFiles[category] = (serverFiles[category] || []).filter((file) => file.name !== filename);
      return { data: {} };
    });
    api.cleanupTempFiles.mockResolvedValue({ data: {} });
    api.uploadTempFiles.mockResolvedValue({ data: { results: [
      { type: 'model', filename: 'old.step', tempFilename: 'temp-old.step' },
    ] } });
  });

  it('stages explicit ambiguous pad/model choices exactly once without live ECO writes', async () => {
    const utils = await renderSelection('eco');
    await selectPair();
    await waitFor(() => expect(utils.onCadFileAdded).toHaveBeenCalledTimes(4));
    expect(utils.onCadFileAdded.mock.calls.map(([file]) => file.filename).sort()).toEqual(['chosen.pad', 'new.dra', 'new.psm', 'new.step']);
    expect(api.linkFileToComponent).not.toHaveBeenCalled();
    expect(api.deleteComponentFile).not.toHaveBeenCalled();
  });

  it('honors Skip for ambiguous related candidates', async () => {
    const utils = await renderSelection('eco');
    await selectPair({ choose: false });
    await waitFor(() => expect(utils.onCadFileAdded).toHaveBeenCalledTimes(2));
    expect(utils.onCadFileAdded.mock.calls.map(([file]) => file.filename).sort()).toEqual(['new.dra', 'new.psm']);
  });

  it('retains manually chosen pads across multiple footprint selections', async () => {
    const secondPair = [cad('second-psm', 'second.psm', 'footprint'), cad('second-dra', 'second.dra', 'footprint')];
    available.push(...secondPair.map((file) => ({ ...file, related_files: [pad, otherPad] })));
    const utils = await renderSelection('eco');
    await selectPair();
    await openCategory('Footprint');
    fireEvent.click(await screen.findByText('SECOND', { exact: true }));
    fireEvent.click(screen.getByLabelText('other.pad'));
    fireEvent.click(screen.getByRole('button', { name: 'Add Files' }));
    await waitFor(() => expect(utils.onCadFileAdded).toHaveBeenCalledTimes(7));
    const saved = utils.onCadSelectionChange.mock.lastCall[0];
    expect(saved.map((file) => file.id).sort()).toEqual([...pair, ...secondPair, pad, otherPad, model].map((file) => file.id).sort());
    expect(api.linkFileToComponent).not.toHaveBeenCalled();
  });

  it('cancels the related-file picker without staging changes', async () => {
    const utils = await renderSelection('eco');
    await openCategory('Footprint');
    fireEvent.click(await screen.findByText('NEW', { exact: true }));
    const picker = screen.getByTestId('cad-file-picker-backdrop');
    fireEvent.click(within(picker).getAllByRole('button')[0]);
    expect(utils.onCadFileAdded).not.toHaveBeenCalled();
    expect(api.linkFileToComponent).not.toHaveBeenCalled();
  });

  it('stages unique learned files but leaves an occupied related type alone', async () => {
    available = pair.map((file) => ({ ...file, related_files: [pad, model] }));
    const utils = await renderSelection('eco', true);
    await selectPair();
    await waitFor(() => expect(utils.onCadFileAdded).toHaveBeenCalledTimes(3));
    expect(utils.onCadFileAdded.mock.calls.map(([file]) => file.filename).sort()).toEqual(['chosen.pad', 'new.dra', 'new.psm']);
    expect(utils.onCadFileRemoved).not.toHaveBeenCalled();
  });

  it.each(['add', 'direct', 'eco'].flatMap((mode) => ['Use New File', 'Keep Original', 'cancel'].map((decision) => [mode, decision])))(
    '%s mode retains the complete selection for %s', async (mode, decision) => {
      const utils = await renderSelection(mode, true);
      await selectPair();
      expect(utils.onCadFileAdded).not.toHaveBeenCalled();
      expect(api.deleteComponentFile).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: decision === 'cancel' ? 'Close file replacement dialog' : decision }));
      await waitFor(() => expect(screen.queryByText('Keep Original')).not.toBeInTheDocument());
      const expected = decision === 'cancel' ? [] : decision === 'Use New File' ? [...pair, pad, model] : [...pair, pad];
      expect(utils.onCadFileAdded.mock.calls.map(([file]) => file.filename).sort()).toEqual(expected.map((file) => file.file_name).sort());
      const directIds = mode === 'direct' ? expected.map((file) => file.id) : [];
      expect(api.linkFileToComponent.mock.calls.map(([id]) => id).sort()).toEqual(directIds.sort());
      expect(api.deleteComponentFile).toHaveBeenCalledTimes(mode === 'direct' && decision === 'Use New File' ? 1 : 0);
      expect(utils.onCadFileRemoved).toHaveBeenCalledTimes(decision === 'Use New File' ? 1 : 0);
      const saved = utils.onCadSelectionChange.mock.lastCall[0];
      const retainedLocal = mode === 'add' && decision !== 'Use New File' ? [oldModel] : [];
      expect(saved.map((file) => file.id).sort()).toEqual([...expected, ...retainedLocal].map((file) => file.id).sort());
      expect(saved.filter((file) => file.file_type === 'model')).toHaveLength(decision === 'Use New File' || retainedLocal.length ? 1 : 0);
    },
  );

  it('reports failed direct linking without publishing success, even with repeated confirmation', async () => {
    const utils = await renderSelection('direct', true);
    await selectPair();
    let rejectLink;
    api.linkFileToComponent.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectLink = reject; }));
    const button = screen.getByRole('button', { name: 'Use New File' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(api.linkFileToComponent).toHaveBeenCalledTimes(1));
    rejectLink(new Error('link unavailable'));
    await waitFor(() => expect(notifications.showError).toHaveBeenCalled());
    expect(api.deleteComponentFile).toHaveBeenCalledTimes(1);
    expect(utils.onCadFileAdded).not.toHaveBeenCalled();
    expect(notifications.showSuccess).not.toHaveBeenCalled();
    expect(utils.onCadFileRemoved).toHaveBeenCalledWith({ category: 'model', filename: 'old.step' });
  });

  it.each(['add', 'direct', 'eco'])('removes the replaced temp token from %s save state', async (mode) => {
    const utils = await renderSelection(mode);
    fireEvent.drop(screen.getByText('Drag and drop files here, or click to browse'), {
      dataTransfer: { files: [new File(['model'], 'old.step')] },
    });
    await waitFor(() => expect(utils.onTempFileStaged).toHaveBeenCalledWith({ category: 'model', filename: 'old.step', tempFilename: 'temp-old.step' }));
    utils.onCadFileAdded.mockClear();
    await selectPair();
    fireEvent.click(screen.getByRole('button', { name: 'Use New File' }));
    await waitFor(() => expect(utils.onCadFileAdded).toHaveBeenCalledTimes(4));
    expect(api.cleanupTempFiles).toHaveBeenCalledWith({ tempFilenames: ['temp-old.step'] });
    expect(utils.onTempFileRemoved).toHaveBeenCalledWith('temp-old.step');
    expect(api.deleteComponentFile).not.toHaveBeenCalled();
    expect(utils.onCadSelectionChange.mock.lastCall[0].map((file) => file.id).sort()).toEqual([...pair, pad, model].map((file) => file.id).sort());
  });
});

describe('ComponentFiles Link Existing preview', () => {
  it('previews one unique related file per type for an unsaved part', () => {
    expect(getUniqueRelatedAutoFiles(
      [{ id: 'footprint-1', file_type: 'footprint' }],
      [
        { id: 'pad-1', file_name: 'one.pad', file_type: 'pad', missing: false },
        { id: 'model-1', file_name: 'one.step', file_type: 'model', missing: false },
      ],
      { footprint: [{ name: 'footprint.psm' }] },
    )).toEqual([
      { id: 'pad-1', file_name: 'one.pad', file_type: 'pad', missing: false },
      { id: 'model-1', file_name: 'one.step', file_type: 'model', missing: false },
    ]);
  });

  it('skips ambiguous and already occupied related types', () => {
    expect(getUniqueRelatedAutoFiles(
      [{ id: 'footprint-1', file_type: 'footprint' }],
      [
        { id: 'pad-1', file_name: 'one.pad', file_type: 'pad', missing: false },
        { id: 'pad-2', file_name: 'two.pad', file_type: 'pad', missing: false },
        { id: 'model-1', file_name: 'missing.step', file_type: 'model', missing: true },
        { id: 'model-2', file_name: 'one.step', file_type: 'model', missing: false },
      ],
      { footprint: [{ name: 'footprint.psm' }], model: [{ name: 'existing.step' }] },
    )).toEqual([]);
  });

  it('keeps explicit ambiguous choices alongside any unique auto-linked files', () => {
    expect(getSelectedRelatedCadFiles(
      [{ id: 'footprint-1', file_type: 'footprint' }],
      [
        { id: 'pad-1', file_name: 'one.pad', file_type: 'pad', missing: false },
        { id: 'pad-2', file_name: 'two.pad', file_type: 'pad', missing: false },
        { id: 'model-1', file_name: 'one.step', file_type: 'model', missing: false },
      ],
      [
        { id: 'pad-2', file_name: 'two.pad', file_type: 'pad', missing: false },
      ],
      { footprint: [{ name: 'footprint.psm' }] },
    )).toEqual([
      { id: 'model-1', file_name: 'one.step', file_type: 'model', missing: false },
      { id: 'pad-2', file_name: 'two.pad', file_type: 'pad', missing: false },
    ]);
  });

  it('collects only persisted existing-file selections for add-mode save', () => {
    expect(collectPersistedCadSelections({
      footprint: [
        { id: 'footprint-1', name: 'SOIC8.psm', file_type: 'footprint' },
        { id: 'footprint-2', name: 'SOIC8.dra', file_type: 'footprint' },
      ],
      model: [
        { id: 'model-1', name: 'SOIC8.step', file_type: 'model' },
        { id: 'model-temp', name: 'temp.step', file_type: 'model', tempFilename: '123-temp.step' },
      ],
      pad: [
        { id: 'pad-1', file_name: 'rx51p5y15d0t.pad', file_type: 'pad' },
      ],
    })).toEqual([
      { id: 'footprint-1', file_name: 'SOIC8.psm', file_type: 'footprint' },
      { id: 'footprint-2', file_name: 'SOIC8.dra', file_type: 'footprint' },
      { id: 'model-1', file_name: 'SOIC8.step', file_type: 'model' },
      { id: 'pad-1', file_name: 'rx51p5y15d0t.pad', file_type: 'pad' },
    ]);
  });
});
