import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const { poolProxy } = vi.hoisted(() => ({ poolProxy: { connect: vi.fn(), query: vi.fn() } }));
vi.mock('../config/database.js', () => ({ default: poolProxy }));
vi.mock('../utils/logger.js', () => ({ logError: vi.fn(), logWarn: vi.fn(), logInfo: vi.fn() }));
import { resetDatabase, initializeDatabase } from '../controllers/adminController.js';
import { inspectDatabaseSchema } from '../services/schemaInspectionService.js';
const runTool = (tool, args) => execFileSync(tool, args, {
  env: { ...process.env, PG_RESTRICT_EXEC: '1' }, stdio: 'ignore', windowsHide: true,
});
const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    server.close(() => resolve(port));
  });
});

const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });
describe('admin recovery on scratch PostgreSQL', () => {
  let dataDirectory;
  let database;
  let postgres;
  beforeAll(async () => {
    dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'iclib-admin-recovery-'));
    const port = await freePort();
    runTool('initdb', ['-D', dataDirectory, '-U', 'postgres', '--auth=trust', '--no-locale', '--encoding=UTF8']);
    postgres = spawn('postgres', ['-D', dataDirectory, '-p', String(port)], {
      env: { ...process.env, PG_RESTRICT_EXEC: '1' }, stdio: 'ignore', windowsHide: true,
    });
    database = new Pool({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres' });
    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        await database.query('SELECT 1');
        break;
      } catch (error) {
        if (attempt === 49 || postgres.exitCode !== null) throw error;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    poolProxy.connect.mockImplementation(() => database.connect());

  }, 15000);
  afterAll(async () => {
    await database?.end();
    if (!dataDirectory) return;
    try {
      runTool('pg_ctl', ['-D', dataDirectory, '-w', 'stop', '-m', 'fast']);
    } catch {
      postgres?.kill();
    }
    // Only the directory returned by mkdtemp above belongs to this fixture.
    const resolvedDirectory = path.resolve(dataDirectory);
    if (path.dirname(resolvedDirectory) !== path.resolve(os.tmpdir())
      || !path.basename(resolvedDirectory).startsWith('iclib-admin-recovery-')) {
      throw new Error('Refusing to remove a directory outside the scratch fixture');
    }
    fs.rmSync(dataDirectory, { recursive: true, force: true });
  }, 15000);


  beforeEach(async () => {
    poolProxy.query.mockImplementation((...args) => database.query(...args));
    poolProxy.connect.mockImplementation(() => database.connect());
    await database.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE TABLE retained_data (value TEXT); INSERT INTO retained_data VALUES (\'keep me\')');
  });

  it('fully rebuilds the application schema and defaults on reset', async () => {
    const res = response();
    await resetDatabase({}, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(await inspectDatabaseSchema()).toMatchObject({ valid: true, missingTables: [], missingViews: [], missingColumns: [] });
    expect((await database.query('SELECT COUNT(*)::int AS count FROM eco_approval_stages')).rows[0].count).toBeGreaterThan(0);
  });

  it('preserves the prior schema and data when rebuilding fails late', async () => {
    poolProxy.connect.mockImplementation(async () => {
      const client = await database.connect();
      return {
        release: () => client.release(),
        query: async (sql, ...args) => {
          if (sql.includes('INSERT INTO packages')) throw new Error('injected settings failure');
          return client.query(sql, ...args);
        },
      };
    });
    const res = response();
    await resetDatabase({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect((await database.query('SELECT value FROM retained_data')).rows).toEqual([{ value: 'keep me' }]);
  });

  it('initializes a blank database with users, schema, and settings', async () => {
    await database.query('DROP TABLE retained_data');
    const res = response();
    await initializeDatabase({}, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(await inspectDatabaseSchema()).toMatchObject({ valid: true, missingTables: [], missingViews: [], missingColumns: [] });
  });
});
