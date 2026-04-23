import { describe, expect, it } from 'vitest';

import { resolveEcoApprovalProgress } from '../services/ecoApprovalProgressService.js';

const buildStage = (overrides = {}) => ({
  id: overrides.id ?? 1,
  stage_name: overrides.stage_name ?? 'Stage',
  stage_order: overrides.stage_order ?? 1,
  required_approvals: overrides.required_approvals ?? 1,
  is_active: overrides.is_active ?? true,
  pipeline_types: overrides.pipeline_types ?? ['prod_status_change', 'spec'],
});

describe('resolveEcoApprovalProgress', () => {
  it('advances to the next matching order when the stored current order no longer matches', () => {
    const resolution = resolveEcoApprovalProgress(
      {
        current_stage_order: '2',
        pipeline_types: ['prod_status_change', 'spec'],
      },
      [
        buildStage({
          id: 20,
          stage_name: 'Old Purchasing Gate',
          stage_order: '2',
          pipeline_types: ['prod_status_change', 'distributor'],
        }),
        buildStage({
          id: 30,
          stage_name: 'EE Director',
          stage_order: '3',
        }),
      ],
    );

    expect(resolution.currentStageOrder).toBe(3);
    expect(resolution.currentStages.map((stage) => stage.stage_name)).toEqual(['EE Director']);
    expect(resolution.approvalComplete).toBe(false);
    expect(resolution.currentStageConfigurationMismatch).toBe(false);
  });

  it('treats the ECO as complete when there are no later matching stages after tags change', () => {
    const resolution = resolveEcoApprovalProgress(
      {
        current_stage_order: 3,
        pipeline_types: ['prod_status_change', 'spec'],
      },
      [
        buildStage({
          id: 30,
          stage_name: 'Production Planning',
          stage_order: 3,
          pipeline_types: ['prod_status_change', 'distributor'],
        }),
      ],
    );

    expect(resolution.currentStageOrder).toBeNull();
    expect(resolution.currentStages).toEqual([]);
    expect(resolution.approvalComplete).toBe(true);
    expect(resolution.currentStageConfigurationMismatch).toBe(false);
  });

  it('skips matching orders that are already complete and returns the next incomplete order', () => {
    const resolution = resolveEcoApprovalProgress(
      {
        current_stage_order: 2,
        pipeline_types: ['prod_status_change', 'spec'],
      },
      [
        buildStage({ id: 20, stage_name: 'EE Manager', stage_order: 2 }),
        buildStage({ id: 30, stage_name: 'EE Director', stage_order: 3 }),
      ],
      new Map([[20, 1]]),
    );

    expect(resolution.currentStageOrder).toBe(3);
    expect(resolution.currentStages.map((stage) => stage.stage_name)).toEqual(['EE Director']);
    expect(resolution.approvalComplete).toBe(false);
  });
});