import { gzipSync } from 'zlib';
import { describe, expect, it, vi } from 'vitest';
import {
  BackupValidationError,
  exportBackupSnapshot,
  parseBackupFile,
} from '../services/databaseBackupService.js';

const gzipBackup = (value) => gzipSync(Buffer.from(JSON.stringify(value), 'utf-8'));

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
});
