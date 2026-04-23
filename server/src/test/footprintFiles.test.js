import { describe, expect, it } from 'vitest';

import { buildFootprintRenameTargets, normalizeFootprintFilenameCase } from '../utils/footprintFiles.js';

describe('footprintFiles', () => {
  it('renames a .bsm + .dra footprint pair together', () => {
    expect(buildFootprintRenameTargets(['QFN50.bsm', 'QFN50.dra'], 'NEW_NAME')).toEqual([
      { oldFileName: 'QFN50.bsm', newFileName: 'NEW_NAME.bsm' },
      { oldFileName: 'QFN50.dra', newFileName: 'NEW_NAME.dra' },
    ]);
  });

  it('keeps .bsm case while lowercasing .psm filenames', () => {
    expect(normalizeFootprintFilenameCase('SOIC8_L.psm')).toBe('soic8_l.psm');
    expect(normalizeFootprintFilenameCase('SOIC8_L.bsm')).toBe('SOIC8_L.bsm');
  });
});