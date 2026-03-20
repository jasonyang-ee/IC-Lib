/**
 * ApprovalSection - Approval status display with optional action buttons.
 *
 * When onApprovalAction is null/undefined (ECO mode), renders read-only status badge only.
 * When onApprovalAction is provided (non-ECO / admin), renders action buttons.
 *
 * Props:
 * - componentDetails: object    the fetched component detail record
 * - canApprove: () => boolean   from AuthContext
 * - canWrite: () => boolean     from AuthContext
 * - updatingApproval: boolean
 * - onApprovalAction: (action) => void | null
 */
const ApprovalSection = ({
  componentDetails,
  canApprove,
  canWrite,
  updatingApproval,
  onApprovalAction,
}) => (
  <div className="border-t border-gray-200 dark:border-[#444444] pt-3 mt-3 space-y-1">
    {/* Approval Status - single row */}
    <div className="flex items-center gap-2 pb-2">
      <span className="text-xs text-gray-500 dark:text-gray-400 w-28 shrink-0 text-right">Approval Status:</span>
      <span className={`inline-block px-3 py-0.5 rounded text-xs font-semibold ${
        componentDetails.approval_status === 'production' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
        componentDetails.approval_status === 'archived' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
        componentDetails.approval_status === 'reviewing' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
        componentDetails.approval_status === 'prototype' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' :
        'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
      }`}>
        {componentDetails.approval_status === 'production' && 'Production'}
        {componentDetails.approval_status === 'archived' && 'Archived'}
        {componentDetails.approval_status === 'reviewing' && 'Reviewing'}
        {componentDetails.approval_status === 'prototype' && 'Prototype'}
        {componentDetails.approval_status === 'new' && 'New'}
      </span>
    </div>

    {/* By / Date - single row */}
    {(componentDetails.approval_user_name || componentDetails.approval_date) && (
      <div className="flex items-baseline gap-2 pb-2">
        <span className="text-xs text-gray-500 dark:text-gray-400 w-28 shrink-0 text-right">Approver:</span>
        <span className="text-sm text-gray-700 dark:text-gray-300 px-1">
          {componentDetails.approval_user_name && `${componentDetails.approval_user_name}`}
          {componentDetails.approval_user_name && componentDetails.approval_date && ' \u2022 '}
          {componentDetails.approval_date && `${new Date(componentDetails.approval_date).toLocaleDateString()}`}
        </span>
      </div>
    )}

    {/* Approval Action Buttons - only shown when onApprovalAction is provided (non-ECO mode) */}
    {onApprovalAction && (
      <div className="flex items-start gap-2 pt-1">
        <span className="text-xs text-gray-500 dark:text-gray-400 w-28 shrink-0 text-right pt-1.5">Action:</span>
        <div className="flex flex-wrap gap-2">
          {canApprove() && (
            <>
              <button
                onClick={() => onApprovalAction('approve')}
                disabled={updatingApproval || componentDetails.approval_status === 'production'}
                className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-xs font-medium rounded-md transition-colors"
              >
                Production
              </button>
              <button
                onClick={() => onApprovalAction('archive')}
                disabled={updatingApproval || componentDetails.approval_status === 'archived'}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-xs font-medium rounded-md transition-colors"
              >
                Archive
              </button>
            </>
          )}
          {canWrite() && (
            <>
              <button
                onClick={() => onApprovalAction('send_to_review')}
                disabled={updatingApproval || componentDetails.approval_status === 'reviewing'}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-xs font-medium rounded-md transition-colors"
              >
                Review
              </button>
              <button
                onClick={() => onApprovalAction('send_to_prototype')}
                disabled={updatingApproval || componentDetails.approval_status === 'prototype'}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-xs font-medium rounded-md transition-colors"
              >
                Prototype
              </button>
            </>
          )}
        </div>
      </div>
    )}

    {updatingApproval && (
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">Processing...</p>
    )}
  </div>
);

export default ApprovalSection;
