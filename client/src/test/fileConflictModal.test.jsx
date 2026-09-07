import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import FileConflictModal from '../components/library/FileConflictModal';

describe('FileConflictModal', () => {
  it('disables both overwrite controls when ECO disallows overwriting', () => {
    render(<FileConflictModal
      conflicts={[{ tempFilename: '100-200-part.psm', category: 'footprint', filename: 'part.psm' }]}
      onResolve={vi.fn()} onAbort={vi.fn()} allowOverwrite={false}
    />);
    expect(screen.getByRole('button', { name: 'Overwrite with new upload' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Overwrite with new upload' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Use existing library file' })).toBeEnabled();
  });
  it('requires explicit abort or resolution instead of header close button', () => {
    render(
      <FileConflictModal
        conflicts={[
          {
            tempFilename: 'temp-symbol-file',
            category: 'symbol',
            filename: 'FT260Q-T.OLB',
          },
        ]}
        onResolve={vi.fn()}
        onAbort={vi.fn()}
        isProcessing={false}
      />,
    );

    expect(screen.queryByLabelText('Close file conflict dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abort' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply & Save' })).toBeInTheDocument();
  });
});
