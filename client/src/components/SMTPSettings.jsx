import { useState, useEffect } from 'react';
import { Mail, Send, CheckCircle, Loader2 } from 'lucide-react';
import { api } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';

export default function SMTPSettings() {
  const { showSuccess, showError } = useNotification();
  
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    host: '',
    port: 587,
    secure: false,
    no_auth: false,
    auth_user: '',
    auth_password: '',
    from_address: '',
    from_name: 'IC-Lib System',
    enabled: true
  });

  // Load existing settings
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.smtp.get();
      if (response.data.configured) {
        setConfigured(true);
        setFormData({
          ...response.data.settings,
          auth_password: '' // Don't show password
        });
      }
    } catch (error) {
      console.error('Failed to load SMTP settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // If toggling no_auth, clear username/password
    if (name === 'no_auth' && checked) {
      setFormData(prev => ({
        ...prev,
        no_auth: true,
        auth_user: '',
        auth_password: ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleTestConnection = async () => {
    if (!formData.host || !formData.port) {
      showError('Please fill in host and port');
      return;
    }

    setTesting(true);
    try {
      await api.smtp.test({
        host: formData.host,
        port: parseInt(formData.port),
        secure: formData.secure,
        no_auth: formData.no_auth,
        auth_user: formData.auth_user,
        auth_password: formData.auth_password
      });
      showSuccess('SMTP connection successful');
    } catch (error) {
      showError(error.response?.data?.details || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!formData.host || !formData.port || !formData.from_address) {
      showError('Please fill in host, port, and from address');
      return;
    }

    setSaving(true);
    try {
      const payload = { ...formData, port: parseInt(formData.port) };
      await api.smtp.post(payload);
      showSuccess('SMTP settings saved successfully');
      setConfigured(true);
      loadSettings();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    setSendingTest(true);
    try {
      const response = await api.smtp.testEmail();
      showSuccess(response.data.message);
    } catch (error) {
      showError(error.response?.data?.details || 'Failed to send test email');
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Email Settings (SMTP)
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Configure outbound email server for sending ECO notifications and reports
        </p>
      </div>

      {/* SMTP Configuration Form */}
      <div className="bg-gray-50 dark:bg-[#333333] rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Host */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              SMTP Host *
            </label>
            <input
              type="text"
              name="host"
              value={formData.host}
              onChange={handleChange}
              placeholder="smtp.example.com"
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-lg bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Port */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Port *
            </label>
            <input
              type="number"
              name="port"
              value={formData.port}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-lg bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* No Auth Toggle */}
          <div className="col-span-2">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                name="no_auth"
                checked={formData.no_auth}
                onChange={handleChange}
                className="rounded"
              />
              No Authentication (Open Relay Server)
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
              Enable this if your SMTP server does not require username/password
            </p>
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Username {formData.no_auth && '(disabled)'}
            </label>
            <input
              type="text"
              name="auth_user"
              value={formData.auth_user}
              onChange={handleChange}
              disabled={formData.no_auth}
              placeholder={formData.no_auth ? 'No authentication required' : 'Username'}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-lg bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-[#1a1a1a] disabled:cursor-not-allowed"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password {formData.no_auth && '(disabled)'}
            </label>
            <input
              type="password"
              name="auth_password"
              value={formData.auth_password}
              onChange={handleChange}
              disabled={formData.no_auth}
              placeholder={formData.no_auth ? 'No authentication required' : (configured ? 'Enter new password to change' : 'Password')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-lg bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-[#1a1a1a] disabled:cursor-not-allowed"
            />
          </div>

          {/* From Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              From Address *
            </label>
            <input
              type="email"
              name="from_address"
              value={formData.from_address}
              onChange={handleChange}
              placeholder="noreply@example.com"
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-lg bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* From Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              From Name
            </label>
            <input
              type="text"
              name="from_name"
              value={formData.from_name}
              onChange={handleChange}
              placeholder="IC-Lib System"
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-lg bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        {/* Checkboxes */}
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              name="secure"
              checked={formData.secure}
              onChange={handleChange}
              className="rounded"
            />
            Use TLS/SSL (port 465)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              name="enabled"
              checked={formData.enabled}
              onChange={handleChange}
              className="rounded"
            />
            Enable email notifications
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-[#444444]">
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Test Connection
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Save Settings
          </button>
        </div>
      </div>

      {/* Test Email Section */}
      {configured && formData.enabled && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 space-y-4">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100">Test Email</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Send a test email to verify the configuration
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleSendTestEmail}
              disabled={sendingTest}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {sendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Test Email
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
