import { gzipSync } from 'zlib';
import { describe, expect, it, vi } from 'vitest';
import {
  BackupValidationError,
  exportBackupSnapshot,
  parseBackupFile,
  restoreBackupSnapshot,
} from '../services/databaseBackupService.js';

const gzipBackup = (value) => gzipSync(Buffer.from(JSON.stringify(value), 'utf-8'));

const column = (column_name, {
  data_type = 'text', is_generated = 'NEVER', is_identity = 'NO',
  identity_generation = null, column_default = null, is_nullable = 'NO',
} = {}) => ({ column_name, data_type, is_generated, is_identity, identity_generation, column_default, is_nullable });

const createRestoreClient = ({ failInsert = false } = {}) => {
  const schemas = {
    package_aliases: [
      column('id', { data_type: 'integer', column_default: "nextval('package_aliases_id_seq'::regclass)" }),
      column('alias', { is_nullable: 'YES' }),
      column('alias_key', { is_generated: 'ALWAYS' }),
      column('metadata', { data_type: 'jsonb', is_nullable: 'YES' }),
    ],
    later: [column('id', { data_type: 'integer', column_default: "nextval('later_id_seq'::regclass)" })],
  };
  return {
    query: vi.fn(async (sql, params) => {
      if (sql.includes('information_schema.columns')) return { rows: schemas[params[0]] || [column('id')] };
      if (sql.startsWith('SELECT pg_get_serial_sequence')) return { rows: [{ sequence_name: 'public.test_id_seq' }] };
      if (sql.startsWith('SELECT COALESCE(MAX')) return { rows: [{ next_value: '2' }] };
      if (failInsert && sql.startsWith('INSERT INTO "later"')) throw new Error('later insert failed');
      if (sql.startsWith('INSERT')) return { rowCount: 1 };
      return { rows: [] };
    }),
    release: vi.fn(),
  };
};

describe('databaseBackupService', () => {
  it('exports every supported table from one repeatable-read transaction', async () => {
    const client = {
      query: vi.fn(async (sql) => ({ rows: sql.startsWith('SELECT') ? [{ table: sql }] : [] })),
      release: vi.fn(),
    };
    const db = { connect: vi.fn(async () => client) };

    const backup = await exportBackupSnapshot(db, ['users', 'components'], () => new Date('2026-08-10T00:00:00.000Z'));

    expect(db.connect).toHaveBeenCalledTimes(1);
    expect(client.query.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',
      'SELECT * FROM "users"',
      'SELECT * FROM "components"',
      'COMMIT',
    ]);
    expect(backup).toMatchObject({
      _exportVersion: 1,
      _exportDate: '2026-08-10T00:00:00.000Z',
      tables: { users: [{ table: 'SELECT * FROM "users"' }], components: [{ table: 'SELECT * FROM "components"' }] },
    });
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rolls back export when a table read fails', async () => {
    const client = {
      query: vi.fn(async (sql) => {
        if (sql === 'SELECT * FROM "components"') throw new Error('read failed');
        return { rows: [] };
      }),
      release: vi.fn(),
    };

    await expect(exportBackupSnapshot({ connect: vi.fn(async () => client) }, ['users', 'components']))
      .rejects.toThrow('read failed');
    expect(client.query.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',
      'SELECT * FROM "users"',
      'SELECT * FROM "components"',
      'ROLLBACK',
    ]);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rejects incomplete or malformed v1 payloads before connecting', () => {
    expect(() => parseBackupFile(gzipBackup({ _exportVersion: 1, tables: { users: [] } }), ['users', 'components']))
      .toThrow(BackupValidationError);
    expect(() => parseBackupFile(gzipBackup({ _exportVersion: 1, tables: { users: [{ id: 'u1' }], components: [null] } }), ['users', 'components']))
      .toThrow(BackupValidationError);
  });

  it('omits generated alias_key and restores JSON columns in bounded batches', async () => {
    const client = createRestoreClient();
    const rows = Array.from({ length: 4000 }, (_, id) => ({
      id: id + 1,
      alias: `alias-${id}`,
      alias_key: `generated-${id}`,
      metadata: { id },
    }));

    const stats = await restoreBackupSnapshot({ connect: vi.fn(async () => client) }, {
      tables: { package_aliases: rows },
    }, ['package_aliases']);

    const inserts = client.query.mock.calls.filter(([sql]) => sql.startsWith('INSERT INTO'));
    expect(inserts).toHaveLength(2);
    expect(inserts.every(([sql]) => !sql.includes('"alias_key"'))).toBe(true);
    expect(inserts.flatMap(([, values]) => values)).toContain(JSON.stringify({ id: 0 }));
    expect(inserts.every(([, values]) => values.length <= 10000)).toBe(true);
    expect(stats.tablesImported).toBe(1);
  });

  it('keeps FK triggers active while suppressing component user triggers', async () => {
    const client = createRestoreClient();

    await restoreBackupSnapshot({ connect: vi.fn(async () => client) }, {
      tables: { components: [{ id: 'component-1' }] },
    }, ['components']);

    const sql = client.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('ALTER TABLE "components" DISABLE TRIGGER USER');
    expect(sql).toContain('ALTER TABLE "components" ENABLE TRIGGER USER');
    expect(sql).not.toContain('session_replication_role');
  });

  it('rolls back tables and owned sequences when a later insert fails', async () => {
    const client = createRestoreClient({ failInsert: true });

    await expect(restoreBackupSnapshot({ connect: vi.fn(async () => client) }, {
      tables: { package_aliases: [{ id: 1, alias: 'first' }], later: [{ id: 2 }] },
    }, ['package_aliases', 'later'])).rejects.toThrow('later insert failed');

    const sql = client.query.mock.calls.map(([statement]) => statement);
    expect(sql).toContain('DELETE FROM "later"');
    expect(sql).toContain('DELETE FROM "package_aliases"');
    expect(sql.at(-1)).toBe('ROLLBACK');
  });
});
