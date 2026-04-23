import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2 } from 'lucide-react';
import { api } from '../../utils/api';
import { formatEcoNumber } from '../../utils/ecoNumber';
import { useNotification } from '../../contexts/NotificationContext';
import ApprovalStagesSettings from './ApprovalStagesSettings';

const DEFAULT_ECO_PDF_HEADER = 'Engineer Change Order';

const normalizeEcoPdfBranding = (brandingData) => ({
  eco_logo_filename: brandingData?.eco_logo_filename || '',
  eco_pdf_header_text: brandingData?.eco_pdf_header_text || DEFAULT_ECO_PDF_HEADER,
  eco_complete_notification_email: brandingData?.eco_complete_notification_email || '',
});

const EcoPdfBrandingSettings = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotification();
  const [branding, setBranding] = useState(normalizeEcoPdfBranding());
  const [savedBranding, setSavedBranding] = useState(normalizeEcoPdfBranding());

  const { data: brandingData } = useQuery({
    queryKey: ['ecoPdfBranding'],
    queryFn: async () => {
      const response = await api.getEcoPdfBranding();
      return response.data;
    },
  });

  useEffect(() => {
    if (!brandingData) {
      return;
    }

    const nextBranding = normalizeEcoPdfBranding(brandingData);
    setSavedBranding(nextBranding);
    setBranding(nextBranding);
  }, [brandingData]);

  const saveBrandingMutation = useMutation({
    mutationFn: (data) => api.updateEcoPdfBranding(data),
  });

  const handleBrandingChange = (field, value) => {
    setBranding((prev) => ({ ...prev, [field]: value }));
  };

  const hasPdfBrandingChanges = branding.eco_logo_filename !== savedBranding.eco_logo_filename
    || branding.eco_pdf_header_text !== savedBranding.eco_pdf_header_text;
  const hasNotificationChanges = branding.eco_complete_notification_email !== savedBranding.eco_complete_notification_email;

  const saveBrandingSection = async (updates, successMessage) => {
    try {
      const nextBranding = {
        ...savedBranding,
        ...updates,
      };

      await saveBrandingMutation.mutateAsync(nextBranding);
      setSavedBranding(nextBranding);
      setBranding(nextBranding);
      queryClient.invalidateQueries({ queryKey: ['ecoPdfBranding'] });
      showSuccess(successMessage);
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message;
      showError(`Error saving ECO PDF branding: ${errorMsg}`);
    }
  };

  const handlePdfBrandingSave = () => {
    saveBrandingSection({
      eco_logo_filename: branding.eco_logo_filename,
      eco_pdf_header_text: branding.eco_pdf_header_text,
    }, 'ECO PDF branding saved successfully!');
  };

  const handleNotificationSave = () => {
    saveBrandingSection({
      eco_complete_notification_email: branding.eco_complete_notification_email,
    }, 'ECO complete notification saved successfully!');
  };

  const handlePdfBrandingReset = () => {
    setBranding((prev) => ({
      ...prev,
      eco_logo_filename: savedBranding.eco_logo_filename,
      eco_pdf_header_text: savedBranding.eco_pdf_header_text,
    }));
  };

  const handleNotificationReset = () => {
    setBranding((prev) => ({
      ...prev,
      eco_complete_notification_email: savedBranding.eco_complete_notification_email,
    }));
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
          ECO PDF Branding
        </h3>

        <div className="space-y-4 min-w-0">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Company Logo
            </label>
            <input
              type="text"
              name="eco-logo-filename"
              autoComplete="off"
              value={branding.eco_logo_filename}
              onChange={(e) => handleBrandingChange('eco_logo_filename', e.target.value)}
              placeholder="e.g. company-logo.png"
              className="w-full px-3 py-1.5 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              PDF Header Text
            </label>
            <input
              type="text"
              name="eco-pdf-header-text"
              autoComplete="off"
              value={branding.eco_pdf_header_text}
              onChange={(e) => handleBrandingChange('eco_pdf_header_text', e.target.value)}
              placeholder={DEFAULT_ECO_PDF_HEADER}
              maxLength={200}
              className="w-full px-3 py-1.5 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
            />
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Place the logo image in the container&apos;s /image directory, then enter the filename here. Header text prints beside the logo in ECO PDF exports.
          </p>

          <div className="flex justify-end gap-2">
            {hasPdfBrandingChanges && (
              <button
                onClick={handlePdfBrandingReset}
                className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium transition-colors text-sm"
              >
                Reset
              </button>
            )}
            <button
              onClick={handlePdfBrandingSave}
              disabled={!hasPdfBrandingChanges || saveBrandingMutation.isPending}
              className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-medium rounded-md transition-colors flex items-center gap-1.5 text-sm"
            >
              {saveBrandingMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              Save
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
          ECO Complete Notification
        </h3>

        <div className="space-y-4 min-w-0">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              ECO Complete Notification
            </label>
            <input
              type="email"
              name="eco-complete-notification-email"
              autoComplete="off"
              value={branding.eco_complete_notification_email}
              onChange={(e) => handleBrandingChange('eco_complete_notification_email', e.target.value)}
              placeholder="document.control@example.com"
              className="w-full px-3 py-1.5 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Approved ECO PDFs will be emailed to this document-control address. Leave blank to disable.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            {hasNotificationChanges && (
              <button
                onClick={handleNotificationReset}
                className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium transition-colors text-sm"
              >
                Reset
              </button>
            )}
            <button
              onClick={handleNotificationSave}
              disabled={!hasNotificationChanges || saveBrandingMutation.isPending}
              className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-medium rounded-md transition-colors flex items-center gap-1.5 text-sm"
            >
              {saveBrandingMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const EcoNumberSettings = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotification();
  const [formData, setFormData] = useState({
    prefix: 'ECO-',
    next_number: 1,
  });
  const [hasChanges, setHasChanges] = useState(false);

  const { data: ecoSettings, isLoading } = useQuery({
    queryKey: ['ecoSettings'],
    queryFn: async () => {
      const response = await api.getECOSettings();
      return response.data;
    },
  });

  const { data: previewData } = useQuery({
    queryKey: ['ecoPreview', formData],
    queryFn: async () => {
      const response = await api.previewECONumber();
      return response.data;
    },
    enabled: !hasChanges,
  });

  useEffect(() => {
    if (!ecoSettings) {
      return;
    }

    setFormData({
      prefix: ecoSettings.prefix || 'ECO-',
      next_number: ecoSettings.next_number || 1,
    });
    setHasChanges(false);
  }, [ecoSettings]);

  const saveMutation = useMutation({
    mutationFn: (data) => api.updateECOSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ecoSettings'] });
      queryClient.invalidateQueries({ queryKey: ['ecoPreview'] });
      setHasChanges(false);
      showSuccess('ECO settings saved successfully!');
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.error || error.message;
      showError(`Error saving ECO settings: ${errorMsg}`);
    },
  });

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate({
      prefix: formData.prefix,
      next_number: Number.parseInt(formData.next_number, 10),
    });
  };

  const handleReset = () => {
    if (!ecoSettings) {
      return;
    }

    setFormData({
      prefix: ecoSettings.prefix || 'ECO-',
      next_number: ecoSettings.next_number || 1,
    });
    setHasChanges(false);
  };

  const previewValue = formatEcoNumber(formData.prefix, formData.next_number);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading ECO settings...</span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        ECO Number Settings
      </h2>

      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Configure how Engineering Change Order (ECO) numbers are generated.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Prefix
          </label>
          <input
            type="text"
            name="eco-number-prefix"
            autoComplete="off"
            value={formData.prefix}
            onChange={(e) => handleChange('prefix', e.target.value)}
            maxLength={20}
            className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
            placeholder="ECO-"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Text that appears before the number (max 20 chars)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Next ECO Number
          </label>
          <input
            type="number"
            name="eco-next-number"
            autoComplete="off"
            value={formData.next_number}
            onChange={(e) => handleChange('next_number', Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
            min={1}
            className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            The next sequential number to be assigned
          </p>
        </div>
      </div>

      <div className="mb-6 p-4 bg-gray-50 dark:bg-[#333333] rounded-lg border border-gray-200 dark:border-[#444444]">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Preview Next ECO Number
        </label>
        <div className="text-2xl font-mono font-bold text-primary-600 dark:text-primary-400">
          {previewValue}
        </div>
        {hasChanges && (
          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
            * Preview shows what the next ECO will look like with your unsaved changes
          </p>
        )}
        {!hasChanges && previewData?.preview && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Current setting: {previewData.preview}
          </p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saveMutation.isPending}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-medium rounded-md transition-colors flex items-center gap-2"
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Save Changes
            </>
          )}
        </button>

        {hasChanges && (
          <button
            onClick={handleReset}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium transition-colors"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
};

const ECOSettingsTab = () => (
  <div className="space-y-6">
    <EcoNumberSettings />
    <ApprovalStagesSettings />
    <EcoPdfBrandingSettings />
  </div>
);

export default ECOSettingsTab;