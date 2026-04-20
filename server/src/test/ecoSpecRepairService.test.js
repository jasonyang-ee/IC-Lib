import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/database.js', () => ({
  default: {
    connect: vi.fn(),
  },
}));

import { buildSequentialOrphanRepairPlan } from '../services/ecoSpecRepairService.js';

describe('buildSequentialOrphanRepairPlan', () => {
  it('maps orphan ECO specs when counts match exactly', () => {
    const orphanSpecs = [{ id: 'eco-1' }, { id: 'eco-2' }];
    const candidateSpecs = [
      { id: 'spec-1', spec_name: 'Voltage' },
      { id: 'spec-2', spec_name: 'Current' },
    ];

    const result = buildSequentialOrphanRepairPlan(orphanSpecs, candidateSpecs);

    expect(result.reason).toBeNull();
    expect(result.assignments).toEqual([
      { ecoSpecId: 'eco-1', categorySpecId: 'spec-1', specName: 'Voltage' },
      { ecoSpecId: 'eco-2', categorySpecId: 'spec-2', specName: 'Current' },
    ]);
  });

  it('refuses to guess when orphan and candidate counts differ', () => {
    const orphanSpecs = [{ id: 'eco-1' }];
    const candidateSpecs = [
      { id: 'spec-1', spec_name: 'Voltage' },
      { id: 'spec-2', spec_name: 'Current' },
    ];

    const result = buildSequentialOrphanRepairPlan(orphanSpecs, candidateSpecs);

    expect(result.assignments).toEqual([]);
    expect(result.reason).toContain('does not exactly match');
  });

  it('skips category specs that are already linked on the ECO', () => {
    const orphanSpecs = [{ id: 'eco-2' }];
    const candidateSpecs = [
      { id: 'spec-1', spec_name: 'Voltage' },
      { id: 'spec-2', spec_name: 'Current' },
    ];

    const result = buildSequentialOrphanRepairPlan(
      orphanSpecs,
      candidateSpecs,
      new Set(['spec-1']),
    );

    expect(result.reason).toBeNull();
    expect(result.assignments).toEqual([
      { ecoSpecId: 'eco-2', categorySpecId: 'spec-2', specName: 'Current' },
    ]);
  });
});
