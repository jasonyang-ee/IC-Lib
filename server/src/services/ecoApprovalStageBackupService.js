import {
  DEFAULT_STAGE_PIPELINE_TYPES,
  normalizeStagePipelineTypes,
} from './ecoPipelineService.js';

export const APPROVAL_STAGE_BACKUP_VERSION = '1.0.0';
export class ApprovalStageImportValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ApprovalStageImportValidationError';
  }
}

const getApproverUsername = (approver) => {
  if (typeof approver === 'string') {
    return approver.trim();
  }

  if (approver && typeof approver === 'object' && typeof approver.username === 'string') {
    return approver.username.trim();
  }

  return '';
};

export const normalizeImportedApprovalStages = (stages) => {
  if (!Array.isArray(stages)) {
    throw new ApprovalStageImportValidationError('Stages array is required');
  }

  if (stages.length === 0) {
    throw new ApprovalStageImportValidationError('At least one approval stage is required');
  }

  return stages
    .map((stage, index) => {
      if (!stage || typeof stage !== 'object') {
        throw new ApprovalStageImportValidationError(`Stage ${index + 1} is invalid`);
      }

      const stageName = typeof stage.stage_name === 'string' ? stage.stage_name.trim() : '';
      if (!stageName) {
        throw new ApprovalStageImportValidationError(`Stage ${index + 1} is missing a stage_name`);
      }

      const requiredApprovals = Math.max(1, Number.parseInt(stage.required_approvals, 10) || 1);
      const stageOrder = Math.max(1, Number.parseInt(stage.stage_order, 10) || (index + 1));
      const approverUsernames = [...new Set(
        (Array.isArray(stage.assigned_approvers) ? stage.assigned_approvers : [])
          .map(getApproverUsername)
          .filter(Boolean),
      )];

      return {
        stage_name: stageName,
        required_approvals: requiredApprovals,
        required_role: stage.required_role || 'approver',
        is_active: stage.is_active !== false,
        stage_order: stageOrder,
        pipeline_types: normalizeStagePipelineTypes(
          Array.isArray(stage.pipeline_types) && stage.pipeline_types.length > 0
            ? stage.pipeline_types
            : [...DEFAULT_STAGE_PIPELINE_TYPES],
        ),
        assigned_approver_usernames: approverUsernames,
        _original_index: index,
      };
    })
    .sort((left, right) => (
      left.stage_order - right.stage_order || left._original_index - right._original_index
    ));
};

export const resolveImportedApproverIds = (approverUsernames, users) => {
  const userMap = new Map(
    (Array.isArray(users) ? users : []).map((user) => [String(user.username || '').trim().toLowerCase(), user.id]),
  );

  const assignedUserIds = [];
  const skippedUsernames = [];

  for (const username of Array.isArray(approverUsernames) ? approverUsernames : []) {
    const normalizedUsername = String(username || '').trim().toLowerCase();

    if (!normalizedUsername) {
      continue;
    }

    const userId = userMap.get(normalizedUsername);
    if (userId) {
      assignedUserIds.push(userId);
    } else {
      skippedUsernames.push(username);
    }
  }

  return {
    assignedUserIds: [...new Set(assignedUserIds)],
    skippedUsernames,
  };
};

export const buildApprovalStageExportData = ({ stages, exportedBy, exportedAt = new Date().toISOString() }) => ({
  type: 'eco-approval-stages',
  version: APPROVAL_STAGE_BACKUP_VERSION,
  exportedAt,
  exportedBy: exportedBy || 'unknown',
  stages: (Array.isArray(stages) ? stages : []).map((stage) => ({
    stage_name: stage.stage_name,
    stage_order: stage.stage_order,
    required_approvals: stage.required_approvals,
    required_role: stage.required_role,
    is_active: stage.is_active !== false,
    pipeline_types: normalizeStagePipelineTypes(stage.pipeline_types),
    assigned_approvers: (Array.isArray(stage.assigned_approvers) ? stage.assigned_approvers : []).map((approver) => ({
      username: approver.username,
      role: approver.role,
    })),
  })),
});