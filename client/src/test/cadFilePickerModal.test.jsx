import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CadFilePickerModal from '../components/library/CadFilePickerModal';

const queryState = {
  data: [],
  isLoading: false,
};

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => queryState,
}));

describe('CadFilePickerModal', () => {
  beforeEach(() => {
    queryState.data = [];
    queryState.isLoading = false;
  });

  it('does not close when clicking modal backdrop', () => {
    const onClose = vi.fn();
    render(
      <CadFilePickerModal
        isOpen
        onClose={onClose}
        onSelect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('cad-file-picker-backdrop'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('still closes from header close button', () => {
    const onClose = vi.fn();

    render(
      <CadFilePickerModal
        isOpen
        onClose={onClose}
        onSelect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns related pad and 3D model files when selecting a footprint pair', () => {
    queryState.data = [
      {
        id: 'footprint-1',
        file_name: 'SOIC8.psm',
        file_type: 'footprint',
        component_count: 1,
        related_files: [
          { id: 'pad-1', file_name: 'rx51p5y15d0t.pad', file_type: 'pad' },
          { id: 'model-1', file_name: 'SOIC8.step', file_type: 'model' },
        ],
      },
      {
        id: 'footprint-2',
        file_name: 'SOIC8.dra',
        file_type: 'footprint',
        component_count: 1,
        related_files: [
          { id: 'pad-1', file_name: 'rx51p5y15d0t.pad', file_type: 'pad' },
          { id: 'model-1', file_name: 'SOIC8.step', file_type: 'model' },
        ],
      },
    ];

    const onSelect = vi.fn();
    render(
      <CadFilePickerModal
        isOpen
        onClose={vi.fn()}
        onSelect={onSelect}
        fileType="footprint"
      />,
    );

    fireEvent.click(screen.getByText('SOIC8'));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'pair',
      autoFiles: expect.arrayContaining([
        expect.objectContaining({ file_name: 'rx51p5y15d0t.pad', file_type: 'pad' }),
        expect.objectContaining({ file_name: 'SOIC8.step', file_type: 'model' }),
      ]),
    }));
  });

  it('asks for an explicit related-file choice when a footprint has ambiguous pad candidates', () => {
    queryState.data = [
      {
        id: 'footprint-1',
        file_name: 'SOIC8.psm',
        file_type: 'footprint',
        component_count: 1,
        related_files: [
          { id: 'pad-1', file_name: 'one.pad', file_type: 'pad' },
          { id: 'pad-2', file_name: 'two.pad', file_type: 'pad' },
          { id: 'model-1', file_name: 'SOIC8.step', file_type: 'model' },
        ],
      },
      {
        id: 'footprint-2',
        file_name: 'SOIC8.dra',
        file_type: 'footprint',
        component_count: 1,
        related_files: [
          { id: 'pad-1', file_name: 'one.pad', file_type: 'pad' },
          { id: 'pad-2', file_name: 'two.pad', file_type: 'pad' },
          { id: 'model-1', file_name: 'SOIC8.step', file_type: 'model' },
        ],
      },
    ];

    const onSelect = vi.fn();
    render(
      <CadFilePickerModal
        isOpen
        onClose={vi.fn()}
        onSelect={onSelect}
        fileType="footprint"
      />,
    );

    fireEvent.click(screen.getByText('SOIC8'));

    expect(screen.getByText('Choose Related Files')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('two.pad'));
    fireEvent.click(screen.getByRole('button', { name: 'Add Files' }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'pair',
      selectedRelatedFiles: [
        expect.objectContaining({ id: 'pad-2', file_name: 'two.pad', file_type: 'pad' }),
      ],
      autoFiles: expect.arrayContaining([
        expect.objectContaining({ id: 'model-1', file_name: 'SOIC8.step', file_type: 'model' }),
      ]),
    }));
  });

  it('lists a footprint uppercase but hands the stored names to onSelect', () => {
    queryState.data = [
      { id: 'footprint-1', file_name: 'max17761atp.psm', file_type: 'footprint', component_count: 1 },
      { id: 'footprint-2', file_name: 'max17761atp.dra', file_type: 'footprint', component_count: 1 },
    ];

    const onSelect = vi.fn();
    render(
      <CadFilePickerModal
        isOpen
        onClose={vi.fn()}
        onSelect={onSelect}
        fileType="footprint"
      />,
    );

    fireEvent.click(screen.getByText('MAX17761ATP'));

    // The selection feeds a link write (SPEC V63), so every name in the
    // payload must still be the stored lowercase one.
    const payload = onSelect.mock.calls[0][0];
    expect(payload.files.map((file) => file.file_name).sort())
      .toEqual(['max17761atp.dra', 'max17761atp.psm']);
    expect(payload.displayName).toBe('max17761atp');
  });
});