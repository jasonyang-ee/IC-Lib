import { CheckCircle, XCircle, Clock, FileText, User, Calendar, Link2, Unlink2 } from 'lucide-react';

const getStatusBadge = (status) => {
  const styles = {
    pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    in_review: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    approved: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    rejected: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
  };
  return styles[status] || styles.pending;
};

const getStatusIcon = (status) => {
  switch (status) {
    case 'approved':
      return <CheckCircle className="w-4 h-4" />;
    case 'rejected':
      return <XCircle className="w-4 h-4" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
};

const getStatusLabel = (status) => {
  if (status === 'in_review') return 'in review';
  return status;
};

const getApprovalStatusBadge = (status) => {
  const styles = {
    approved: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    archived: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    experimental: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    'pending review': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    new: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  };
  return styles[status] || styles.new;
};

const isPendingApproval = (status) => status === 'pending' || status === 'in_review';

const ECOListItem = ({
  eco,
  expandedECO,
  ecoDetails,
  isLoadingDetails,
  canApprove,
  approvalComments,
  onApprovalCommentsChange,
  onToggleExpanded,
  onApprove,
  onReject,
  approvePending,
  rejectPending
}) => {
  const isExpanded = expandedECO === eco.id;

  return (
    <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a]">
      {/* ECO Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {eco.eco_number}
              </h3>
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getStatusBadge(eco.status)}`}>
                {getStatusIcon(eco.status)}
                {getStatusLabel(eco.status)}
              </span>
            </div>

            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span className="font-medium">{eco.component_part_number}</span>
                {eco.component_description && (
                  <span>- {eco.component_description}</span>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  <span>Initiated by: {eco.initiated_by_name || 'Unknown'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(eco.created_at).toLocaleString()}</span>
                </div>
              </div>

              {/* Approval Stage Progress */}
              {isPendingApproval(eco.status) && eco.current_stage_name && (
                <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                  <p className="text-blue-700 dark:text-blue-400 text-xs">
                    <strong>Current Stage:</strong> {eco.current_stage_name}
                    {eco.current_stage_required_approvals && (
                      <span className="ml-2">
                        ({eco.current_stage_approval_count || 0}/{eco.current_stage_required_approvals} approvals)
                      </span>
                    )}
                  </p>
                </div>
              )}

              {eco.approved_by_name && (
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  <span>
                    {eco.status === 'approved' ? 'Approved' : 'Rejected'} by: {eco.approved_by_name}
                    {eco.approved_at && ` on ${new Date(eco.approved_at).toLocaleString()}`}
                  </span>
                </div>
              )}

              {eco.rejection_reason && (
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                  <p className="text-red-700 dark:text-red-400 text-xs">
                    <strong>Rejection Reason:</strong> {eco.rejection_reason}
                  </p>
                </div>
              )}

              {eco.notes && (
                <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                  <p className="text-gray-700 dark:text-gray-300 text-xs">
                    <strong>Notes:</strong> {eco.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons - Separate Row */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200 dark:border-[#3a3a3a]">
          <button
            onClick={() => onToggleExpanded(eco.id)}
            className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
          >
            {isExpanded ? '- Hide Details' : '+ Expand Details'}
          </button>

          {isPendingApproval(eco.status) && canApprove && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onApprove(eco.id)}
                disabled={approvePending}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md transition-colors"
              >
                Approve
              </button>
              <button
                onClick={() => onReject(eco.id)}
                disabled={rejectPending}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md transition-colors"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-[#3a3a3a] p-4 bg-gray-50 dark:bg-[#222222]">
          {isLoadingDetails ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              Loading details...
            </div>
          ) : ecoDetails ? (
            <div className="space-y-4">

              {/* Approval Progress (stages and votes) */}
              {ecoDetails.stages && ecoDetails.stages.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Approval Progress
                  </h4>
                  <div className="flex gap-2 flex-wrap mb-3">
                    {ecoDetails.stages.map((stage) => {
                      const isCurrent = ecoDetails.current_stage_id === stage.id;
                      const isComplete = parseInt(stage.approval_count) >= stage.required_approvals;
                      const isPast = stage.stage_order < ecoDetails.current_stage_order;
                      return (
                        <div
                          key={stage.id}
                          className={`px-3 py-2 rounded border text-sm ${
                            isCurrent
                              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600 text-blue-700 dark:text-blue-400'
                              : isPast || isComplete
                                ? 'border-green-400 bg-green-50 dark:bg-green-900/20 dark:border-green-600 text-green-700 dark:text-green-400'
                                : 'border-gray-300 dark:border-[#444] bg-white dark:bg-[#2a2a2a] text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          <div className="font-medium">{stage.stage_name}</div>
                          <div className="text-xs mt-0.5">
                            {stage.approval_count}/{stage.required_approvals} approvals
                            {(isPast || isComplete) && ecoDetails.status !== 'rejected' && ' (complete)'}
                            {isCurrent && !isComplete && ' (current)'}
                          </div>
                          {stage.assigned_approvers?.length > 0 && (
                            <div className="text-xs mt-0.5 opacity-70">
                              {stage.assigned_approvers.map(a => a.username).join(', ')}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Vote History */}
                  {ecoDetails.approvals && ecoDetails.approvals.length > 0 && (
                    <div className="bg-white dark:bg-[#2a2a2a] rounded border border-gray-200 dark:border-[#3a3a3a] overflow-hidden mb-3">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100 dark:bg-[#333333]">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Stage</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">User</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Decision</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Comments</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-[#3a3a3a]">
                          {ecoDetails.approvals.map((approval) => (
                            <tr key={approval.id}>
                              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                {approval.stage_name}
                              </td>
                              <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                                {approval.user_name}
                              </td>
                              <td className="px-4 py-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  approval.decision === 'approved'
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                }`}>
                                  {approval.decision}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-gray-600 dark:text-gray-400 text-xs">
                                {approval.comments || '-'}
                              </td>
                              <td className="px-4 py-2 text-gray-500 dark:text-gray-400 text-xs">
                                {new Date(approval.created_at).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Approval Comments Field */}
                  {isPendingApproval(ecoDetails.status) && canApprove && (
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Approval Comments (optional)
                      </label>
                      <textarea
                        value={approvalComments}
                        onChange={(e) => onApprovalCommentsChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-[#444] rounded-md bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        rows={2}
                        placeholder="Add optional comments with your approval..."
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Component Field Changes */}
              {ecoDetails.changes && ecoDetails.changes.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Component Changes
                  </h4>
                  <div className="bg-white dark:bg-[#2a2a2a] rounded border border-gray-200 dark:border-[#3a3a3a] overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 dark:bg-[#333333]">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Field</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Old Value</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">New Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-[#3a3a3a]">
                        {ecoDetails.changes.map((change, idx) => {
                          // Helper to get display value for special fields
                          const getDisplayValue = (field, value, isOld) => {
                            if (field === '_status_proposal') {
                              return (
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getApprovalStatusBadge(value)}`}>
                                  {value}
                                </span>
                              );
                            }
                            if (!value) return <span className="italic text-gray-400">empty</span>;

                            // Show category name for category_id field
                            if (field === 'category_id') {
                              const name = isOld ? change.old_category_name : change.new_category_name;
                              return name || value;
                            }

                            // Show manufacturer name for manufacturer_id field
                            if (field === 'manufacturer_id') {
                              const name = isOld ? change.old_manufacturer_name : change.new_manufacturer_name;
                              return name || value;
                            }

                            return value;
                          };

                          // Format field name for display
                          const formatFieldName = (field) => {
                            if (field === 'category_id') return 'Category';
                            if (field === 'manufacturer_id') return 'Manufacturer';
                            if (field === '_status_proposal') return 'Status Change';
                            return field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                          };

                          return (
                            <tr key={idx}>
                              <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                                {formatFieldName(change.field_name)}
                              </td>
                              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                {getDisplayValue(change.field_name, change.old_value, true)}
                              </td>
                              <td className="px-4 py-2 text-gray-900 dark:text-gray-100 font-medium">
                                {getDisplayValue(change.field_name, change.new_value, false)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Specification Changes */}
              {ecoDetails.specifications && ecoDetails.specifications.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Specification Changes
                  </h4>
                  <div className="bg-white dark:bg-[#2a2a2a] rounded border border-gray-200 dark:border-[#3a3a3a] overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 dark:bg-[#333333]">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Specification</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Old Value</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">New Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-[#3a3a3a]">
                        {ecoDetails.specifications.map((spec, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                              {spec.spec_name} {spec.unit && `(${spec.unit})`}
                            </td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                              {spec.old_value || <span className="italic text-gray-400">empty</span>}
                            </td>
                            <td className="px-4 py-2 text-gray-900 dark:text-gray-100 font-medium">
                              {spec.new_value || <span className="italic text-gray-400">empty</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* CAD File Changes */}
              {ecoDetails.cad_files && ecoDetails.cad_files.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    CAD File Changes
                  </h4>
                  <div className="space-y-2">
                    {ecoDetails.cad_files.map((cf, idx) => (
                      <div
                        key={idx}
                        className="bg-white dark:bg-[#2a2a2a] rounded border border-gray-200 dark:border-[#3a3a3a] p-3 flex items-center gap-3"
                      >
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          cf.action === 'link'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        }`}>
                          {cf.action === 'link' ? <Link2 className="w-3 h-3" /> : <Unlink2 className="w-3 h-3" />}
                          {cf.action}
                        </span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {cf.file_name || cf.existing_file_name}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          ({cf.file_type || cf.existing_file_type})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Alternative Parts Changes */}
              {ecoDetails.alternatives && ecoDetails.alternatives.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Alternative Parts Changes
                  </h4>
                  <div className="space-y-3">
                    {ecoDetails.alternatives.map((alt, idx) => {
                      const altDists = Array.isArray(alt.distributors) ? alt.distributors : [];
                      return (
                        <div
                          key={idx}
                          className="bg-white dark:bg-[#2a2a2a] rounded border border-gray-200 dark:border-[#3a3a3a] p-3"
                        >
                          {/* Alternative header */}
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              alt.action === 'add' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                              alt.action === 'delete' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                              'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            }`}>
                              {alt.action}
                            </span>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {alt.manufacturer_name || 'Unknown manufacturer'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            MFG P/N: <span className="font-medium text-gray-800 dark:text-gray-200">{alt.manufacturer_pn || '-'}</span>
                          </p>
                          {/* Show existing info for updates/deletes */}
                          {alt.action !== 'add' && alt.existing_manufacturer_pn && alt.existing_manufacturer_name && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                              Previous: {alt.existing_manufacturer_name} / {alt.existing_manufacturer_pn}
                            </p>
                          )}

                          {/* Nested distributor changes for this alternative */}
                          {altDists.length > 0 && (
                            <div className="mt-2 ml-3 border-l-2 border-gray-200 dark:border-[#444] pl-3">
                              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Distributors:</p>
                              <div className="space-y-1">
                                {altDists.map((dist, dIdx) => (
                                  <div key={dIdx} className="flex items-center gap-2 text-xs">
                                    <span className={`px-1.5 py-0.5 rounded font-medium ${
                                      dist.action === 'add' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                      dist.action === 'delete' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                                      'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                    }`}>
                                      {dist.action}
                                    </span>
                                    <span className="font-medium text-gray-800 dark:text-gray-200">
                                      {dist.distributor_name || 'Distributor'}
                                    </span>
                                    {dist.sku && (
                                      <span className="text-gray-500 dark:text-gray-400">
                                        SKU: {dist.sku}
                                      </span>
                                    )}
                                    {dist.url && (
                                      <a href={dist.url} target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline truncate max-w-[150px]">
                                        {dist.url}
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Distributor Changes */}
              {ecoDetails.distributors && ecoDetails.distributors.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Distributor Changes
                  </h4>
                  <div className="bg-white dark:bg-[#2a2a2a] rounded border border-gray-200 dark:border-[#3a3a3a] overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 dark:bg-[#333333]">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Action</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Distributor</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">SKU</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">URL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-[#3a3a3a]">
                        {ecoDetails.distributors.map((dist, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                dist.action === 'add' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                dist.action === 'delete' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                                'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                              }`}>
                                {dist.action}
                              </span>
                            </td>
                            <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                              {dist.distributor_name}
                              {dist.alternative_manufacturer_name && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                                  (Alt: {dist.alternative_manufacturer_name})
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                              {dist.sku || <span className="italic text-gray-400">-</span>}
                            </td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                              {dist.url ? (
                                <a href={dist.url} target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline truncate block max-w-[200px]">
                                  {dist.url}
                                </a>
                              ) : (
                                <span className="italic text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* No changes message */}
              {(!ecoDetails.changes || ecoDetails.changes.length === 0) &&
               (!ecoDetails.specifications || ecoDetails.specifications.length === 0) &&
               (!ecoDetails.alternatives || ecoDetails.alternatives.length === 0) &&
               (!ecoDetails.distributors || ecoDetails.distributors.length === 0) &&
               (!ecoDetails.cad_files || ecoDetails.cad_files.length === 0) && (
                <p className="text-gray-500 dark:text-gray-400 text-sm italic">
                  No changes recorded in this ECO
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              Failed to load ECO details
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ECOListItem;
