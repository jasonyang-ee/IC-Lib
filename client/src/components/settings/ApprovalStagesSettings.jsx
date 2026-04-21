import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, Check, X, Users, Edit, Trash2, Download, Upload } from 'lucide-react';
import { api } from '../../utils/api';
import { DEFAULT_STAGE_PIPELINE_TYPES, PIPELINE_TYPE_OPTIONS } from '../../utils/ecoPipelineTypes';
import {
  buildApprovalStageImportSummary,
  getApprovalStageBackupFilename,
  parseApprovalStageBackupFile,
} from '../../utils/ecoApprovalStageBackup';
import { useNotification } from '../../contexts/NotificationContext';

// Approval Stages Settings Component
const ApprovalStagesSettings = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotification();
  const [isAdding, setIsAdding] = useState(false);
  const [editingStage, setEditingStage] = useState(null);
  const [newStage, setNewStage] = useState({ stage_name: '', required_approvals: 1, required_role: 'approver', pipeline_types: [...DEFAULT_STAGE_PIPELINE_TYPES] });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [managingApprovers, setManagingApprovers] = useState(null);

  const ROLE_OPTIONS = [
    { value: 'reviewer', label: 'Reviewer' },
    { value: 'read-write', label: 'Read-Write' },
    { value: 'approver', label: 'Approver' },
    { value: 'admin', label: 'Admin' },
  ];

  // Fetch stages
  const { data: stages = [], isLoading } = useQuery({
    queryKey: ['approvalStages'],
    queryFn: async () => {
      const response = await api.getApprovalStages();
      return response.data;
    }
  });

  // Fetch all users (for approver assignment)
  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.getAllUsers();
      return response.data;
    }
  });

  // Create stage
  const createMutation = useMutation({
    mutationFn: (data) => api.createApprovalStage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvalStages'] });
      setIsAdding(false);
      setNewStage({ stage_name: '', required_approvals: 1, required_role: 'approver', pipeline_types: [...DEFAULT_STAGE_PIPELINE_TYPES] });
      showSuccess('Approval stage created.');
    },
    onError: (error) => {
      showError(error.response?.data?.error || 'Failed to create stage.');
    }
  });

  // Update stage
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.updateApprovalStage(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvalStages'] });
      setEditingStage(null);
      showSuccess('Approval stage updated.');
    },
    onError: (error) => {
      showError(error.response?.data?.error || 'Failed to update stage.');
    }
  });

  // Delete stage
  const deleteMutation = useMutation({
    mutationFn: (id) => api.deleteApprovalStage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvalStages'] });
      setDeleteConfirm(null);
      showSuccess('Approval stage deleted.');
    },
    onError: (error) => {
      showError(error.response?.data?.error || 'Failed to delete stage.');
    }
  });

  // Reorder stages
  const reorderMutation = useMutation({
    mutationFn: (data) => api.reorderApprovalStages(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvalStages'] });
    },
    onError: (error) => {
      showError(error.response?.data?.error || 'Failed to reorder stages.');
    }
  });

  // Set stage approvers
  const setApproversMutation = useMutation({
    mutationFn: ({ stageId, userIds }) => api.setStageApprovers(stageId, userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvalStages'] });
      showSuccess('Stage approvers updated.');
    },
    onError: (error) => {
      showError(error.response?.data?.error || 'Failed to update approvers.');
    }
  });

  const exportMutation = useMutation({
    mutationFn: () => api.exportApprovalStages(),
    onSuccess: (response) => {
      const result = response.data;

      if (!result?.success || !result?.data) {
        showError('Failed to export approval stages.');
        return;
      }

      const dataStr = JSON.stringify(result.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = getApprovalStageBackupFilename();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showSuccess('Approval stages exported successfully.');
    },
    onError: (error) => {
      showError(error.response?.data?.error || 'Failed to export approval stages.');
    },
  });

  const importMutation = useMutation({
    mutationFn: (stagesToImport) => api.importApprovalStages(stagesToImport),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['approvalStages'] });
      setEditingStage(null);
      setManagingApprovers(null);
      setDeleteConfirm(null);

      showSuccess(buildApprovalStageImportSummary(response.data?.results));
    },
    onError: (error) => {
      showError(error.response?.data?.error || 'Failed to import approval stages.');
    },
  });

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const ids = stages.map(s => s.id);
    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    reorderMutation.mutate({ stage_ids: ids });
  };

  const handleMoveDown = (index) => {
    if (index === stages.length - 1) return;
    const ids = stages.map(s => s.id);
    [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    reorderMutation.mutate({ stage_ids: ids });
  };

  const handleCreate = () => {
    if (!newStage.stage_name.trim()) return;
    createMutation.mutate(newStage);
  };

  const handleUpdate = () => {
    if (!editingStage) return;
    updateMutation.mutate({
      id: editingStage.id,
      data: {
        stage_name: editingStage.stage_name,
        required_approvals: editingStage.required_approvals,
        required_role: editingStage.required_role,
        is_active: editingStage.is_active,
        stage_order: editingStage.stage_order,
        pipeline_types: editingStage.pipeline_types,
      }
    });
  };

  const handleToggleApprover = (stageId, userId, currentApprovers) => {
    const currentIds = currentApprovers.map(a => a.user_id);
    const newIds = currentIds.includes(userId)
      ? currentIds.filter(id => id !== userId)
      : [...currentIds, userId];
    setApproversMutation.mutate({ stageId, userIds: newIds });
  };

  const handleImportApprovalStages = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const parsedJson = JSON.parse(loadEvent.target?.result);
        const stagesToImport = parseApprovalStageBackupFile(parsedJson);
        importMutation.mutate(stagesToImport);
      } catch (error) {
        showError(error.message || 'Failed to import approval stages.');
      }
    };

    reader.readAsText(file);
    event.target.value = '';
  };

  // Toggle pipeline type for new stage form
  const toggleNewStagePipelineType = (type) => {
    setNewStage(prev => {
      const current = prev.pipeline_types || [];
      if (current.includes(type)) {
        // Don't allow removing the last type
        if (current.length <= 1) return prev;
        return { ...prev, pipeline_types: current.filter(t => t !== type) };
      }
      return { ...prev, pipeline_types: [...current, type] };
    });
  };

  // Toggle pipeline type for editing stage
  const toggleEditStagePipelineType = (type) => {
    setEditingStage(prev => {
      const current = prev.pipeline_types || [];
      if (current.includes(type)) {
        if (current.length <= 1) return prev;
        return { ...prev, pipeline_types: current.filter(t => t !== type) };
      }
      return { ...prev, pipeline_types: [...current, type] };
    });
  };

  // Filter users eligible for approval (exclude read-only)
  const eligibleUsers = allUsers.filter(u => u.role !== 'read-only' && u.is_active !== false);

  // Group stages by stage_order for visual grouping
  const getStageGroups = () => {
    const groups = {};
    stages.forEach((stage, index) => {
      const order = stage.stage_order ?? (index + 1);
      if (!groups[order]) groups[order] = [];
      groups[order].push({ ...stage, _index: index });
    });
    return groups;
  };
  const stageGroups = getStageGroups();
  const sortedGroupKeys = Object.keys(stageGroups).map(Number).sort((a, b) => a - b);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading approval stages...</span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Approval Stages
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            Configure the multi-stage approval pipeline for ECOs. Each stage requires a set number of approvals before advancing.
            Stages with the same order number run in parallel. Export/import restores stage order, tags, and assigned approvers; missing users are skipped.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
            className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md transition-colors flex items-center gap-1"
          >
            {exportMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export JSON
          </button>
          <label
            className={`px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-md transition-colors flex items-center gap-1 cursor-pointer ${importMutation.isPending ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {importMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Import JSON
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              disabled={importMutation.isPending}
              onChange={handleImportApprovalStages}
            />
          </label>
          {!isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-md transition-colors flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Add Stage
            </button>
          )}
        </div>
      </div>

      {/* Add new stage form */}
      {isAdding && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-[#333] rounded-lg border border-gray-200 dark:border-[#444]">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">New Approval Stage</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Stage Name</label>
              <input
                type="text"
                value={newStage.stage_name}
                onChange={(e) => setNewStage(prev => ({ ...prev, stage_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#444] rounded-md bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="e.g. Engineering Review"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Required Approval Counts</label>
              <input
                type="number"
                value={newStage.required_approvals}
                onChange={(e) => setNewStage(prev => ({ ...prev, required_approvals: Math.max(1, parseInt(e.target.value) || 1) }))}
                min={1}
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#444] rounded-md bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Minimum Role</label>
              <select
                value={newStage.required_role}
                onChange={(e) => setNewStage(prev => ({ ...prev, required_role: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#444] rounded-md bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {ROLE_OPTIONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>
          {/* Pipeline Types Toggle */}
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Stage Tags</label>
            <div className="flex flex-wrap gap-1.5">
              {PIPELINE_TYPE_OPTIONS.map((pt) => {
                const isSelected = (newStage.pipeline_types || []).includes(pt.value);
                return (
                  <button
                    key={pt.value}
                    type="button"
                    onClick={() => toggleNewStagePipelineType(pt.value)}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                      isSelected
                        ? pt.color + ' border-current font-semibold'
                        : 'bg-white dark:bg-[#2a2a2a] border-gray-300 dark:border-[#444] text-gray-500 dark:text-gray-400 hover:border-gray-400'
                    }`}
                  >
                    {pt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleCreate}
              disabled={!newStage.stage_name.trim() || createMutation.isPending}
              className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white text-sm rounded-md transition-colors flex items-center gap-1"
            >
              {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Create
            </button>
            <button
              onClick={() => { setIsAdding(false); setNewStage({ stage_name: '', required_approvals: 1, required_role: 'approver', pipeline_types: [...DEFAULT_STAGE_PIPELINE_TYPES] }); }}
              className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Stages list */}
      {stages.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No approval stages configured. ECOs will use single-approval mode.
        </div>
      ) : (
        <div className="space-y-2">
          {sortedGroupKeys.map((groupOrder) => {
            const groupStages = stageGroups[groupOrder];
            const isParallelGroup = groupStages.length > 1;
            return (
              <div
                key={groupOrder}
                className={isParallelGroup
                  ? 'p-2 rounded-lg border-2 border-dashed border-primary-200 dark:border-primary-800 bg-primary-50/30 dark:bg-primary-900/10 space-y-2'
                  : 'space-y-2'
                }
              >
                {isParallelGroup && (
                  <div className="text-xs font-medium text-primary-600 dark:text-primary-400 px-1">
                    Parallel group (order {groupOrder})
                  </div>
                )}
                {groupStages.map((stage) => {
                  const index = stage._index;
                  return (
                    <div
                      key={stage.id}
                      className={`rounded-lg border ${
                        stage.is_active
                          ? 'border-gray-200 dark:border-[#3a3a3a] bg-white dark:bg-[#2a2a2a]'
                          : 'border-gray-200 dark:border-[#3a3a3a] bg-gray-100 dark:bg-[#333] opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3 p-3">
                      {/* Order controls */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0 || reorderMutation.isPending}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 text-xs leading-none"
                          title="Move up"
                        >
                          &#9650;
                        </button>
                        <button
                          onClick={() => handleMoveDown(index)}
                          disabled={index === stages.length - 1 || reorderMutation.isPending}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 text-xs leading-none"
                          title="Move down"
                        >
                          &#9660;
                        </button>
                      </div>

                      {/* Stage number (show stage_order) */}
                      <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center text-sm font-bold shrink-0">
                        {stage.stage_order ?? (index + 1)}
                      </div>

                      {/* Stage info (or edit form) */}
                      {editingStage?.id === stage.id ? (
                        <div className="flex-1 space-y-2">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <div>
                              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Stage Name</label>
                              <input
                                type="text"
                                value={editingStage.stage_name}
                                onChange={(e) => setEditingStage(prev => ({ ...prev, stage_name: e.target.value }))}
                                className="w-full px-2 py-1 border border-gray-300 dark:border-[#444] rounded bg-white dark:bg-[#1a1a1a] dark:text-gray-100 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                                placeholder="Stage name"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Required Approval Counts</label>
                              <input
                                type="number"
                                value={editingStage.required_approvals}
                                onChange={(e) => setEditingStage(prev => ({ ...prev, required_approvals: Math.max(1, parseInt(e.target.value) || 1) }))}
                                min={1}
                                className="w-full px-2 py-1 border border-gray-300 dark:border-[#444] rounded bg-white dark:bg-[#1a1a1a] dark:text-gray-100 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Minimum Role</label>
                              <select
                                value={editingStage.required_role}
                                onChange={(e) => setEditingStage(prev => ({ ...prev, required_role: e.target.value }))}
                                className="w-full px-2 py-1 border border-gray-300 dark:border-[#444] rounded bg-white dark:bg-[#1a1a1a] dark:text-gray-100 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                              >
                                {ROLE_OPTIONS.map(r => (
                                  <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Stage Order</label>
                              <input
                                type="number"
                                value={editingStage.stage_order ?? ''}
                                onChange={(e) => setEditingStage(prev => ({ ...prev, stage_order: Math.max(1, parseInt(e.target.value) || 1) }))}
                                min={1}
                                className="w-full px-2 py-1 border border-gray-300 dark:border-[#444] rounded bg-white dark:bg-[#1a1a1a] dark:text-gray-100 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                                placeholder="Order #"
                              />
                            </div>
                          </div>
                          {/* Pipeline Types Toggle for editing */}
                          <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Stage Tags</label>
                            <div className="flex flex-wrap gap-1.5">
                              {PIPELINE_TYPE_OPTIONS.map((pt) => {
                                const isSelected = (editingStage.pipeline_types || []).includes(pt.value);
                                return (
                                  <button
                                    key={pt.value}
                                    type="button"
                                    onClick={() => toggleEditStagePipelineType(pt.value)}
                                    className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                                      isSelected
                                        ? pt.color + ' border-current font-semibold'
                                        : 'bg-white dark:bg-[#2a2a2a] border-gray-300 dark:border-[#444] text-gray-500 dark:text-gray-400 hover:border-gray-400'
                                    }`}
                                  >
                                    {pt.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                              {stage.stage_name}
                            </span>
                            {!stage.is_active && (
                              <span className="text-xs text-gray-400">(inactive)</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {stage.required_approvals} approval{stage.required_approvals !== 1 ? 's' : ''} required
                            {' · '}
                            Minimum role: {stage.required_role}
                            {' · '}
                            Order: {stage.stage_order ?? (index + 1)}
                            {stage.assigned_approvers?.length > 0 && (
                              <>
                                {' · '}
                                Approvers: {stage.assigned_approvers.map(a => a.username).join(', ')}
                              </>
                            )}
                          </div>
                          {/* Pipeline type badges */}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(stage.pipeline_types || []).map((pt) => {
                              const ptOption = PIPELINE_TYPE_OPTIONS.find(o => o.value === pt);
                              return (
                                <span
                                  key={pt}
                                  className={`px-1.5 py-0.5 rounded text-xs font-medium ${ptOption?.color || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
                                >
                                  {ptOption?.label || pt}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {editingStage?.id === stage.id ? (
                          <>
                            <button
                              onClick={handleUpdate}
                              disabled={updateMutation.isPending}
                              className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                              title="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingStage(null)}
                              className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : managingApprovers === stage.id ? (
                          <button
                            onClick={() => setManagingApprovers(null)}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                            title="Close approvers"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => setManagingApprovers(stage.id)}
                              className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                              title="Manage approvers"
                            >
                              <Users className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingStage({ ...stage })}
                              className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(stage)}
                              className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                      {/* Approver Management Panel */}
                      {managingApprovers === stage.id && (
                        <div className="mx-3 mb-3 p-3 bg-gray-50 dark:bg-[#333] rounded-lg border border-gray-200 dark:border-[#444]">
                          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                            Assigned Approvers {stage.assigned_approvers?.length > 0 && `(${stage.assigned_approvers.length})`}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            {eligibleUsers.length === 0
                              ? 'No eligible users found.'
                              : 'Select users who can approve at this stage. If none selected, any user with the minimum role can approve.'}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {eligibleUsers.map(user => {
                              const isAssigned = stage.assigned_approvers?.some(a => a.user_id === user.id);
                              return (
                                <button
                                  key={user.id}
                                  onClick={() => handleToggleApprover(stage.id, user.id, stage.assigned_approvers || [])}
                                  disabled={setApproversMutation.isPending}
                                  className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                                    isAssigned
                                      ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                                      : 'bg-white dark:bg-[#2a2a2a] border-gray-300 dark:border-[#444] text-gray-600 dark:text-gray-400 hover:border-primary-300 dark:hover:border-primary-600'
                                  }`}
                                >
                                  {user.username} ({user.role})
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Info note */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          ECOs progress through stages in order. Each stage must receive its required number of approvals before advancing.
          Stages with the same order number run in parallel -- all must be completed before proceeding.
          You can assign specific users to each stage -- if approvers are assigned, only those users (and admins) can approve at that stage.
          If no approvers are assigned, any user with the minimum role can approve.
          Stage tags control which ECO changes a stage applies to.
        </p>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Delete Approval Stage
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Delete stage &quot;{deleteConfirm.stage_name}&quot;? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-md transition-colors"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalStagesSettings;
