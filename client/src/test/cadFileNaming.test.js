import { describe, expect, it } from 'vitest';

import {
  buildCadShortcutFilename,
  extractCadDensitySuffix,
  extractPackageLabel,
  formatCanonicalPackageFilenameBase,
  formatPackageFilenameBase,
} from '../utils/cadFileNaming';

describe('cadFileNaming', () => {
  it('drops trailing dimensional notes from package labels', () => {
    expect(extractPackageLabel('8-SOIC (0.154", 3.90mm Width)')).toBe('8-SOIC');
  });

  it('keeps descriptive package names that are not dimensional notes', () => {
    expect(extractPackageLabel('16-VQFN Exposed Pad')).toBe('16-VQFN Exposed Pad');
  });

  it('uses the first package alias when multiple aliases are listed', () => {
    expect(formatPackageFilenameBase('SOT-23-5 Thin, TSOT-23-5')).toBe('SOT-23-5_Thin');
  });

  it('sanitizes spaces for filenames after trimming dimensional notes', () => {
    expect(formatPackageFilenameBase('8-SOIC (0.154", 3.90mm Width)')).toBe('8-SOIC');
  });

  it('remaps legacy density suffixes semantically for display-independent disk names', () => {
    expect(extractCadDensitySuffix('8-soic_L.dra')).toEqual({
      base: '8-soic',
      suffix: '_c',
      ext: '.dra',
    });
  });

  it.each([
    ['footprint', '8-soic_N.psm', 'soic-8_b.psm'],
    ['symbol', '8-SOIC_N.OLB', 'SOIC-8_B.olb'],
    ['model', '8-SOIC_N.STEP', 'SOIC-8_B.step'],
  ])('builds package shortcut filenames with %s case policy', (fileType, currentFilename, expectedFilename) => {
    const packageBase = formatCanonicalPackageFilenameBase('8-SOIC (0.154", 3.90mm Width)', {
      package: { short_name: 'SOIC', count_policy: 'append' },
      pinCount: 8,
    });

    expect(buildCadShortcutFilename(currentFilename, packageBase, fileType)).toBe(expectedFilename);
  });

  it.each([
    ['footprint', 'old_N.psm', 'mfg_123_b.psm'],
    ['symbol', 'old_N.OLB', 'MFG_123_B.olb'],
    ['model', 'old_N.STEP', 'MFG_123_B.step'],
  ])('builds MPN shortcut filenames with %s case policy', (fileType, currentFilename, expectedFilename) => {
    expect(buildCadShortcutFilename(currentFilename, 'mfg_123', fileType)).toBe(expectedFilename);
  });

  it('keeps PSpice shortcut casing outside the package-canonicalization scope', () => {
    expect(buildCadShortcutFilename('old_N.OLB', 'mfg_123', 'pspice')).toBe('mfg_123_b.olb');
  });
});
