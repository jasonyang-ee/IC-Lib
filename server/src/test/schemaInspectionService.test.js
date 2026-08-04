import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

vi.mock('../config/database.js', () => ({
  default: { query: vi.fn() },
}));

const pool = (await import('../config/database.js')).default;

const {
  EXPECTED_SCHEMA_VIEWS,
  REPAIRABLE_SCHEMA_COLUMNS,
  REQUIRED_VIEW_COLUMNS,
  STARTUP_REQUIRED_TABLES,
  inspectDatabaseSchema,
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

  it('requires alt_class on both base tables', () => {
    expect(REPAIRABLE_SCHEMA_COLUMNS).toEqual(expect.arrayContaining([
      { table: 'components', column: 'alt_class' },
      { table: 'project_components', column: 'alt_class' },
    ]));
  });

  it('requires both package catalog tables at startup', () => {
    expect(STARTUP_REQUIRED_TABLES).toEqual(expect.arrayContaining([
      'packages',
      'package_aliases',
    ]));
  });

  it('requires alt_class on exactly the six component-facing views, not eco_orders_full', () => {
    expect([...REQUIRED_VIEW_COLUMNS].map(({ table }) => table).sort()).toEqual([
      'alternative_parts',
      'archived_parts',
      'component_specifications_view',
      'components_full',
      'production_parts',
      'prototype_parts',
    ]);
    expect(REQUIRED_VIEW_COLUMNS.every(({ column }) => column === 'alt_class')).toBe(true);
    expect(REQUIRED_VIEW_COLUMNS.map(({ table }) => table)).not.toContain('eco_orders_full');
  });

  it('migration 18 appends alt_class to every view REQUIRED_VIEW_COLUMNS expects', () => {
    const migration = fs.readFileSync(
      path.join(repoRoot, 'database', 'migrations', '18_alternative_class.sql'),
      'utf8',
    );

    for (const { table } of REQUIRED_VIEW_COLUMNS) {
      expect(migration).toContain(table);
    }
    // components_full is rebuilt dynamically from the live column list, so the
    // migration must read the stored ordinals rather than hard-code them.
    expect(migration).toContain('ordinal_position');
    expect(migration).not.toContain('eco_orders_full AS');
  });
});

describe('inspectDatabaseSchema alternative-class coverage', () => {
  const allViews = EXPECTED_SCHEMA_VIEWS;
  const allRequiredColumns = [...REPAIRABLE_SCHEMA_COLUMNS, ...REQUIRED_VIEW_COLUMNS];

  // Drive the three parallel queries off their SQL text rather than call order.
  function primePool({ omitColumns = [], omitTables = [] } = {}) {
    const omitted = new Set(omitColumns.map(({ table, column }) => `${table}.${column}`));
    const omittedTables = new Set(omitTables);

    pool.query.mockImplementation((sql) => {
      if (sql.includes('pg_tables')) {
        return Promise.resolve({
          rows: STARTUP_REQUIRED_TABLES
            .filter(name => !omittedTables.has(name))
            .map(name => ({ name })),
        });
      }
      if (sql.includes('pg_views')) {
        return Promise.resolve({ rows: allViews.map(name => ({ name })) });
      }
      return Promise.resolve({
        rows: allRequiredColumns
          .filter(({ table, column }) => !omitted.has(`${table}.${column}`))
          .map(({ table, column }) => ({ table_name: table, column_name: column })),
      });
    });
  }

  beforeEach(() => {
    pool.query.mockReset();
  });

  it('is valid when every table and view class column exists', async () => {
    primePool();

    const result = await inspectDatabaseSchema();

    expect(result.valid).toBe(true);
    expect(result.missingColumns).toEqual([]);
  });

  it('is invalid when components.alt_class is missing', async () => {
    primePool({ omitColumns: [{ table: 'components', column: 'alt_class' }] });

    const result = await inspectDatabaseSchema();

    expect(result.valid).toBe(false);
    expect(result.missingColumns).toEqual([{ table: 'components', column: 'alt_class' }]);
  });

  it('is invalid when project_components.alt_class is missing', async () => {
    primePool({ omitColumns: [{ table: 'project_components', column: 'alt_class' }] });

    const result = await inspectDatabaseSchema();

    expect(result.valid).toBe(false);
    expect(result.missingColumns).toEqual([{ table: 'project_components', column: 'alt_class' }]);
  });

  it.each(['packages', 'package_aliases'])(
    'is invalid when required table %s is missing',
    async (table) => {
      primePool({ omitTables: [table] });

      const result = await inspectDatabaseSchema();

      expect(result.valid).toBe(false);
      expect(result.missingTables).toEqual([table]);
    },
  );

  it.each(REQUIRED_VIEW_COLUMNS)(
    'is invalid when $table is missing alt_class even though the view exists',
    async ({ table, column }) => {
      primePool({ omitColumns: [{ table, column }] });

      const result = await inspectDatabaseSchema();

      expect(result.valid).toBe(false);
      expect(result.missingViews).toEqual([]);
      expect(result.missingColumns).toEqual([{ table, column }]);
    },
  );

  it('does not require alt_class on eco_orders_full', async () => {
    primePool({ omitColumns: [{ table: 'eco_orders_full', column: 'alt_class' }] });

    const result = await inspectDatabaseSchema();

    expect(result.valid).toBe(true);
  });
});
