import { describe, expect, it } from 'vitest';

import {
  buildApprovalStageImportSummary,
  getApprovalStageBackupFilename,
  parseApprovalStageBackupFile,
} from '../utils/ecoApprovalStageBackup';

describe('ecoApprovalStageBackup', () => {
  it('parses a full backup object', () => {
    expect(parseApprovalStageBackupFile({
      type: 'eco-approval-stages',
      stages: [{ stage_name: 'Review' }],
    })).toEqual([{ stage_name: 'Review' }]);
  });

  it('rejects invalid backup payloads', () => {
    expect(() => parseApprovalStageBackupFile({ users: [] })).toThrow(
      'Invalid file format. Expected a JSON array or object with a stages array.',
    );
  });

  it('builds an import summary with skipped approvers', () => {
    expect(buildApprovalStageImportSummary({
      stages: { created: 1, updated: 2, deactivated: 1 },
      approvers: { assigned: 3, skipped: 2 },
    })).toBe('Import complete: 1 created, 2 updated, 1 deactivated, 3 approvers assigned, 2 skipped');
  });

  it('builds a dated backup filename', () => {
    expect(getApprovalStageBackupFilename(new Date('2026-04-21T12:00:00.000Z'))).toBe('eco-approval-stages-2026-04-21.json');
  });
});