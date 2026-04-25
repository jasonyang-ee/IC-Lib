import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import CadFilePickerModal from '../components/library/CadFilePickerModal';

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: [],
    isLoading: false,
  }),
}));

describe('CadFilePickerModal', () => {
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
});