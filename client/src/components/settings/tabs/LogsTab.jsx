import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FileText, Trash2 } from 'lucide-react';
import { ConfirmationModal } from '../../common';
import { api } from '../../../utils/api';
import { useNotification } from '../../../contexts/NotificationContext';

const LogsTab = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotification();
  const [showConfirmation, setShowConfirmation] = useState(false);

  const clearAuditLogsMutation = useMutation({
    mutationFn: async () => api.clearAuditLogs(),
    onSuccess: (data) => {
      setShowConfirmation(false);
      showSuccess(data.data.message || 'Audit logs cleared successfully!');
      queryClient.invalidateQueries({ queryKey: ['auditLog'] });
    },
    onError: (error) => {
      setShowConfirmation(false);
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      showError(`Error clearing audit logs: ${errorMsg}`);
    },
  });

  return (
    <>
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Audit Logs Management</h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Clear all audit log entries. This permanently deletes activity history from database.
        </p>
        <button
          onClick={() => setShowConfirmation(true)}
          disabled={clearAuditLogsMutation.isPending}
          className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          Clear All Audit Logs
        </button>
      </div>

      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={() => clearAuditLogsMutation.mutate()}
        title="Clear Audit Logs"
        message="Are you sure you want to clear all audit logs? This permanently deletes all activity history and cannot be undone."
        confirmText="Clear Logs"
        confirmStyle="warning"
        isLoading={clearAuditLogsMutation.isPending}
      />
    </>
  );
};

export default LogsTab;