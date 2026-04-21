import { describe, expect, it } from 'vitest';

import { ecoMatchesPipelineType, getEcoPipelineTypes } from '../utils/ecoPipelineTypes';

describe('ecoPipelineTypes', () => {
  it('maps legacy spec/cad ECOs to spec and filename tags', () => {
    expect(getEcoPipelineTypes({ pipeline_type: 'spec_cad' })).toEqual(['spec', 'filename']);
  });

  it('prefers explicit pipeline tag arrays when available', () => {
    expect(getEcoPipelineTypes({ pipeline_type: 'spec', pipeline_types: ['prod_status_change', 'distributor'] })).toEqual([
      'prod_status_change',
      'distributor',
    ]);
  });

  it('matches ECO filters against any ECO tag', () => {
    const eco = { pipeline_types: ['prod_status_change', 'filename'] };

    expect(ecoMatchesPipelineType(eco, 'filename')).toBe(true);
    expect(ecoMatchesPipelineType(eco, 'distributor')).toBe(false);
  });
});