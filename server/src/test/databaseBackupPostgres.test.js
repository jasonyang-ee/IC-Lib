import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { restoreBackupSnapshot } from '../services/databaseBackupService.js';

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
});
