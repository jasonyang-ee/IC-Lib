import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import OlbAssignmentModal from '../components/library/OlbAssignmentModal';

describe('OlbAssignmentModal', () => {
  it('moves a staged .olb file between schematic and PSpice panels', () => {
    const onMove = vi.fn();

    render(
      <OlbAssignmentModal
        isOpen
        assignments={[
          { tempFilename: 'temp-1', filename: 'LMV321.olb', assignedCategory: 'symbol' },
        ]}
        onMove={onMove}
        onConfirm={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Move to PSpice Symbol' }));

    expect(onMove).toHaveBeenCalledWith('temp-1', 'pspice');
  });

  it('disables moving a second file into schematic while one is already assigned there', () => {
    render(
      <OlbAssignmentModal
        isOpen
        assignments={[
          { tempFilename: 'temp-1', filename: 'primary.olb', assignedCategory: 'symbol' },
          { tempFilename: 'temp-2', filename: 'secondary.olb', assignedCategory: 'pspice' },
        ]}
        onMove={vi.fn()}
        onConfirm={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Move to Schematic Symbol' })).toBeDisabled();
  });
});