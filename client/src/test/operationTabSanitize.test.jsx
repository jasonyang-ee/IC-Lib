import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sanitizeFilenamesMock = vi.fn();

vi.mock('../utils/api', () => ({
  api: {
    sanitizeFilenames: (...args) => sanitizeFilenamesMock(...args),
  },
}));

vi.mock('../contexts/NotificationContext', () => ({
  useNotification: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));

import OperationTab from '../components/settings/tabs/OperationTab';

const renderTab = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <OperationTab />
  </QueryClientProvider>,
);

const runButton = () => screen.getByRole('button', { name: 'Run Filename Sanitization' });
const confirmationInput = () => screen.getByLabelText('Filename sanitization confirmation');

describe('OperationTab filename sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sanitizeFilenamesMock.mockResolvedValue({
      data: {
        renamed: 1,
        skipped: 1,
        failed: 0,
        entries: [
          { fileType: 'footprint', oldName: 'soic8_l.psm', newName: 'soic-8_c.psm', action: 'rename', reason: null },
          { fileType: 'model', oldName: 'part.step', newName: 'part.step', action: 'skip', reason: 'no-package-info' },
        ],
      },
    });
  });

  it('names the shared drive, the OrCAD/CIS consequence, and the backup requirement', () => {
    renderTab();

    expect(screen.getByText(/shared library drive/i)).toBeInTheDocument();
    expect(screen.getByText(/OrCAD\/CIS/)).toBeInTheDocument();
    expect(screen.getByText('BACK UP THE SHARED DRIVE FIRST.')).toBeInTheDocument();
  });

  it('keeps the run button disabled until the exact token is typed', () => {
    renderTab();

    expect(runButton()).toBeDisabled();

    fireEvent.change(confirmationInput(), { target: { value: 'sanitize' } });
    expect(runButton()).toBeDisabled();

    fireEvent.change(confirmationInput(), { target: { value: 'SANIT' } });
    expect(runButton()).toBeDisabled();

    fireEvent.change(confirmationInput(), { target: { value: 'SANITIZE' } });
    expect(runButton()).toBeEnabled();
  });

  it('renders renamed and skipped rows with their reasons after a run', async () => {
    renderTab();

    fireEvent.change(confirmationInput(), { target: { value: 'SANITIZE' } });
    fireEvent.click(runButton());

    expect(await screen.findByText('soic-8_c.psm')).toBeInTheDocument();
    expect(sanitizeFilenamesMock).toHaveBeenCalledWith('SANITIZE');
    expect(screen.getByText('1 renamed, 1 skipped, 0 failed')).toBeInTheDocument();
    expect(screen.getByText('skipped (no-package-info)')).toBeInTheDocument();
  });
});
