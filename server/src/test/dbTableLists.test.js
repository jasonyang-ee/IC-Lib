import { describe, expect, it, vi } from 'vitest';

vi.stubEnv('JWT_SECRET', 'test-secret-key-minimum-32-chars-long');

const { EXPECTED_SCHEMA_TABLES } = await import('../services/schemaInspectionService.js');
const { EXPORT_TABLES } = await import('../controllers/settingsController.js');
const { CLEAR_PARTS_TABLES, CLEAR_PARTS_PROJECT_TABLES } = await import('../services/databaseService.js');
const { VERIFY_CORE_TABLES } = await import('../controllers/adminController.js');

// Deliberately not exported by backup: migration state plus config/staging
// tables that a restore must not clobber. Changing backup scope means editing
// EXPORT_TABLES and this list together — the drift test below makes an
// accidental schema addition that silently skips backup impossible.
const EXPORT_EXCLUSIONS = [
  'admin_settings',
  'eco_cad_files',
  'eco_file_rename_files',
  'eco_file_rename_components',
  'schema_migrations',
];

const unknownToSchema = (list) => list.filter((table) => !EXPECTED_SCHEMA_TABLES.includes(table));

describe('db table lists stay consistent with the expected schema (D11)', () => {
  it('backup EXPORT_TABLES covers the schema minus documented exclusions, two-way', () => {
    expect(unknownToSchema(EXPORT_TABLES)).toEqual([]);

    const missing = EXPECTED_SCHEMA_TABLES
      .filter((table) => !EXPORT_TABLES.includes(table))
      .sort();
    expect(missing).toEqual([...EXPORT_EXCLUSIONS].sort());

    // an exclusion that later joins the export list is stale documentation
    const staleExclusions = EXPORT_EXCLUSIONS.filter((table) => EXPORT_TABLES.includes(table));
    expect(staleExclusions).toEqual([]);
  });

  it('clear-order lists only name real schema tables', () => {
    expect(unknownToSchema(CLEAR_PARTS_TABLES)).toEqual([]);
    expect(unknownToSchema(CLEAR_PARTS_PROJECT_TABLES)).toEqual([]);
  });

  it('admin quick-verify list only names real schema tables', () => {
    expect(unknownToSchema(VERIFY_CORE_TABLES)).toEqual([]);
  });

  it('no list contains duplicates', () => {
    for (const list of [EXPECTED_SCHEMA_TABLES, EXPORT_TABLES, CLEAR_PARTS_TABLES, CLEAR_PARTS_PROJECT_TABLES, VERIFY_CORE_TABLES]) {
      expect(new Set(list).size).toBe(list.length);
    }
  });
});
