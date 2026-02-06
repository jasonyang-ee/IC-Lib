import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { CheckCircle, XCircle, Clock, FileText, User, Calendar, Search, X, Filter } from 'lucide-react';

const ECO = () => {
  const { canApprove } = useAuth();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotification();
  const [selectedStatus, setSelectedStatus] = useState('pending');
  const [expandedECO, setExpandedECO] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(null);
  const [approvalComments, setApprovalComments] = useState('');

  // Search/filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [ecoNumberFilter, setEcoNumberFilter] = useState('');
  const [initiatedByFilter, setInitiatedByFilter] = useState('');
  const searchInputRef = useRef(null);

  // Auto-focus search field on page load
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Fetch ECO orders
  const { data: ecoOrders = [], isLoading } = useQuery({
    queryKey: ['ecos', selectedStatus],
    queryFn: async () => {
      const response = await api.getECOs({ status: selectedStatus });
      return response.data;
    }
  });

  // Get unique initiated_by users for filter dropdown
  const uniqueInitiators = [...new Set(ecoOrders.map(eco => eco.initiated_by_name).filter(Boolean))];

  // Filter ECO orders based on search/filters
  const filteredECOs = ecoOrders.filter(eco => {
    // Part number search
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
      eco.component_part_number?.toLowerCase().includes(searchLower) ||
      eco.component_description?.toLowerCase().includes(searchLower);

    // ECO number filter
    const matchesEcoNumber = !ecoNumberFilter ||
      eco.eco_number?.toLowerCase().includes(ecoNumberFilter.toLowerCase());

    // Initiated by filter
    const matchesInitiatedBy = !initiatedByFilter ||
      eco.initiated_by_name === initiatedByFilter;

    return matchesSearch && matchesEcoNumber && matchesInitiatedBy;
  });

  // Fetch ECO details when expanded
  const { data: ecoDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['eco', expandedECO],
    queryFn: async () => {
      if (!expandedECO) return null;
      const response = await api.getECOById(expandedECO);
      return response.data;
    },
    enabled: !!expandedECO
  });

  // Approve ECO mutation
  const approveMutation = useMutation({
    mutationFn: ({ id, comments }) => api.approveECO(id, { comments }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['ecos'] });
      queryClient.invalidateQueries({ queryKey: ['eco', expandedECO] });
      queryClient.invalidateQueries({ queryKey: ['components'] });
      setApprovalComments('');
      const msg = response.data?.message || 'Approval vote recorded.';
      showSuccess(msg);
      // Only collapse if fully approved
      if (response.data?.status === 'approved') {
        setExpandedECO(null);
      }
    },
    onError: (error) => {
      const msg = error.response?.data?.error || 'Failed to approve ECO. Please try again.';
      showError(msg);
    }
  });

  // Reject ECO mutation
  const rejectMutation = useMutation({
    mutationFn: ({ id, rejection_reason }) => api.rejectECO(id, { rejection_reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ecos'] });
      queryClient.invalidateQueries({ queryKey: ['eco', expandedECO] });
      setShowRejectModal(null);
      setRejectionReason('');
      setExpandedECO(null);
      showSuccess('ECO rejected successfully.');
    },
    onError: (error) => {
      const msg = error.response?.data?.error || 'Failed to reject ECO. Please try again.';
      showError(msg);
    }
  });

  const handleApprove = (ecoId) => {
    approveMutation.mutate({ id: ecoId, comments: approvalComments });
  };

  const handleReject = () => {
    if (showRejectModal) {
      rejectMutation.mutate({ id: showRejectModal, rejection_reason: rejectionReason });
    }
  };

  const toggleExpanded = (ecoId) => {
    setExpandedECO(expandedECO === ecoId ? null : ecoId);
    setApprovalComments('');
  };

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

  const isPendingApproval = (status) => status === 'pending' || status === 'in_review';

  const hasActiveFilters = searchTerm || ecoNumberFilter || initiatedByFilter;

  return (
    <div className="h-full flex flex-col">
      <div className="flex gap-4 flex-1 overflow-hidden">

        {/* Left Sidebar - Controls */}
        <div className="w-80 shrink-0 space-y-4 overflow-y-auto custom-scrollbar">

          {/* Status Filter */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
            <label className="block text- font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Status Filter
            </label>
            <div className="flex flex-col gap-1">
              {['pending', 'approved', 'rejected'].map((status) => (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(status)}
                  className={`px-3 py-2 text-sm capitalize rounded-md transition-colors text-left ${
                    selectedStatus === status
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#3a3a3a]'
                  }`}
                >
                  <span className="flex items-center gap-2 text-lg">
                    {status === 'pending' ? 'pending / in review' : status}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Part Number Search */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Search Part Number
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="Search part number or description..."
                className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    if (searchInputRef.current) {
                      searchInputRef.current.focus();
                    }
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* ECO Number Filter */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              ECO Number
            </label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={ecoNumberFilter}
                onChange={(e) => setEcoNumberFilter(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="Filter by ECO number..."
                className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
              />
              {ecoNumberFilter && (
                <button
                  onClick={() => setEcoNumberFilter('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="Clear"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Initiated By Filter */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Initiated By
            </label>
            <select
              value={initiatedByFilter}
              onChange={(e) => setInitiatedByFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
            >
              <option value="">All Users</option>
              {uniqueInitiators.map((user) => (
                <option key={user} value={user}>
                  {user}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Side - ECO List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a]">
                Loading ECO orders...
              </div>
            ) : filteredECOs.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a]">
                {hasActiveFilters
                  ? 'No ECO orders match your filters'
                  : `No ${selectedStatus} ECO orders found`}
              </div>
            ) : (
              filteredECOs.map((eco) => (
                <div
                  key={eco.id}
                  className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a]"
                >
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
                        onClick={() => toggleExpanded(eco.id)}
                        className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
                      >
                        {expandedECO === eco.id ? '- Hide Details' : '+ Expand Details'}
                      </button>

                      {isPendingApproval(eco.status) && canApprove() && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApprove(eco.id)}
                            disabled={approveMutation.isPending}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setShowRejectModal(eco.id)}
                            disabled={rejectMutation.isPending}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedECO === eco.id && (
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
                              {isPendingApproval(ecoDetails.status) && canApprove() && (
                                <div className="mb-3">
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Approval Comments (optional)
                                  </label>
                                  <textarea
                                    value={approvalComments}
                                    onChange={(e) => setApprovalComments(e.target.value)}
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
                                        if (field === '_delete_component') return 'Delete Component';
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

                          {/* Alternative Parts Changes */}
                          {ecoDetails.alternatives && ecoDetails.alternatives.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                                Alternative Parts Changes
                              </h4>
                              <div className="space-y-2">
                                {ecoDetails.alternatives.map((alt, idx) => (
                                  <div
                                    key={idx}
                                    className="bg-white dark:bg-[#2a2a2a] rounded border border-gray-200 dark:border-[#3a3a3a] p-3"
                                  >
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                        alt.action === 'add' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                        alt.action === 'delete' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                                        'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                      }`}>
                                        {alt.action}
                                      </span>
                                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {alt.manufacturer_name}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                      {alt.manufacturer_pn}
                                    </p>
                                  </div>
                                ))}
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
                           (!ecoDetails.distributors || ecoDetails.distributors.length === 0) && (
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
              ))
            )}
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
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
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Enter rejection reason..."
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowRejectModal(null);
                  setRejectionReason('');
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={rejectMutation.isPending || !rejectionReason.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-md transition-colors"
              >
                Reject ECO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ECO;
