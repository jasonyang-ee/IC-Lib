import { describe, expect, it } from 'vitest';

import { buildCadShortcutFilename, formatCadFileDisplayName } from '../utils/cadFileNaming';

describe('formatCadFileDisplayName', () => {
  it('shows a stored footprint base uppercase', () => {
    expect(formatCadFileDisplayName('dip-8_a.psm')).toBe('DIP-8_A.psm');
    expect(formatCadFileDisplayName('soic-8_b.dra')).toBe('SOIC-8_B.dra');
    expect(formatCadFileDisplayName('dip-8_a', 'footprint')).toBe('DIP-8_A');
  });

  it('shows a custom MPN-named footprint uppercase', () => {
    expect(formatCadFileDisplayName('max17761atp.psm')).toBe('MAX17761ATP.psm');
    expect(formatCadFileDisplayName('esp32-wroom-32.psm')).toBe('ESP32-WROOM-32.psm');
  });

  it('uppercases a legacy density letter without remapping it', () => {
    // `_m` is IPC Most Material Condition = density A, but display is a pure
    // case transform: remapping here would stop the reader mapping the name
    // back to the file on disk.
    expect(formatCadFileDisplayName('ltc3421euf_m.psm')).toBe('LTC3421EUF_M.psm');
  });

  it('changes a footprint name by case alone', () => {
    const stored = ['dip-8_a.psm', 'max17761atp.psm', 'ltc3421euf_m.psm', 'soic-8_b.dra'];

    stored.forEach((fileName) => {
      expect(formatCadFileDisplayName(fileName).toLowerCase()).toBe(fileName.toLowerCase());
    });
  });

  it('shows a CAD extension lowercase even on a legacy stored name', () => {
    expect(formatCadFileDisplayName('SOIC-8_B.STEP')).toBe('SOIC-8_B.step');
    expect(formatCadFileDisplayName('My.Symbol.OLB')).toBe('My.Symbol.olb');
  });

  it('leaves a symbol or model base case alone', () => {
    expect(formatCadFileDisplayName('Sensor_a.step')).toBe('Sensor_a.step');
  });

  it('needs an explicit file type when the name carries no extension', () => {
    // TEXT-column values and footprint pair bases have no extension to sniff.
    expect(formatCadFileDisplayName('dip-8_a')).toBe('dip-8_a');
    expect(formatCadFileDisplayName('dip-8_a', 'footprint')).toBe('DIP-8_A');
  });

  it('never feeds a rename payload - the stored name still drives the new name', () => {
    const stored = 'dip-8_a.psm';

    expect(formatCadFileDisplayName(stored)).toBe('DIP-8_A.psm');
    expect(buildCadShortcutFilename(stored, 'SOIC-8', 'footprint')).toBe('soic-8_a.psm');
  });

  it('tolerates empty and non-string input', () => {
    expect(formatCadFileDisplayName('')).toBe('');
    expect(formatCadFileDisplayName(undefined)).toBe('');
  });
});
