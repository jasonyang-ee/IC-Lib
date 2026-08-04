import { describe, expect, it } from 'vitest';

import {
  groupFootprintFiles,
  hasIllegalFootprintPlus,
  normalizeFootprintFilename,
} from '../utils/footprintFiles';
import { buildCadShortcutFilename, formatPackageFilenameBase } from '../utils/cadFileNaming';

describe('footprintFiles', () => {
  it('groups .bsm and .dra files as one footprint pair', () => {
    const grouped = groupFootprintFiles(
      [
        { file_name: 'QFN50.bsm' },
        { file_name: 'QFN50.dra' },
      ],
      (file) => file.file_name,
    );

    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({
      type: 'pair',
      pairLabel: '.bsm/.dra',
    });
  });

  it('lowercases all footprint filenames and drops dots in the base', () => {
    expect(normalizeFootprintFilename('SOIC8_L.psm')).toBe('soic8_l.psm');
    expect(normalizeFootprintFilename('SOIC8_L.BSM')).toBe('soic8_l.bsm');
    expect(normalizeFootprintFilename('MXM3_N.dra')).toBe('mxm3_n.dra');
    expect(normalizeFootprintFilename('My.Part.V2.psm')).toBe('mypartv2.psm');
    // Non-footprint extensions keep their base, only the extension lowercases
    expect(normalizeFootprintFilename('My.Symbol.OLB')).toBe('My.Symbol.olb');
  });

  it('pair renames from both extensions normalize to one shared base', () => {
    expect(normalizeFootprintFilename('Adapter.V2.psm')).toBe('adapterv2.psm');
    expect(normalizeFootprintFilename('Adapter.V2.dra')).toBe('adapterv2.dra');
  });

  it('flags "+" only for footprint extensions', () => {
    expect(hasIllegalFootprintPlus('ds2431+.psm')).toBe(true);
    expect(hasIllegalFootprintPlus('ds2431+.dra')).toBe(true);
    expect(hasIllegalFootprintPlus('ds2431+.olb')).toBe(false);
    expect(hasIllegalFootprintPlus('ds2431.psm')).toBe(false);
  });

  it('normalizes dotted package-derived footprint names (7.0x7.0 style)', () => {
    const base = formatPackageFilenameBase('LGA-14 3.0x2.5');
    expect(base).toBe('LGA-14_3.0x2.5'); // package bases can contain dots
    const filename = buildCadShortcutFilename('old_name_l.psm', base);
    expect(normalizeFootprintFilename(filename)).toBe('lga-14_30x25_c.psm');
  });
});
