import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { CheckCircle, XCircle, Clock, FileText, User, Calendar, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

const ECO = () => {
  const { canApprove, user } = useAuth();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotification();
  const [selectedStatus, setSelectedStatus] = useState('pending');
  const [expandedECO, setExpandedECO] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(null);

  // Fetch ECO orders
  const { data: ecoOrders = [], isLoading } = useQuery({
    queryKey: ['ecos', selectedStatus],
    queryFn: async () => {
      const response = await api.getECOs({ status: selectedStatus });
      return response.data;
    }
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
    mutationFn: (id) => api.approveECO(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['ecos']);
      queryClient.invalidateQueries(['eco', expandedECO]);
      queryClient.invalidateQueries(['components']); // Refresh components list
      setExpandedECO(null);
      showSuccess('ECO approved successfully! Changes have been applied to the component.');
    },
    onError: (error) => {
      console.error('Error approving ECO:', error);
      showError('Failed to approve ECO. Please try again.');
    }
  });

  // Reject ECO mutation
  const rejectMutation = useMutation({
    mutationFn: ({ id, rejection_reason }) => api.rejectECO(id, { rejection_reason }),
    onSuccess: () => {
      queryClient.invalidateQueries(['ecos']);
      queryClient.invalidateQueries(['eco', expandedECO]);
      setShowRejectModal(null);
      setRejectionReason('');
      setExpandedECO(null);
      showSuccess('ECO rejected successfully.');
    },
    onError: (error) => {
      console.error('Error rejecting ECO:', error);
      showError('Failed to reject ECO. Please try again.');
    }
  });

  // Delete ECO mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => api.deleteECO(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['ecos']);
      setExpandedECO(null);
      showSuccess('ECO deleted successfully.');
    },
    onError: (error) => {
      console.error('Error deleting ECO:', error);
      showError('Failed to delete ECO. Please try again.');
    }
  });

  const handleApprove = (ecoId) => {
    approveMutation.mutate(ecoId);
  };

  const handleReject = () => {
    if (showRejectModal) {
      rejectMutation.mutate({ id: showRejectModal, rejection_reason: rejectionReason });
    }
  };

  const handleDelete = (ecoId) => {
    if (window.confirm('Are you sure you want to delete this ECO? This action cannot be undone.')) {
      deleteMutation.mutate(ecoId);
    }
  };

  const toggleExpanded = (ecoId) => {
    setExpandedECO(expandedECO === ecoId ? null : ecoId);
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Engineer Change Orders (ECO)
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Review and approve component change requests
        </p>
      </div>

      {/* Status Filter Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {['pending', 'approved', 'rejected'].map((status) => (
          <button
            key={status}
            onClick={() => setSelectedStatus(status)}
            className={`px-4 py-2 font-medium text-sm capitalize transition-colors ${
              selectedStatus === status
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* ECO List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            Loading ECO orders...
          </div>
        ) : ecoOrders.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No {selectedStatus} ECO orders found
          </div>
        ) : (
          ecoOrders.map((eco) => (
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
                        {eco.status}
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
                          <span>Initiated by: {eco.initiated_by_name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(eco.created_at).toLocaleString()}</span>
                        </div>
                      </div>

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

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 ml-4">
                    {eco.status === 'pending' && (
                      <>
                        {canApprove() && (
                          <>
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
                          </>
                        )}
                        {(user.id === eco.initiated_by || canApprove()) && (
                          <button
                            onClick={() => handleDelete(eco.id)}
                            disabled={deleteMutation.isPending}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Delete ECO"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                    
                    <button
                      onClick={() => toggleExpanded(eco.id)}
                      className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      {expandedECO === eco.id ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>
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
                                {ecoDetails.changes.map((change, idx) => (
                                  <tr key={idx}>
                                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                                      {change.field_name}
                                    </td>
                                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                      {change.old_value || <span className="italic text-gray-400">empty</span>}
                                    </td>
                                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100 font-medium">
                                      {change.new_value || <span className="italic text-gray-400">empty</span>}
                                    </td>
                                  </tr>
                                ))}
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
                          <div className="space-y-2">
                            {ecoDetails.distributors.map((dist, idx) => (
                              <div
                                key={idx}
                                className="bg-white dark:bg-[#2a2a2a] rounded border border-gray-200 dark:border-[#3a3a3a] p-3"
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    dist.action === 'add' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                    dist.action === 'delete' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                                    'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                  }`}>
                                    {dist.action}
                                  </span>
                                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {dist.distributor_name}
                                  </span>
                                  {dist.alternative_manufacturer_name && (
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      (Alt: {dist.alternative_manufacturer_name})
                                    </span>
                                  )}
                                </div>
                                {dist.action !== 'delete' && (
                                  <div className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                                    {dist.sku && <p>SKU: {dist.sku}</p>}
                                    {dist.stock_quantity !== null && <p>Stock: {dist.stock_quantity}</p>}
                                    {dist.price_breaks && dist.price_breaks.length > 0 && (
                                      <div>
                                        <p className="font-medium">Price Breaks:</p>
                                        <div className="flex gap-2 flex-wrap">
                                          {dist.price_breaks.map((pb, pbIdx) => (
                                            <span key={pbIdx} className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                              {pb.quantity}+: ${Number(pb.price).toFixed(4)}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
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
