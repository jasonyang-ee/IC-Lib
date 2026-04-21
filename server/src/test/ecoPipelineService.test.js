import { describe, expect, it } from 'vitest';

import {
  DEFAULT_STAGE_PIPELINE_TYPES,
  detectEcoPipelineTypes,
  getEcoPipelineTypes,
  normalizeStagePipelineTypes,
} from '../services/ecoPipelineService.js';

describe('ecoPipelineService', () => {
  it('maps a legacy general-only stage to all current approval tags', () => {
    expect(normalizeStagePipelineTypes(['general'])).toEqual(DEFAULT_STAGE_PIPELINE_TYPES);
  });

  it('splits legacy spec/cad stages into spec and filename tags', () => {
    expect(normalizeStagePipelineTypes(['spec_cad', 'general', 'distributor'])).toEqual([
      'spec',
      'filename',
      'distributor',
    ]);
  });

  it('maps a legacy ECO pipeline type to current ECO tags', () => {
    expect(getEcoPipelineTypes({ pipeline_type: 'spec_cad' })).toEqual(['spec', 'filename']);
  });

  it('tags production-part metadata changes with prod status and spec', () => {
    expect(detectEcoPipelineTypes({
      changes: [{ field_name: 'description', old_value: 'old', new_value: 'new' }],
      currentApprovalStatus: 'production',
    })).toEqual(['prod_status_change', 'spec']);
  });

  it('tags CAD link changes as filename changes without misclassifying them as spec', () => {
    expect(detectEcoPipelineTypes({
      changes: [{ field_name: 'schematic', old_value: 'OPA1611AID', new_value: 'OPA1611BID' }],
      cadFiles: [{ action: 'link', file_type: 'symbol', file_name: 'OPA1611BID.olb' }],
      currentApprovalStatus: 'production',
    })).toEqual(['prod_status_change', 'filename']);
  });

  it('ignores inventory-only distributor payloads for approval tagging', () => {
    expect(detectEcoPipelineTypes({
      distributors: [{ stock_quantity: 25, price_breaks: [{ quantity: 1, price: 0.12 }] }],
    })).toEqual([]);
  });
});