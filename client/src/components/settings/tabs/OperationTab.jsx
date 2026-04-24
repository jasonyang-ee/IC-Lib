import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle, Database, Download, Loader2, Package, Trash2, Upload, Users } from 'lucide-react';
import { ConfirmationModal } from '../../common';
import { api } from '../../../utils/api';
import { useNotification } from '../../../contexts/NotificationContext';

const OPERATION_CONFIRMATIONS = {
  verify: {
    title: 'Verify Database',
    message: 'This verifies database schema against expected structure. Continue?',
    confirmText: 'Verify',
    confirmStyle: 'primary',
  },
  'init-settings': {
    title: 'Init Categories',
    message: 'This initializes default categories, distributors, specifications, and ECO defaults. Existing data is preserved. Continue?',
    confirmText: 'Initialize',
    confirmStyle: 'primary',
  },
  reset: {
    title: 'Full Database Reset',
    message: 'WARNING: This drops all tables and recreates schema. All data will be permanently lost. This cannot be undone.',
    confirmText: 'Delete Everything',
    confirmStyle: 'danger',
  },
  'delete-parts': {
    title: 'Delete Parts and Project Data',
    message: 'This deletes all component parts, ECO orders, projects, and activity logs. Categories, specifications, users, and settings stay intact.',
    confirmText: 'Delete Parts Data',
    confirmStyle: 'danger',
  },
  'delete-users': {
    title: 'Delete User Records',
    message: 'This deletes all user accounts except admin and guest. This cannot be undone.',
    confirmText: 'Delete Users',
    confirmStyle: 'danger',
  },
};

const OperationTab = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotification();
  const [showAdvancedOps, setShowAdvancedOps] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [pendingImportFile, setPendingImportFile] = useState(null);

  const closePendingAction = () => setPendingAction(null);
  const closePendingImportFile = () => setPendingImportFile(null);

  const verifyDbMutation = useMutation({
    mutationFn: async () => api.verifyDatabase(),
    onSuccess: (data) => {
      const message = data.data.valid
        ? 'Database schema verified successfully!'
        : `Schema verification failed: ${data.data.issues?.join(', ')}`;
      closePendingAction();
      if (data.data.valid) {
        showSuccess(message);
        return;
      }
      showError(message);
    },
    onError: (error) => {
      closePendingAction();
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      showError(errorMsg);
    },
  });

  const resetDbMutation = useMutation({
    mutationFn: async () => api.resetDatabase(true),
    onSuccess: () => {
      closePendingAction();
      showSuccess('Database reset completed! All tables dropped and schema reinitialized.');
      queryClient.invalidateQueries({ queryKey: ['categoryConfigs'] });
    },
    onError: (error) => {
      closePendingAction();
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      showError(`Error resetting database: ${errorMsg}`);
    },
  });

  const initSettingsMutation = useMutation({
    mutationFn: async () => api.initSettings(),
    onSuccess: () => {
      closePendingAction();
      showSuccess('Default categories, distributors, and specifications initialized successfully!');
      queryClient.invalidateQueries({ queryKey: ['categoryConfigs'] });
    },
    onError: (error) => {
      closePendingAction();
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      showError(`Error initializing settings: ${errorMsg}`);
    },
  });

  const deletePartsMutation = useMutation({
    mutationFn: async () => api.deletePartsData(true),
    onSuccess: () => {
      closePendingAction();
      showSuccess('Parts and project data deleted. Categories, users, and settings preserved.');
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      closePendingAction();
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      showError(`Error deleting parts data: ${errorMsg}`);
    },
  });

  const deleteUsersMutation = useMutation({
    mutationFn: async () => api.deleteUserRecords(true),
    onSuccess: () => {
      closePendingAction();
      showSuccess('User records deleted. Admin and guest accounts preserved.');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => {
      closePendingAction();
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      showError(`Error deleting user records: ${errorMsg}`);
    },
  });

  const exportDbMutation = useMutation({
    mutationFn: async () => {
      const response = await api.exportDatabase();
      return response.data;
    },
    onSuccess: (blob) => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `iclib-backup-${timestamp}.json.gz`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      showSuccess('Database exported successfully');
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      showError(`Export failed: ${errorMsg}`);
    },
  });

  const importDbMutation = useMutation({
    mutationFn: async (file) => {
      const response = await api.importDatabase(file);
      return response.data;
    },
    onSuccess: (data) => {
      closePendingImportFile();
      showSuccess(data.message || 'Database imported successfully');
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      closePendingImportFile();
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      showError(`Import failed: ${errorMsg}`);
    },
  });

  const handleConfirmAction = () => {
    if (pendingAction === 'verify') {
      verifyDbMutation.mutate();
      return;
    }
    if (pendingAction === 'init-settings') {
      initSettingsMutation.mutate();
      return;
    }
    if (pendingAction === 'reset') {
      resetDbMutation.mutate();
      return;
    }
    if (pendingAction === 'delete-parts') {
      deletePartsMutation.mutate();
      return;
    }
    if (pendingAction === 'delete-users') {
      deleteUsersMutation.mutate();
    }
  };

  const getPendingState = () => {
    if (pendingAction === 'verify') {
      return verifyDbMutation.isPending;
    }
    if (pendingAction === 'init-settings') {
      return initSettingsMutation.isPending;
    }
    if (pendingAction === 'reset') {
      return resetDbMutation.isPending;
    }
    if (pendingAction === 'delete-parts') {
      return deletePartsMutation.isPending;
    }
    if (pendingAction === 'delete-users') {
      return deleteUsersMutation.isPending;
    }
    return false;
  };

  const pendingConfirmation = pendingAction ? OPERATION_CONFIRMATIONS[pendingAction] : null;

  return (
    <>
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Database Operations</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <button
            onClick={() => setPendingAction('verify')}
            disabled={verifyDbMutation.isPending}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {verifyDbMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Verify Schema
              </>
            )}
          </button>
          <button
            onClick={() => setPendingAction('init-settings')}
            disabled={initSettingsMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {initSettingsMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Initializing...
              </>
            ) : (
              <>
                <Package className="w-4 h-4" />
                Init Categories
              </>
            )}
          </button>
          <button
            onClick={() => exportDbMutation.mutate()}
            disabled={exportDbMutation.isPending}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {exportDbMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export Database
              </>
            )}
          </button>
          <label className={`bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer ${importDbMutation.isPending ? 'opacity-50 pointer-events-none' : ''}`}>
            {importDbMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Import Database
              </>
            )}
            <input
              type="file"
              accept=".gz,.json.gz"
              className="hidden"
              disabled={importDbMutation.isPending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  setPendingImportFile(file);
                }
                event.target.value = '';
              }}
            />
          </label>
        </div>

        <div className="border-t border-gray-200 dark:border-[#3a3a3a] pt-4">
          <button
            onClick={() => setShowAdvancedOps((current) => !current)}
            className="w-full bg-linear-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-2 border-orange-300 dark:border-orange-700 hover:border-orange-400 dark:hover:border-orange-600 rounded-lg p-4 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 dark:bg-orange-900/30 rounded-full p-2">
                  <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="text-left">
                  <h4 className="font-semibold text-orange-900 dark:text-orange-200 text-base">Advanced Operations</h4>
                  <p className="text-xs text-orange-700 dark:text-orange-300 mt-0.5">
                    {showAdvancedOps ? 'Hide dangerous operations' : 'Show database management and destructive operations'}
                  </p>
                </div>
              </div>
              <span className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                {showAdvancedOps ? 'Hide' : 'Show'}
              </span>
            </div>
          </button>

          {showAdvancedOps && (
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4 mt-4 animate-fadeIn">
              <div className="flex items-start gap-3 mb-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-900 dark:text-red-200 mb-1">Danger Zone</h4>
                  <p className="text-sm text-red-800 dark:text-red-300 mb-3">
                    These operations permanently delete data. Use with caution.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => setPendingAction('reset')}
                  disabled={resetDbMutation.isPending}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {resetDbMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Resetting Database...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4" />
                      Full Database Reset (Drop All Tables)
                    </>
                  )}
                </button>
                <button
                  onClick={() => setPendingAction('delete-parts')}
                  disabled={deletePartsMutation.isPending}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {deletePartsMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting Parts Data...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete Parts and Project Data
                    </>
                  )}
                </button>
                <button
                  onClick={() => setPendingAction('delete-users')}
                  disabled={deleteUsersMutation.isPending}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {deleteUsersMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting User Records...
                    </>
                  ) : (
                    <>
                      <Users className="w-4 h-4" />
                      Delete User Records
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <strong>Verify Schema:</strong> Checks required tables exist and match expected schema.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <strong>Init Categories:</strong> Loads default categories, distributors, specifications, and ECO defaults. Safe to run repeatedly.
          </p>
          <p className="text-sm text-red-600 dark:text-red-400">
            <strong>Full Database Reset:</strong> Drops all tables and recreates schema. All data is lost.
          </p>
          <p className="text-sm text-red-600 dark:text-red-400">
            <strong>Delete Parts and Project Data:</strong> Removes all components, ECOs, projects, and logs. Preserves categories, users, and settings.
          </p>
          <p className="text-sm text-red-600 dark:text-red-400">
            <strong>Delete User Records:</strong> Removes all users except admin and guest.
          </p>
        </div>
      </div>

      <ConfirmationModal
        isOpen={Boolean(pendingConfirmation)}
        onClose={closePendingAction}
        onConfirm={handleConfirmAction}
        title={pendingConfirmation?.title || 'Confirm operation'}
        message={pendingConfirmation?.message || ''}
        confirmText={pendingConfirmation?.confirmText || 'Confirm'}
        confirmStyle={pendingConfirmation?.confirmStyle || 'primary'}
        isLoading={getPendingState()}
      />

      <ConfirmationModal
        isOpen={Boolean(pendingImportFile)}
        onClose={closePendingImportFile}
        onConfirm={() => importDbMutation.mutate(pendingImportFile)}
        title="Import Database"
        message="This replaces all existing database data with selected backup file. Continue?"
        confirmText="Import"
        confirmStyle="warning"
        isLoading={importDbMutation.isPending}
      />
    </>
  );
};

export default OperationTab;