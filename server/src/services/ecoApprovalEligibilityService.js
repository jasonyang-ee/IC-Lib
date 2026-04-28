export const ROLE_HIERARCHY = {
  'read-only': 0,
  reviewer: 1,
  lab: 2,
  'read-write': 2,
  approver: 3,
  admin: 4,
};

export const canUserSatisfyStageRole = (userRole, requiredRole = 'approver') => {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || ROLE_HIERARCHY.approver;

  return userLevel >= requiredLevel;
};

export const canDelegateToRole = (userRole, delegateRole) => {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const delegateLevel = ROLE_HIERARCHY[delegateRole] || 0;

  return delegateLevel >= userLevel;
};

export const resolveEffectiveApproverId = ({
  stageApprovers,
  actingUserId,
  usedApproverIds = [],
}) => {
  const approvers = Array.isArray(stageApprovers) ? stageApprovers : [];
  const usedIds = new Set(Array.isArray(usedApproverIds) ? usedApproverIds : []);

  const directApprover = approvers.find(
    ({ user_id: assignedUserId }) => assignedUserId === actingUserId && !usedIds.has(assignedUserId),
  );

  if (directApprover) {
    return directApprover.user_id;
  }

  const delegatedApprover = approvers.find(
    ({ user_id: assignedUserId, delegation }) => delegation === actingUserId && !usedIds.has(assignedUserId),
  );

  return delegatedApprover?.user_id || null;
};
