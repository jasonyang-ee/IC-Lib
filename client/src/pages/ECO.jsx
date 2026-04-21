import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { ecoMatchesPipelineType } from '../utils/ecoPipelineTypes';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { ECOSidebar, ECOListItem, RejectModal } from '../components/eco';

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
  const [pipelineTypeFilter, setPipelineTypeFilter] = useState('');
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
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
      eco.component_part_number?.toLowerCase().includes(searchLower) ||
      eco.component_description?.toLowerCase().includes(searchLower);

    const matchesEcoNumber = !ecoNumberFilter ||
      eco.eco_number?.toLowerCase().includes(ecoNumberFilter.toLowerCase());

    const matchesInitiatedBy = !initiatedByFilter ||
      eco.initiated_by_name === initiatedByFilter;

    const matchesPipelineType = ecoMatchesPipelineType(eco, pipelineTypeFilter);

    return matchesSearch && matchesEcoNumber && matchesInitiatedBy && matchesPipelineType;
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
      queryClient.invalidateQueries({ queryKey: ['componentDetails'] });
      queryClient.invalidateQueries({ queryKey: ['componentAlternatives'] });
      setApprovalComments('');
      const msg = response.data?.message || 'Approval vote recorded.';
      showSuccess(msg);
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

  const handleDownloadPDF = async (ecoId, ecoNumber) => {
    try {
      const response = await api.downloadECOPDF(ecoId);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${ecoNumber || 'ECO'}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      showError('Failed to download ECO PDF.');
    }
  };

  const toggleExpanded = (ecoId) => {
    setExpandedECO(expandedECO === ecoId ? null : ecoId);
    setApprovalComments('');
  };

  const hasActiveFilters = searchTerm || ecoNumberFilter || initiatedByFilter || pipelineTypeFilter;

  return (
    <div className="h-full flex flex-col">
      <div className="flex gap-4 flex-1 overflow-hidden">

        {/* Left Sidebar - Controls */}
        <ECOSidebar
          ref={searchInputRef}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          ecoNumberFilter={ecoNumberFilter}
          onEcoNumberFilterChange={setEcoNumberFilter}
          initiatedByFilter={initiatedByFilter}
          onInitiatedByFilterChange={setInitiatedByFilter}
          uniqueInitiators={uniqueInitiators}
          pipelineTypeFilter={pipelineTypeFilter}
          onPipelineTypeFilterChange={setPipelineTypeFilter}
        />

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
                <ECOListItem
                  key={eco.id}
                  eco={eco}
                  expandedECO={expandedECO}
                  ecoDetails={ecoDetails}
                  isLoadingDetails={isLoadingDetails}
                  canApprove={canApprove()}
                  approvalComments={approvalComments}
                  onApprovalCommentsChange={setApprovalComments}
                  onToggleExpanded={toggleExpanded}
                  onApprove={handleApprove}
                  onReject={(ecoId) => setShowRejectModal(ecoId)}
                  onDownloadPDF={handleDownloadPDF}
                  approvePending={approveMutation.isPending}
                  rejectPending={rejectMutation.isPending}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <RejectModal
          rejectionReason={rejectionReason}
          onRejectionReasonChange={setRejectionReason}
          onCancel={() => {
            setShowRejectModal(null);
            setRejectionReason('');
          }}
          onConfirm={handleReject}
          isRejectPending={rejectMutation.isPending}
        />
      )}
    </div>
  );
};

export default ECO;
