import { describe, expect, it } from 'vitest';
import {
  canDelegateToRole,
  canUserSatisfyStageRole,
  resolveEffectiveApproverId,
} from '../services/ecoApprovalEligibilityService.js';

describe('ecoApprovalEligibilityService', () => {
  it('enforces required stage roles', () => {
    expect(canUserSatisfyStageRole('approver', 'reviewer')).toBe(true);
    expect(canUserSatisfyStageRole('reviewer', 'approver')).toBe(false);
  });

  it('allows delegation only to the same or higher role', () => {
    expect(canDelegateToRole('reviewer', 'reviewer')).toBe(true);
    expect(canDelegateToRole('reviewer', 'approver')).toBe(true);
    expect(canDelegateToRole('approver', 'reviewer')).toBe(false);
  });

  it('allows the directly assigned approver to use their own slot', () => {
    expect(resolveEffectiveApproverId({
      stageApprovers: [{ user_id: 'user-a', delegation: 'user-b' }],
      actingUserId: 'user-a',
      usedApproverIds: [],
    })).toBe('user-a');
  });

  it('allows a delegated user to act for an assigned approver', () => {
    expect(resolveEffectiveApproverId({
      stageApprovers: [{ user_id: 'user-a', delegation: 'user-b' }],
      actingUserId: 'user-b',
      usedApproverIds: [],
    })).toBe('user-a');
  });

  it('rejects users who are neither assigned nor delegated', () => {
    expect(resolveEffectiveApproverId({
      stageApprovers: [{ user_id: 'user-a', delegation: 'user-b' }],
      actingUserId: 'admin-user',
      usedApproverIds: [],
    })).toBeNull();
  });

  it('falls through to another delegated slot after a slot is already used', () => {
    expect(resolveEffectiveApproverId({
      stageApprovers: [
        { user_id: 'user-a', delegation: 'delegate-user' },
        { user_id: 'user-c', delegation: 'delegate-user' },
      ],
      actingUserId: 'delegate-user',
      usedApproverIds: ['user-a'],
    })).toBe('user-c');
  });
});