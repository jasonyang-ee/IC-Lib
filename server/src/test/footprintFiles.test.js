import { describe, expect, it } from 'vitest';

import {
  FootprintNameError,
  assertNoPlusInFootprintName,
  buildFootprintRenameTargets,
  normalizeCadUploadFilename,
  normalizeFootprintFilename,
  sanitizeFootprintBaseName,
} from '../utils/footprintFiles.js';

describe('footprintFiles', () => {
  it('lowercases all footprint filenames (.psm, .bsm, .dra)', () => {
    expect(normalizeFootprintFilename('SOIC8_L.psm')).toBe('soic8_l.psm');
    expect(normalizeFootprintFilename('SOIC8_L.BSM')).toBe('soic8_l.bsm');
    expect(normalizeFootprintFilename('MXM3_N.dra')).toBe('mxm3_n.dra');
  });

  it('drops every dot in the base (extension = last-dot segment)', () => {
    expect(normalizeFootprintFilename('My.Part.V2.psm')).toBe('mypartv2.psm');
    expect(normalizeFootprintFilename('a.b.c.psm')).toBe('abc.psm');
    expect(normalizeFootprintFilename('VSSOP-8_l.dra')).toBe('vssop-8_l.dra');
  });

  it('leaves non-footprint extensions alone except lowercasing the extension', () => {
    expect(normalizeFootprintFilename('My.Symbol.OLB')).toBe('My.Symbol.olb');
    expect(normalizeCadUploadFilename('Model.V2.STEP')).toBe('Model.V2.step');
  });

  it('rejects "+" in footprint names with a typed error', () => {
    expect(() => assertNoPlusInFootprintName('ds2431+.psm')).toThrow(FootprintNameError);
    expect(() => assertNoPlusInFootprintName('ds2431+.psm')).toThrow(/"\+" is not allowed/);
    expect(assertNoPlusInFootprintName('ds2431.psm')).toBe('ds2431.psm');
  });

  it('sanitizes footprint base names: specials, spaces, dots, case', () => {
    expect(sanitizeFootprintBaseName('My.Part V2')).toBe('mypart_v2');
    expect(sanitizeFootprintBaseName('NEW NAME')).toBe('new_name');
    expect(sanitizeFootprintBaseName('foo.psm')).toBe('foo'); // full filename input
  });

  it('renames a .bsm + .dra footprint pair together, fully normalized', () => {
    expect(buildFootprintRenameTargets(['QFN50.bsm', 'QFN50.dra'], 'NEW_NAME')).toEqual([
      { oldFileName: 'QFN50.bsm', newFileName: 'new_name.bsm' },
      { oldFileName: 'QFN50.dra', newFileName: 'new_name.dra' },
    ]);
  });

  it('pair rename to an uppercase dotted base yields a consistent shared base', () => {
    const targets = buildFootprintRenameTargets(['foo.psm', 'FOO.dra'], 'Adapter.V2');
    expect(targets.map((target) => target.newFileName)).toEqual(['adapterv2.psm', 'adapterv2.dra']);
  });

  it('rejects "+" in pair rename base names', () => {
    expect(() => buildFootprintRenameTargets(['foo.psm', 'foo.dra'], 'DS2431+')).toThrow(FootprintNameError);
  });

  it('two distinct inputs can normalize to the same name (collision checks fire on it)', () => {
    expect(normalizeFootprintFilename('A.B.psm')).toBe(normalizeFootprintFilename('ab.psm'));
  });
});
