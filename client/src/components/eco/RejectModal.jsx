const RejectModal = ({
  rejectionReason,
  onRejectionReasonChange,
  onCancel,
  onConfirm,
  isRejectPending
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Reject ECO Order
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Please provide a reason for rejecting this ECO:
        </p>
        <textarea
          value={rejectionReason}
          onChange={(e) => onRejectionReasonChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={4}
          placeholder="Enter rejection reason..."
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isRejectPending || !rejectionReason.trim()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-md transition-colors"
          >
            Reject ECO
          </button>
        </div>
      </div>
    </div>
  );
};

export default RejectModal;
