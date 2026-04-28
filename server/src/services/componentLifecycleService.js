export const ECO_STATUS_PROPOSAL_OPTIONS = Object.freeze({
  new: ['prototype'],
  reviewing: ['archived'],
  prototype: ['production', 'archived'],
  production: ['prototype', 'archived'],
  archived: ['prototype', 'production'],
});

export const getAllowedEcoStatusProposals = (currentApprovalStatus) => (
  ECO_STATUS_PROPOSAL_OPTIONS[currentApprovalStatus] || []
);

export const isEcoStatusProposalAllowed = ({
  currentApprovalStatus,
  proposedStatus,
} = {}) => getAllowedEcoStatusProposals(currentApprovalStatus).includes(proposedStatus);

export const canDirectEditComponentInEcoMode = ({
  role,
  currentApprovalStatus,
  requestedApprovalStatus,
} = {}) => {
  if (role === 'admin') {
    return true;
  }

  if (currentApprovalStatus !== 'new') {
    return false;
  }

  if (requestedApprovalStatus === undefined || requestedApprovalStatus === null || requestedApprovalStatus === '') {
    return true;
  }

  return requestedApprovalStatus === currentApprovalStatus;
};

export const resolveEcoLifecyclePipelineType = ({
  currentApprovalStatus,
  proposedStatus = null,
} = {}) => {
  switch (currentApprovalStatus) {
    case 'new':
      return proposedStatus === 'prototype' ? 'proto_status_change' : null;
    case 'reviewing':
    case 'prototype':
      return proposedStatus === 'production' ? 'prod_status_change' : 'proto_status_change';
    case 'production':
      return 'prod_status_change';
    case 'archived':
      if (proposedStatus === 'production') {
        return 'prod_status_change';
      }
      if (proposedStatus === 'prototype') {
        return 'proto_status_change';
      }
      return null;
    default:
      if (proposedStatus === 'production') {
        return 'prod_status_change';
      }
      if (proposedStatus === 'prototype') {
        return 'proto_status_change';
      }
      return null;
  }
};

export const shouldStageSharedRenameForStatus = (approvalStatus) => approvalStatus !== 'new';
