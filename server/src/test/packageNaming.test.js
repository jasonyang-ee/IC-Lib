import { describe, expect, it } from 'vitest';

import {
  buildCanonicalName,
  foldAliasKey,
  parsePackageInput,
  remapDensity,
} from '../utils/packageNaming.js';

describe('packageNaming', () => {
  const catalog = [
    { short_name: 'SOIC', count_policy: 'append', aliases: [{ alias: 'SOIC' }] },
    { short_name: 'VQFN', count_policy: 'append', aliases: [{ alias: 'VQFN' }] },
    { short_name: 'VFQFN', count_policy: 'append', aliases: [{ alias: 'VFQFN' }] },
    { short_name: 'TSOT-23-5', count_policy: 'embedded', aliases: [{ alias: 'TSOT-23-5' }, { alias: 'SOT-23-5 Thin' }] },
    { short_name: 'SOT-23-5', count_policy: 'embedded', aliases: [{ alias: 'SOT-23-5' }, { alias: 'SC-74A' }, { alias: 'SOT-753' }] },
    { short_name: 'DPAK', count_policy: 'none', aliases: [{ alias: 'DPAK' }, { alias: 'TO-252' }] },
    { short_name: 'QFN', count_policy: 'append', aliases: [{ alias: 'QFN' }] },
    { short_name: 'TSSOP', count_policy: 'append', aliases: [{ alias: 'TSSOP' }] },
  ];
  it('folds aliases case- and separator-insensitively', () => {
    expect(foldAliasKey(' TO-236_3 ')).toBe('to2363');
    expect(foldAliasKey('to 236 3')).toBe('to2363');
  });

  it('remaps IPC density letters semantically', () => {
    expect(remapDensity('M')).toBe('A');
    expect(remapDensity('n')).toBe('B');
    expect(remapDensity('L')).toBe('C');
    expect(remapDensity('B')).toBe('B');
    expect(remapDensity('x')).toBeNull();
  });

  it.each([
    ['_m', 'A'], ['_n', 'B'], ['_l', 'C'], ['_M', 'A'], ['_N', 'B'], ['_L', 'C'],
    ['-m', 'A'], ['-n', 'B'], ['-l', 'C'], ['-M', 'A'], ['-N', 'B'], ['-L', 'C'],
    ['_a', 'A'], ['_b', 'B'], ['_c', 'C'], ['_A', 'A'], ['_B', 'B'], ['_C', 'C'],
  ])('accepts %s density suffixes and emits %s', (suffix, density) => {
    expect(parsePackageInput(`SOIC-8${suffix}`).density).toBe(density);
  });

  it('does not invent a density suffix when input has none', () => {
    expect(parsePackageInput('SOIC-8').density).toBeNull();
    expect(buildCanonicalName({ shortName: 'SOIC', pinCount: '8', countPolicy: 'append' })).toBe('SOIC-8');
  });

  it.each([
    ['QFN50P500X500X80-29N', 'QFN', '29', 'B'],
    ['QFP80P1200X1200X160-48M', 'QFP', '48', 'A'],
    ['SOP127P1030X340X150-8L', 'SOP', '8', 'C'],
    ['DFN50P200X200X80-8N', 'DFN', '8', 'B'],
    ['SOIC127P1000X400X150-8M', 'SOIC', '8', 'A'],
    ['SOT95P280X145X100-5L', 'SOT', '5', 'C'],
    ['LGA50P400X400X100-16N', 'LGA', '16', 'B'],
    ['BGA80P1000X1000X120-100', 'BGA', '100', null],
  ])('collapses IPC-7351B %s', (input, shortName, pinCount, density) => {
    expect(parsePackageInput(input)).toMatchObject({ shortName, pinCount, density });
  });

  it.each([
    'QFN50P500X500X80-20_24N',
    'QFN50P500X500X80-24_20N',
    'QFN50P500X500X80-20RN',
  ])('does not collapse ambiguous IPC-7351B variant %s', (input) => {
    expect(parsePackageInput(input)).toBeNull();
  });

  it('builds canonical names according to count policy', () => {
    expect(buildCanonicalName({ shortName: '0603', pinCount: '2', density: 'A', countPolicy: 'chip' })).toBe('0603_A');
    expect(buildCanonicalName({ shortName: 'SOT-23-3', pinCount: '3', density: 'B', countPolicy: 'embedded' })).toBe('SOT-23-3_B');
    expect(buildCanonicalName({ shortName: 'SOD-123', pinCount: '2', density: 'C', countPolicy: 'none' })).toBe('SOD-123_C');
    expect(buildCanonicalName({ shortName: 'SOIC', pinCount: '8', density: 'A', countPolicy: 'append' })).toBe('SOIC-8_A');
    expect(buildCanonicalName({ shortName: 'SOIC', density: 'A', countPolicy: 'append' })).toBeNull();
  });

  it('parses a simple package identity without catalog access', () => {
    expect(parsePackageInput('SOIC-8_N')).toEqual({
      shortName: 'SOIC',
      pinCount: '8',
      density: 'B',
      modifiers: [],
      matchedAliasKey: 'soic',
    });
  });

  it.each([
    ['8-SOIC (0.154", 3.90mm Width)', 'SOIC', '8', 'SOIC-8'],
    ['8-SOIC (0.209", 5.30mm Width)', 'SOIC', '8', 'SOIC-8'],
    ['16-VQFN Exposed Pad', 'VQFN', '16', 'VQFN-16'],
    ['16-VQFN, CSP', 'VQFN', '16', 'VQFN-16'],
    ['16-VFQFN Exposed Pad', 'VFQFN', '16', 'VFQFN-16'],
    ['64-VFQFN Exposed Pad', 'VFQFN', '64', 'VFQFN-64'],
    ['SOT-23-5 Thin, TSOT-23-5', 'TSOT-23-5', '5', 'TSOT-23-5'],
    ['SC-74A, SOT-753', 'SOT-23-5', '5', 'SOT-23-5'],
    ['TO-252-3, DPAK', 'DPAK', '3', 'DPAK'],
    ['TO-252-3, DPAK (2 Leads + Tab), SC-63', 'DPAK', '3', 'DPAK'],
    ['64-QFN', 'QFN', '64', 'QFN-64'],
    ['48-QFN', 'QFN', '48', 'QFN-48'],
    ['32-QFN', 'QFN', '32', 'QFN-32'],
    ['20-QFN', 'QFN', '20', 'QFN-20'],
    ['14-TSSOP (0.173", 4.40mm Width)', 'TSSOP', '14', 'TSSOP-14'],
  ])('resolves vendor package text %s against passed catalog rows', (input, shortName, pinCount, canonicalName) => {
    const parsed = parsePackageInput(input, catalog);
    const packageRow = catalog.find(row => row.short_name === shortName);

    expect(parsed).toMatchObject({ shortName, pinCount });
    expect(buildCanonicalName({
      shortName: parsed.shortName,
      pinCount: parsed.pinCount,
      density: parsed.density,
      countPolicy: packageRow.count_policy,
    })).toBe(canonicalName);
  });

  it('tries an unmodified alias before stripping its terminal modifier', () => {
    expect(parsePackageInput('SOT-23-5 Thin', catalog)).toMatchObject({ shortName: 'TSOT-23-5', pinCount: '5' });
  });
});
