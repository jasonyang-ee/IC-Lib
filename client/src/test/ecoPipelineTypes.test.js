import { describe, expect, it } from 'vitest';

import { ecoMatchesPipelineType, getEcoPipelineTypes, getStagePipelineTypeGroups } from '../utils/ecoPipelineTypes';

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

  it('keeps the new alt-parts tag in explicit ECO tag arrays', () => {
    expect(getEcoPipelineTypes({ pipeline_types: ['prod_status_change', 'alt_parts'] })).toEqual([
      'prod_status_change',
      'alt_parts',
    ]);
  });

  it('groups stage tags into status and change rows for the admin settings UI', () => {
    expect(getStagePipelineTypeGroups(['prod_status_change', 'filename'])).toEqual([
      {
        id: 'status',
        label: 'Status Tags',
        values: ['proto_status_change', 'prod_status_change'],
        options: [
          expect.objectContaining({ value: 'proto_status_change', label: 'Proto Status' }),
          expect.objectContaining({ value: 'prod_status_change', label: 'Prod Status' }),
        ],
        selected: ['prod_status_change'],
      },
      {
        id: 'change',
        label: 'Change Tags',
        values: ['spec', 'filename', 'distributor', 'alt_parts'],
        options: [
          expect.objectContaining({ value: 'spec', label: 'Spec' }),
          expect.objectContaining({ value: 'filename', label: 'Filename' }),
          expect.objectContaining({ value: 'distributor', label: 'Distributor' }),
          expect.objectContaining({ value: 'alt_parts', label: 'Alt Parts' }),
        ],
        selected: ['filename'],
      },
    ]);
  });
});