import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ECO_PDF_HEADER,
  formatEcoNumber,
  normalizeEcoSettingsRow,
  sanitizeEcoPdfHeaderText,
} from '../services/ecoSettingsService.js';

describe('ecoSettingsService', () => {
  it('formats ECO numbers without leading zero padding', () => {
    expect(formatEcoNumber('ECO-', 1)).toBe('ECO-1');
    expect(formatEcoNumber('ECO-', 27)).toBe('ECO-27');
  });

  it('normalizes ECO settings rows to plain sequential numbering', () => {
    expect(normalizeEcoSettingsRow({ prefix: 'ECO-', leading_zeros: 6, next_number: 42 })).toMatchObject({
      prefix: 'ECO-',
      leading_zeros: 1,
      next_number: 42,
    });
  });

  it('falls back to default PDF header when custom text is empty', () => {
    expect(sanitizeEcoPdfHeaderText('   ')).toBe(DEFAULT_ECO_PDF_HEADER);
    expect(sanitizeEcoPdfHeaderText('Custom ECO Header')).toBe('Custom ECO Header');
  });
});