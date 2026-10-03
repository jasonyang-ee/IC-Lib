import { describe, expect, it } from 'vitest';
import { buildCadHealthRows } from '../utils/cadHealth';

describe('shared CAD health display', () => {
  it('uses the counted healthy assignments when undefined and missing overlap', () => {
    const rows = buildCadHealthRows({ totalComponents: 3, undefinedFootprints: 1, missingFootprints: 2, healthyCad: { footprint: 1 } });
    expect(rows.find(row => row.type === 'Footprint')).toEqual({ type: 'Footprint', undefined_count: 1, missing_count: 2, health: expect.closeTo(100 / 3) });
  });
  it('does not treat missing files as healthy in an older cached response', () => {
    expect(buildCadHealthRows({ totalComponents: 10, undefinedSchematic: 0, missingSchematic: 10 })[0].health).toBe(0);
    expect(buildCadHealthRows().every(row => row.health === 0)).toBe(true);
  });
});
