import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getECOSettingsMock = vi.fn();
const previewECONumberMock = vi.fn();
const getEcoPdfBrandingMock = vi.fn();

vi.mock('../utils/api', () => ({
  api: {
    getECOSettings: (...args) => getECOSettingsMock(...args),
    previewECONumber: (...args) => previewECONumberMock(...args),
    getEcoPdfBranding: (...args) => getEcoPdfBrandingMock(...args),
    updateECOSettings: vi.fn(),
    updateEcoPdfBranding: vi.fn(),
  },
}));

vi.mock('../contexts/NotificationContext', () => ({
  useNotification: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
  }),
}));

vi.mock('../components/settings/ApprovalStagesSettings', () => ({
  default: () => <div data-testid="approval-stages-settings" />,
}));

import ECOSettingsTab from '../components/settings/ECOSettingsTab';

const renderComponent = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ECOSettingsTab />
    </QueryClientProvider>,
  );
};

describe('ECOSettingsTab', () => {
  beforeEach(() => {
    getECOSettingsMock.mockReset();
    previewECONumberMock.mockReset();
    getEcoPdfBrandingMock.mockReset();

    getECOSettingsMock.mockResolvedValue({
      data: {
        prefix: 'ECO-',
        next_number: 42,
      },
    });

    previewECONumberMock.mockResolvedValue({
      data: {
        preview: 'ECO-00042',
      },
    });

    getEcoPdfBrandingMock.mockResolvedValue({
      data: {
        eco_logo_filename: 'logo.png',
        eco_pdf_header_text: 'Engineer Change Order',
        eco_complete_notification_email: 'doc.control@example.com',
      },
    });
  });

  it('allows editing ECO branding and notification inputs after loading', async () => {
    renderComponent();

    const companyLogoInput = await screen.findByDisplayValue('logo.png');
    const notificationInput = await screen.findByDisplayValue('doc.control@example.com');

    fireEvent.change(companyLogoInput, { target: { value: 'new-logo.png' } });
    fireEvent.change(notificationInput, { target: { value: 'new-doc.control@example.com' } });

    await waitFor(() => {
      expect(companyLogoInput).toHaveValue('new-logo.png');
      expect(notificationInput).toHaveValue('new-doc.control@example.com');
    });
  });

  it('allows editing ECO number settings without resetting the form', async () => {
    renderComponent();

    const prefixInput = await screen.findByDisplayValue('ECO-');
    const nextNumberInput = await screen.findByDisplayValue(42);

    fireEvent.change(prefixInput, { target: { value: 'EECO-' } });
    fireEvent.change(nextNumberInput, { target: { value: '77' } });

    await waitFor(() => {
      expect(prefixInput).toHaveValue('EECO-');
      expect(nextNumberInput).toHaveValue(77);
    });
  });
});