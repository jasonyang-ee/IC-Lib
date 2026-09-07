import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { exportBackupSnapshot, restoreBackupSnapshot } from '../services/databaseBackupService.js';

const runTool = (tool, args) => execFileSync(tool, args, {
  env: { ...process.env, PG_RESTRICT_EXEC: '1' },
  stdio: 'ignore',
});

const findFreePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    server.close(() => resolve(port));
  });
});

describe('database backup PostgreSQL restore', () => {
  let dataDirectory;
  let database;
  let postgres;

  beforeAll(async () => {
    dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'iclib-backup-'));
    const port = await findFreePort();
    runTool('initdb', ['-D', dataDirectory, '-U', 'postgres', '--auth=trust', '--no-locale', '--encoding=UTF8']);
    postgres = spawn('postgres', ['-D', dataDirectory, '-p', String(port)], {
      env: { ...process.env, PG_RESTRICT_EXEC: '1' },
      stdio: 'ignore',
      windowsHide: true,
    });
    database = new Pool({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres' });

    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        await database.query('SELECT 1');
        break;
      } catch (error) {
        if (attempt === 49 || postgres.exitCode !== null) throw error;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    const version = await database.query('SHOW server_version_num');
    if (Math.floor(Number(version.rows[0].server_version_num) / 10000) !== 18) {
      throw new Error('PostgreSQL 18 required for database backup regression');
    }
    await database.query(`
      CREATE TABLE components (id INTEGER PRIMARY KEY);
      CREATE TABLE parent_records (id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE child_records (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        parent_id INTEGER NOT NULL REFERENCES parent_records(id),
        payload JSONB NOT NULL,
        alias_key TEXT GENERATED ALWAYS AS (lower(payload ->> 'alias')) STORED
      );
    `);
  }, 15000);

  afterAll(async () => {
    await database?.end();
    try {
      runTool('pg_ctl', ['-D', dataDirectory, '-w', 'stop', '-m', 'fast']);
    } catch {
      postgres?.kill();
    }
    fs.rmSync(dataDirectory, { recursive: true, force: true });
  }, 15000);

  it('round-trips generated columns, FK constraints, and owned sequences on PostgreSQL 18', async () => {
    const tables = ['components', 'parent_records', 'child_records'];
    const backup = {
      tables: {
        components: [],
        parent_records: [{ id: 7, name: 'parent' }],
        child_records: [{ id: 11, parent_id: 7, payload: { alias: 'MixedCase' }, alias_key: 'ignored' }],
      },
    };

    await restoreBackupSnapshot(database, backup, tables);
    await expect(database.query('SELECT id, parent_id, payload, alias_key FROM child_records'))
      .resolves.toMatchObject({ rows: [{ id: 11, parent_id: 7, payload: { alias: 'MixedCase' }, alias_key: 'mixedcase' }] });
    await expect(database.query("INSERT INTO parent_records (name) VALUES ('next') RETURNING id"))
      .resolves.toMatchObject({ rows: [{ id: 8 }] });

    await expect(restoreBackupSnapshot(database, {
      tables: {
        components: [],
        parent_records: [{ id: 7, name: 'parent' }],
        child_records: [{ id: 11, parent_id: 99, payload: { alias: 'invalid' } }],
      },
    }, tables)).rejects.toThrow();
    await expect(database.query('SELECT id FROM parent_records ORDER BY id'))
      .resolves.toMatchObject({ rows: [{ id: 7 }, { id: 8 }] });
    await expect(database.query("INSERT INTO parent_records (name) VALUES ('after-rollback') RETURNING id"))
      .resolves.toMatchObject({ rows: [{ id: 9 }] });
  });

  describe('retained staging and self references', () => {
    const tables = ['users', 'components', 'cad_files', 'eco_orders', 'sequence_probe'];
    const staging = ['eco_cad_files', 'eco_file_rename_files', 'eco_file_rename_components'];
    let backup;
    let retained;
    const snapshot = async () => (await exportBackupSnapshot(database, [...tables, ...staging, 'admin_settings', 'schema_migrations'])).tables;
    const tableDefinition = (source, table) => source.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\n\\);`))[0];

    beforeEach(async () => {
      const schemaSql = fs.readFileSync(new URL('../../../database/init-schema.sql', import.meta.url), 'utf8');
      const usersSql = fs.readFileSync(new URL('../../../database/init-users.sql', import.meta.url), 'utf8');
      await database.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;
        CREATE TABLE components (id UUID PRIMARY KEY DEFAULT uuidv7(), part_number TEXT);
        CREATE TABLE cad_files (id UUID PRIMARY KEY DEFAULT uuidv7(), file_type TEXT, file_name TEXT);
        ${tableDefinition(usersSql, 'users')}
        ${tableDefinition(schemaSql, 'eco_orders')}
        ${staging.map((table) => tableDefinition(schemaSql, table)).join('\n')}
        CREATE TABLE sequence_probe (id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, value INTEGER CHECK (value > 0));
        CREATE TABLE admin_settings (value TEXT); INSERT INTO admin_settings VALUES ('keep config');
        CREATE TABLE schema_migrations (value TEXT); INSERT INTO schema_migrations VALUES ('keep migration');
        INSERT INTO users (username, role) SELECT 'user-' || n, 'admin' FROM generate_series(1, 700) n;
        UPDATE users SET delegation = (SELECT id FROM users WHERE username = 'user-700'),
          created_by = (SELECT id FROM users WHERE username = 'user-699') WHERE username = 'user-1';
        UPDATE users SET delegation = (SELECT id FROM users WHERE username = 'user-1') WHERE username = 'user-700';
        INSERT INTO components (part_number) VALUES ('PART-1'), ('PART-2');
        INSERT INTO cad_files (file_type, file_name) VALUES ('model', 'old.step');
        INSERT INTO eco_orders (eco_number, component_id, part_number, initiated_by)
          SELECT 'ECO-' || n, (SELECT id FROM components WHERE part_number = 'PART-1'), 'PART-1',
            (SELECT id FROM users WHERE username = 'user-1') FROM generate_series(1, 700) n;
        UPDATE eco_orders SET parent_eco_id = (SELECT id FROM eco_orders WHERE eco_number = 'ECO-700') WHERE eco_number = 'ECO-1';
        UPDATE eco_orders SET pipeline_type = 'shared_file_rename', pipeline_types = '{shared_file_rename}' WHERE eco_number = 'ECO-2';
        INSERT INTO eco_cad_files (eco_id, action, cad_file_id, file_type, file_name)
          SELECT e.id, 'link', c.id, c.file_type, c.file_name FROM eco_orders e CROSS JOIN cad_files c WHERE e.eco_number = 'ECO-1';
        INSERT INTO eco_file_rename_files (eco_id, cad_file_id, file_type, old_file_name, new_file_name)
          SELECT e.id, c.id, c.file_type, c.file_name, 'new.step' FROM eco_orders e CROSS JOIN cad_files c WHERE e.eco_number = 'ECO-2';
        INSERT INTO eco_file_rename_components (eco_id, component_id, part_number, original_approval_status)
          SELECT e.id, c.id, c.part_number, 'production' FROM eco_orders e CROSS JOIN components c WHERE e.eco_number = 'ECO-2';
        INSERT INTO sequence_probe (value) VALUES (1);
      `);
      backup = await exportBackupSnapshot(database, tables);
      // Force forward references across the real parameter boundary regardless of heap order.
      backup.tables.users.sort((a, b) => Number(a.username.slice(5)) - Number(b.username.slice(5)));
      backup.tables.eco_orders.sort((a, b) => Number(a.eco_number.slice(4)) - Number(b.eco_number.slice(4)));
      retained = await snapshot();
    });

    const expectUnchanged = async () => {
      const current = await snapshot();
      for (const table of Object.keys(retained)) {
        expect(current[table]).toEqual(expect.arrayContaining(retained[table]));
        expect(current[table]).toHaveLength(retained[table].length);
      }
      await expect(database.query('INSERT INTO sequence_probe (value) VALUES (2) RETURNING id'))
        .resolves.toMatchObject({ rows: [{ id: 2 }] });
    };

    it('preserves all excluded payloads and complete cross-batch user/ECO references', async () => {
      expect(backup.tables.users.length * Object.keys(backup.tables.users[0]).length).toBeGreaterThan(10000);
      expect(backup.tables.eco_orders.length * Object.keys(backup.tables.eco_orders[0]).length).toBeGreaterThan(10000);
      await restoreBackupSnapshot(database, backup, tables);
      await expectUnchanged();
      await expect(database.query("UPDATE users SET delegation = uuidv7() WHERE username = 'user-1'"))
        .rejects.toMatchObject({ code: '23503' });
    });

    it.each(['missing ECO', 'changed ECO owner', 'missing CAD', 'changed CAD identity', 'missing component', 'late failure', 'dangling user', 'dangling ECO'])(
      'rolls back all rows and sequences on %s', async (failure) => {
        const eco = backup.tables.eco_orders.find((row) => row.eco_number === 'ECO-1');
        if (failure === 'missing ECO') backup.tables.eco_orders = backup.tables.eco_orders.filter((row) => row !== eco);
        if (failure === 'changed ECO owner') eco.component_id = backup.tables.components.find((row) => row.part_number === 'PART-2').id;
        if (failure === 'missing CAD') backup.tables.cad_files = [];
        if (failure === 'changed CAD identity') backup.tables.cad_files[0].file_name = 'different.step';
        if (failure === 'missing component') backup.tables.components = backup.tables.components.filter((row) => row.part_number !== 'PART-2');
        if (failure === 'late failure') backup.tables.sequence_probe[0].value = -1;
        if (failure === 'dangling user') backup.tables.users[0].delegation = '00000000-0000-0000-0000-000000000001';
        if (failure === 'dangling ECO') eco.parent_eco_id = '00000000-0000-0000-0000-000000000001';
        await expect(restoreBackupSnapshot(database, backup, tables)).rejects.toThrow();
        await expectUnchanged();
      },
    );

    it('serializes a concurrent staging insert until restoration commits', async () => {
      const writer = await database.connect();
      const { rows: [{ pid }] } = await writer.query('SELECT pg_backend_pid() AS pid');
      let write;
      let observedLock = false;
      const wrapped = {
        connect: async () => {
          const client = await database.connect();
          return {
            release: () => client.release(),
            query: async (sql, params) => {
              const result = await client.query(sql, params);
              if (sql.startsWith('CREATE TEMP TABLE "backup_eco_cad_files"')) {
                write = writer.query(`INSERT INTO eco_cad_files (eco_id, action, file_type, file_name)
                  VALUES ($1, 'link', 'pad', 'concurrent.pad')`, [backup.tables.eco_orders[0].id]);
                for (let attempt = 0; attempt < 100; attempt++) {
                  const state = await database.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1', [pid]);
                  if (state.rows[0].wait_event_type === 'Lock') { observedLock = true; break; }
                }
              }
              return result;
            },
          };
        },
      };
      try {
        await restoreBackupSnapshot(wrapped, backup, tables);
        await write;
        expect(observedLock).toBe(true);
        expect((await database.query('SELECT * FROM eco_cad_files')).rows).toHaveLength(2);
      } finally {
        writer.release();
      }
    });
  });
});
