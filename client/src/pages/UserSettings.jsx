import { useState, useEffect } from 'react';
import { User, Key, AlertCircle, CheckCircle, Loader2, Mail, Bell, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';

const UserSettings = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  
  // Password change state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');

  // Profile state
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    email: '',
    displayName: ''
  });

  // Notification preferences state
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState({
    eco_submitted: true,
    eco_approved: true,
    eco_rejected: true,
    eco_assigned: true
  });

  // Load profile data on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await api.getProfile();
        const profile = response.data;
        setProfileForm({
          email: profile.email || '',
          displayName: profile.displayName || ''
        });
        setNotificationPreferences(profile.notificationPreferences || {
          eco_submitted: true,
          eco_approved: true,
          eco_rejected: true,
          eco_assigned: true
        });
      } catch (error) {
        console.error('Failed to load profile:', error);
        showError('Failed to load profile settings');
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadProfile();
  }, [showError]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);

    try {
      await api.updateProfile({
        email: profileForm.email || null,
        displayName: profileForm.displayName || null
      });
      showSuccess('Profile updated successfully');
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message;
      showError(`Failed to update profile: ${errorMsg}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleNotificationSave = async () => {
    setIsSavingNotifications(true);

    try {
      await api.updateNotificationPreferences(notificationPreferences);
      showSuccess('Notification preferences updated');
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message;
      showError(`Failed to update notifications: ${errorMsg}`);
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const handleNotificationChange = (key) => {
    setNotificationPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');

    // Validation
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setIsChangingPassword(true);

    try {
      await api.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });

      showSuccess('Password changed successfully!');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setPasswordError('');
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message;
      setPasswordError(errorMsg);
      showError(`Failed to change password: ${errorMsg}`);
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">User Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage your account settings and preferences
        </p>
      </div>

      {isLoadingProfile ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Account Information */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
            <div className="flex items-center gap-3 mb-6">
              <User className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Account Information</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Username
                </label>
                <div className="px-4 py-3 bg-gray-100 dark:bg-[#333333] rounded-lg text-gray-900 dark:text-gray-100">
                  {user?.username}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Username cannot be changed. Contact an administrator if you need to change it.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <div className="px-4 py-3 bg-gray-100 dark:bg-[#333333] rounded-lg">
                  <span className={`inline-flex px-2 py-1 text-xs rounded-full font-medium ${
                    user?.role === 'admin'
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                      : user?.role === 'read-write'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                  }`}>
                    {user?.role?.replace('-', ' ')}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Your role determines your access permissions in the system.
                </p>
              </div>
            </div>
          </div>

          {/* Profile Settings */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
            <div className="flex items-center gap-3 mb-6">
              <Mail className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Profile Settings</h2>
            </div>

            <form onSubmit={handleProfileSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={profileForm.displayName}
                  onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                  placeholder="Your display name"
                  maxLength={100}
                  disabled={isSavingProfile}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  How your name appears in notifications and activity logs.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                  placeholder="your.email@example.com"
                  disabled={isSavingProfile}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Used for email notifications when SMTP is configured.
                </p>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="btn-primary disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSavingProfile ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Profile
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Notification Preferences */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
            <div className="flex items-center gap-3 mb-6">
              <Bell className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Notification Preferences</h2>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Choose which notifications you want to receive via email. Requires SMTP configuration and a valid email address.
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-[#3a3a3a]">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">ECO Submitted</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Notify when an ECO is submitted for your approval</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationPreferences.eco_submitted}
                    onChange={() => handleNotificationChange('eco_submitted')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-[#3a3a3a]">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">ECO Approved</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Notify when your ECO is approved</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationPreferences.eco_approved}
                    onChange={() => handleNotificationChange('eco_approved')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-[#3a3a3a]">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">ECO Rejected</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Notify when your ECO is rejected</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationPreferences.eco_rejected}
                    onChange={() => handleNotificationChange('eco_rejected')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">ECO Assigned</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Notify when assigned as an ECO approver</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationPreferences.eco_assigned}
                    onChange={() => handleNotificationChange('eco_assigned')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-6">
              <button
                type="button"
                onClick={handleNotificationSave}
                disabled={isSavingNotifications}
                className="btn-primary disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSavingNotifications ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Preferences
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Change Password */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
            <div className="flex items-center gap-3 mb-6">
              <Key className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Change Password</h2>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              {passwordError && (
                <div className="flex items-center gap-2 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span className="text-sm">{passwordError}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Current Password *
                </label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                  placeholder="Enter your current password"
                  disabled={isChangingPassword}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New Password *
                </label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                  placeholder="Enter new password (minimum 6 characters)"
                  disabled={isChangingPassword}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                  placeholder="Re-enter new password"
                  disabled={isChangingPassword}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    setPasswordError('');
                  }}
                  className="btn-secondary"
                  disabled={isChangingPassword}
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="btn-primary disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isChangingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Changing Password...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Change Password
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserSettings;
