import { describe, expect, it } from 'vitest';

import {
  buildCadShortcutFilename,
  extractCadDensitySuffix,
  extractPackageLabel,
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

  it('detects underscore density suffixes case-insensitively and normalizes them to lowercase', () => {
    expect(extractCadDensitySuffix('8-soic_L.dra')).toEqual({
      base: '8-soic',
      suffix: '_l',
      ext: '.dra',
    });
  });

  it('preserves n-density suffixes when building shortcut rename filenames', () => {
    expect(buildCadShortcutFilename('8-soic_N.psm', 'SOIC-8')).toBe('SOIC-8_n.psm');
  });

  it('keeps legacy dash density suffixes while normalizing the suffix letter to lowercase', () => {
    expect(buildCadShortcutFilename('QFN-M.OLB', 'ABC123')).toBe('ABC123-m.OLB');
  });
});