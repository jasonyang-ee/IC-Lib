import { describe, expect, it } from 'vitest';

import {
  canDirectEditComponentInEcoMode,
  getAllowedEcoStatusProposals,
  resolveEcoLifecyclePipelineType,
  shouldStageSharedRenameForStatus,
} from '../services/componentLifecycleService.js';

describe('componentLifecycleService', () => {
  it('only allows direct ECO-mode edits for admin users or new parts that keep new status', () => {
    expect(canDirectEditComponentInEcoMode({
      role: 'lab',
      currentApprovalStatus: 'new',
      requestedApprovalStatus: 'new',
    })).toBe(true);

    expect(canDirectEditComponentInEcoMode({
      role: 'read-write',
      currentApprovalStatus: 'prototype',
      requestedApprovalStatus: 'prototype',
    })).toBe(false);

    expect(canDirectEditComponentInEcoMode({
      role: 'read-write',
      currentApprovalStatus: 'new',
      requestedApprovalStatus: 'prototype',
    })).toBe(false);

    expect(canDirectEditComponentInEcoMode({
      role: 'admin',
      currentApprovalStatus: 'production',
      requestedApprovalStatus: 'new',
    })).toBe(true);
  });

  it('keeps ECO status proposals aligned with the supported lifecycle transitions', () => {
    expect(getAllowedEcoStatusProposals('new')).toEqual(['prototype']);
    expect(getAllowedEcoStatusProposals('production')).toEqual(['prototype', 'archived']);
  });

  it('maps lifecycle transitions to the controlling approval tag', () => {
    expect(resolveEcoLifecyclePipelineType({
      currentApprovalStatus: 'new',
      proposedStatus: 'prototype',
    })).toBe('proto_status_change');

    expect(resolveEcoLifecyclePipelineType({
      currentApprovalStatus: 'prototype',
      proposedStatus: 'production',
    })).toBe('prod_status_change');

    expect(resolveEcoLifecyclePipelineType({
      currentApprovalStatus: 'production',
      proposedStatus: 'prototype',
    })).toBe('prod_status_change');

    expect(resolveEcoLifecyclePipelineType({
      currentApprovalStatus: 'prototype',
      proposedStatus: 'archived',
    })).toBe('proto_status_change');
  });

  it('skips new parts when deciding whether a shared rename should stage ECO review status changes', () => {
    expect(shouldStageSharedRenameForStatus('new')).toBe(false);
    expect(shouldStageSharedRenameForStatus('prototype')).toBe(true);
  });
});
