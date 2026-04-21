import { describe, expect, it } from 'vitest';
import { formatEcoNumber } from '../utils/ecoNumber';

describe('ecoNumber', () => {
  it('builds sequential ECO numbers without leading zero padding', () => {
    expect(formatEcoNumber('ECO-', 1)).toBe('ECO-1');
    expect(formatEcoNumber('ECO-', 123)).toBe('ECO-123');
  });

  it('falls back to first sequence number when input is invalid', () => {
    expect(formatEcoNumber('ECO-', 0)).toBe('ECO-1');
    expect(formatEcoNumber('ECO-', 'bad')).toBe('ECO-1');
  });
});