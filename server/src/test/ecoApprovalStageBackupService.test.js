import { describe, expect, it } from 'vitest';

import {
  buildApprovalStageExportData,
  normalizeImportedApprovalStages,
  resolveImportedApproverIds,
} from '../services/ecoApprovalStageBackupService.js';

describe('ecoApprovalStageBackupService', () => {
  it('normalizes imported stages and deduplicates approver usernames', () => {
    expect(normalizeImportedApprovalStages([
      {
        stage_name: '  Review  ',
        stage_order: '2',
        required_approvals: '0',
        pipeline_types: ['spec_cad'],
        assigned_approvers: [{ username: 'alice' }, { username: 'alice' }, 'bob'],
      },
    ])).toEqual([
      {
        stage_name: 'Review',
        required_approvals: 1,
        required_role: 'approver',
        is_active: true,
        stage_order: 2,
        pipeline_types: ['spec', 'filename'],
        assigned_approver_usernames: ['alice', 'bob'],
        _original_index: 0,
      },
    ]);
  });

  it('rejects empty imports', () => {
    expect(() => normalizeImportedApprovalStages([])).toThrow('At least one approval stage is required');
  });

  it('resolves approvers by username and skips missing users', () => {
    expect(resolveImportedApproverIds(['Alice', 'missing', 'Bob'], [
      { id: 'user-1', username: 'alice' },
      { id: 'user-2', username: 'bob' },
    ])).toEqual({
      assignedUserIds: ['user-1', 'user-2'],
      skippedUsernames: ['missing'],
    });
  });

  it('builds export data without leaking stage ids', () => {
    expect(buildApprovalStageExportData({
      exportedBy: 'admin',
      exportedAt: '2026-04-21T00:00:00.000Z',
      stages: [{
        id: 'stage-1',
        stage_name: 'QA',
        stage_order: 1,
        required_approvals: 2,
        required_role: 'approver',
        is_active: true,
        pipeline_types: ['general'],
        assigned_approvers: [{ user_id: 'user-1', username: 'alice', role: 'approver' }],
      }],
    })).toEqual({
      type: 'eco-approval-stages',
      version: '1.0.0',
      exportedAt: '2026-04-21T00:00:00.000Z',
      exportedBy: 'admin',
      stages: [{
        stage_name: 'QA',
        stage_order: 1,
        required_approvals: 2,
        required_role: 'approver',
        is_active: true,
        pipeline_types: ['proto_status_change', 'prod_status_change', 'spec', 'filename', 'shared_file_rename', 'distributor', 'alt_parts'],
        assigned_approvers: [{ username: 'alice', role: 'approver' }],
      }],
    });
  });
});
