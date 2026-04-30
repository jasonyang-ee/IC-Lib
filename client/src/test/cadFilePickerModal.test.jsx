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

  it('returns related pad files when selecting a footprint pair', () => {
    queryState.data = [
      {
        id: 'footprint-1',
        file_name: 'SOIC8.psm',
        file_type: 'footprint',
        component_count: 1,
        related_files: [{ id: 'pad-1', file_name: 'rx51p5y15d0t.pad', file_type: 'pad' }],
      },
      {
        id: 'footprint-2',
        file_name: 'SOIC8.dra',
        file_type: 'footprint',
        component_count: 1,
        related_files: [{ id: 'pad-1', file_name: 'rx51p5y15d0t.pad', file_type: 'pad' }],
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
      autoFiles: [expect.objectContaining({ file_name: 'rx51p5y15d0t.pad', file_type: 'pad' })],
    }));
  });
});