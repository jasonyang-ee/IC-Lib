import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  bcrypt: {
    hash: vi.fn(),
  },
  compareMigrationFilenames: vi.fn((left, right) => left.localeCompare(right)),
  fs: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
  },
  inspectDatabaseSchema: vi.fn(),
  parseMigrationFilename: vi.fn(filename => ({
    sequenceNumber: Number(filename.split('_', 1)[0]),
    description: filename.replace(/^[0-9]+_|\.sql$/g, '').replace(/_/g, ' '),
  })),
  pool: {
    connect: vi.fn(),
    query: vi.fn(),
  },
}));

vi.mock('bcryptjs', () => ({
  default: mocks.bcrypt,
}));

vi.mock('fs', () => ({
  default: mocks.fs,
}));

vi.mock('../config/database.js', () => ({
  default: mocks.pool,
}));

vi.mock('../services/migrationNaming.js', () => ({
  compareMigrationFilenames: mocks.compareMigrationFilenames,
  parseMigrationFilename: mocks.parseMigrationFilename,
}));

vi.mock('../services/schemaInspectionService.js', () => ({
  EXPECTED_SCHEMA_VIEWS: ['alternative_parts'],
  REPAIRABLE_SCHEMA_COLUMNS: [{ table: 'users', column: 'file_storage_path' }],
  STARTUP_REQUIRED_TABLES: ['users', 'components'],
  inspectDatabaseSchema: mocks.inspectDatabaseSchema,
}));

import { initializeAuthentication } from '../services/initializationService.js';

function createClient(executedSql) {
  return {
    query: vi.fn(async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return { rows: [] };
      }

      if (sql === 'SELECT filename FROM schema_migrations') {
        return { rows: [] };
      }

      if (typeof sql === 'string' && sql.includes('INSERT INTO schema_migrations (filename, sequence_number, description)')) {
        return { rows: [] };
      }

      if (
        typeof sql === 'string'
        && (
          sql.includes('CREATE TABLE IF NOT EXISTS schema_migrations')
          || sql.startsWith('ALTER TABLE schema_migrations')
          || sql.includes('DELETE FROM schema_migrations versioned')
          || sql.includes('UPDATE schema_migrations')
          || sql.includes('WITH parsed_migrations AS')
        )
      ) {
        return { rows: [] };
      }

      if (sql === 'INIT_USERS_SQL' || sql === 'INIT_SCHEMA_SQL' || sql === 'INIT_SETTINGS_SQL' || sql === 'MIGRATION_ONE_SQL') {
        executedSql.push(sql);
        return { rows: [] };
      }

      throw new Error(`Unexpected client query: ${sql}`);
    }),
    release: vi.fn(),
  };
}

describe('initializeAuthentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.bcrypt.hash.mockResolvedValue('hashed-password');
    mocks.inspectDatabaseSchema.mockResolvedValue({
      valid: true,
      missingColumns: [],
      missingTables: [],
      missingViews: [],
    });
    mocks.fs.existsSync.mockReturnValue(true);
  });

  it('bootstraps blank databases with init-schema before legacy repair migrations', async () => {
    const executedSql = [];
    const client = createClient(executedSql);

    mocks.pool.connect.mockImplementation(async () => client);
    mocks.pool.query.mockImplementation(async (sql) => {
      if (sql.includes("AND table_name = 'users'")) {
        return { rows: [{ exists: false }] };
      }

      if (sql.includes("AND table_name = 'activity_types'")) {
        return { rows: [{ exists: false }] };
      }

      if (sql.includes('AND table_name = ANY($1::text[])')) {
        return { rows: [] };
      }

      if (sql.includes("AND table_name = 'schema_migrations'")) {
        return { rows: [{ count: '0' }] };
      }

      throw new Error(`Unexpected pool query: ${sql}`);
    });

    mocks.fs.readdirSync.mockReturnValue(['1_legacy_schema_repairs.sql']);
    mocks.fs.readFileSync.mockImplementation((filePath) => {
      if (filePath.endsWith('init-users.sql')) {
        return 'INIT_USERS_SQL';
      }

      if (filePath.endsWith('init-schema.sql')) {
        return 'INIT_SCHEMA_SQL';
      }

      if (filePath.endsWith('init-settings.sql')) {
        return 'INIT_SETTINGS_SQL';
      }

      if (filePath.endsWith('1_legacy_schema_repairs.sql')) {
        return 'MIGRATION_ONE_SQL';
      }

      throw new Error(`Unexpected readFileSync path: ${filePath}`);
    });

    await expect(initializeAuthentication()).resolves.toBe(true);
    expect(executedSql).toContain('INIT_USERS_SQL');
    expect(executedSql).toContain('INIT_SCHEMA_SQL');
    expect(executedSql).toContain('MIGRATION_ONE_SQL');
    expect(executedSql).toContain('INIT_SETTINGS_SQL');
    expect(executedSql.indexOf('INIT_SCHEMA_SQL')).toBeLessThan(executedSql.indexOf('MIGRATION_ONE_SQL'));
    expect(mocks.inspectDatabaseSchema).toHaveBeenCalledTimes(1);
  });

  it('reseeds default settings on existing databases without rerunning init-schema', async () => {
    const executedSql = [];
    const client = createClient(executedSql);

    mocks.pool.connect.mockImplementation(async () => client);
    mocks.pool.query.mockImplementation(async (sql) => {
      if (sql.includes("AND table_name = 'users'")) {
        return { rows: [{ exists: true }] };
      }

      if (sql.includes("WHERE table_name = 'users'")) {
        return {
          rows: [
            { column_name: 'id' },
            { column_name: 'username' },
            { column_name: 'password_hash' },
            { column_name: 'role' },
            { column_name: 'created_by' },
            { column_name: 'last_login' },
            { column_name: 'is_active' },
          ],
        };
      }

      if (sql.includes("SELECT 1 FROM users WHERE username = 'admin'")) {
        return { rows: [{ exists: true }] };
      }

      if (sql.includes("AND table_name = 'activity_types'")) {
        return { rows: [{ exists: true }] };
      }

      if (sql.includes('INSERT INTO activity_types')) {
        return { rows: [] };
      }

      if (sql.includes('AND table_name = ANY($1::text[])')) {
        return { rows: [{ table_name: 'components' }] };
      }

      throw new Error(`Unexpected pool query: ${sql}`);
    });

    mocks.fs.readdirSync.mockReturnValue([]);
    mocks.fs.readFileSync.mockImplementation((filePath) => {
      if (filePath.endsWith('init-settings.sql')) {
        return 'INIT_SETTINGS_SQL';
      }

      if (filePath.endsWith('init-schema.sql')) {
        throw new Error('init-schema should not run for existing databases');
      }

      throw new Error(`Unexpected readFileSync path: ${filePath}`);
    });

    await expect(initializeAuthentication()).resolves.toBe(true);
    expect(executedSql).toEqual(['INIT_SETTINGS_SQL']);
    expect(mocks.inspectDatabaseSchema).toHaveBeenCalledTimes(1);
  });
});
