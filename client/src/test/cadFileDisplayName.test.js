import { describe, expect, it } from 'vitest';

import { buildCadShortcutFilename, formatCadFileDisplayName } from '../utils/cadFileNaming';

describe('formatCadFileDisplayName', () => {
  it('shows a stored footprint density letter uppercase', () => {
    expect(formatCadFileDisplayName('dip-8_a.psm')).toBe('dip-8_A.psm');
    expect(formatCadFileDisplayName('soic-8_b.dra')).toBe('soic-8_B.dra');
    expect(formatCadFileDisplayName('dip-8_a', 'footprint')).toBe('dip-8_A');
  });

  it('shows a CAD extension lowercase even on a legacy stored name', () => {
    expect(formatCadFileDisplayName('SOIC-8_B.STEP')).toBe('SOIC-8_B.step');
    expect(formatCadFileDisplayName('My.Symbol.OLB')).toBe('My.Symbol.olb');
  });

  it('leaves a symbol or model base case alone', () => {
    expect(formatCadFileDisplayName('Sensor_a.step')).toBe('Sensor_a.step');
  });

  it('never feeds a rename payload - the stored name still drives the new name', () => {
    const stored = 'dip-8_a.psm';

    expect(formatCadFileDisplayName(stored)).toBe('dip-8_A.psm');
    expect(buildCadShortcutFilename(stored, 'SOIC-8', 'footprint')).toBe('soic-8_a.psm');
  });

  it('tolerates empty and non-string input', () => {
    expect(formatCadFileDisplayName('')).toBe('');
    expect(formatCadFileDisplayName(undefined)).toBe('');
  });
});
