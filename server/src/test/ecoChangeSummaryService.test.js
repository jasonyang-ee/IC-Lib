import { describe, expect, it } from 'vitest';
import {
  normalizeEcoChangeRows,
  normalizeEcoChangeSummaryValue,
} from '../services/ecoChangeSummaryService.js';

describe('ecoChangeSummaryService', () => {
  it('deduplicates paired CAD summary values while preserving order', () => {
    expect(normalizeEcoChangeSummaryValue(
      'pcb_footprint',
      '8-soic_l,8-soic_l,8-soic_m,8-soic_m,8-soic_n,8-soic_n',
    )).toBe('8-soic_l,8-soic_m,8-soic_n');
  });

  it('leaves non-CAD summary values unchanged', () => {
    expect(normalizeEcoChangeSummaryValue('description', 'OPA1611AID,OPA1611AID')).toBe('OPA1611AID,OPA1611AID');
  });

  it('normalizes both old and new values across change rows', () => {
    expect(normalizeEcoChangeRows([
      {
        field_name: 'pad_file',
        old_value: 'old_a,old_a',
        new_value: 'new_a,new_a,new_b',
      },
      {
        field_name: 'value',
        old_value: 'OPA1611AID',
        new_value: 'OPA1611AID',
      },
    ])).toEqual([
      {
        field_name: 'pad_file',
        old_value: 'old_a',
        new_value: 'new_a,new_b',
      },
      {
        field_name: 'value',
        old_value: 'OPA1611AID',
        new_value: 'OPA1611AID',
      },
    ]);
  });
});