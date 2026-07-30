import { describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

vi.mock('../config/database.js', () => ({
  default: { query: vi.fn() },
}));

const {
  EXPECTED_SCHEMA_VIEWS,
  REPAIRABLE_SCHEMA_COLUMNS,
} = await import('../services/schemaInspectionService.js');

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('schema inspection expectations', () => {
  it('EXPECTED_SCHEMA_VIEWS matches every view init-schema.sql creates', () => {
    const initSchema = fs.readFileSync(path.join(repoRoot, 'database', 'init-schema.sql'), 'utf8');
    const viewNames = [...initSchema.matchAll(/CREATE (?:OR REPLACE )?VIEW\s+(\w+)/gi)]
      .map((match) => match[1]);

    expect([...viewNames].sort()).toEqual([...EXPECTED_SCHEMA_VIEWS].sort());
  });

  it('requires OIDC continuity columns on users', () => {
    expect(REPAIRABLE_SCHEMA_COLUMNS).toEqual(expect.arrayContaining([
      { table: 'users', column: 'oidc_tenant_id' },
      { table: 'users', column: 'oidc_object_id' },
    ]));
  });
});
