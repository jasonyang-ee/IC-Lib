import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const faults = vi.hoisted(() => ({ settings: false }));
vi.mock('fs', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, readFileSync: (...args) => {
    if (faults.settings && String(args[0]).endsWith('init-settings.sql')) return 'SELECT missing_reset_fixture_function()';
    return actual.readFileSync(...args);
  } };
});
import { resetDatabase, initializeDatabase, deletePartsAndProjectData } from '../services/databaseService.js';

const runTool = (tool, args) => execFileSync(tool, args, {
  env: { ...process.env, PG_RESTRICT_EXEC: '1' }, stdio: 'ignore', windowsHide: true,
});
const freePort = () => new Promise((resolve, reject) => {
  const listener = net.createServer();
  listener.once('error', reject);
  listener.listen(0, '127.0.0.1', () => {
    const { port } = listener.address();
    listener.close(() => resolve(port));
  });
});
describe('Database maintenance on scratch PostgreSQL', () => {
  let directory;
  let database;
  let postgres;
  beforeAll(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'iclib-maintenance-review-'));
    const port = await freePort();
    runTool('initdb', ['-D', directory, '-U', 'postgres', '--auth=trust', '--no-locale', '--encoding=UTF8']);
    postgres = spawn('postgres', ['-D', directory, '-p', String(port)], {
      env: { ...process.env, PG_RESTRICT_EXEC: '1' }, stdio: 'ignore', windowsHide: true,
    });
    database = new Pool({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres' });
    for (let attempt = 0; attempt < 50; attempt++) {
      try { await database.query('SELECT 1'); break; } catch (error) {
        if (attempt === 49 || postgres.exitCode !== null) throw error;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    for (const [name, value] of Object.entries({ DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_USER: 'postgres', DB_PASSWORD: '', DB_NAME: 'postgres' })) vi.stubEnv(name, value);
  }, 15000);
  afterAll(async () => {
    vi.unstubAllEnvs();
    await database?.end();
    if (!directory) return;
    try { runTool('pg_ctl', ['-D', directory, '-w', 'stop', '-m', 'fast']); } catch { postgres?.kill(); }
    const resolved = path.resolve(directory);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('iclib-maintenance-review-')) throw new Error('Unsafe scratch cleanup path');
    fs.rmSync(resolved, { recursive: true, force: true });
  }, 15000);
  beforeEach(async () => {
    faults.settings = false;
    await database.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  });
  it('restores the original schema and rows when a late reset step fails', async () => {
    await database.query('CREATE TABLE sentinel (value TEXT); INSERT INTO sentinel VALUES (\'keep\')');
    faults.settings = true;
    const result = await resetDatabase();
    expect(result.success).toBe(false);
    expect((await database.query("SELECT to_regclass('public.sentinel') AS name")).rows[0].name).toBe('sentinel');
    expect((await database.query('SELECT * FROM sentinel')).rows).toEqual([{ value: 'keep' }]);
  });
  it('leaves initialization retryable after a late default-data failure', async () => {
    faults.settings = true;
    expect((await initializeDatabase()).success).toBe(false);
    expect((await database.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows).toEqual([]);
    faults.settings = false;
    expect((await initializeDatabase()).success).toBe(true);
    expect((await database.query('SELECT username FROM users ORDER BY username')).rows).toEqual([{ username: 'admin' }, { username: 'guest' }]);
  });
  it('rebuilds the fresh schema including SMTP configuration successfully', async () => {
    expect((await resetDatabase()).success).toBe(true);
    expect((await database.query("SELECT to_regclass('public.smtp_settings') AS name")).rows[0].name).toBe('smtp_settings');
    expect((await database.query('SELECT username FROM users ORDER BY username')).rows).toEqual([{ username: 'admin' }, { username: 'guest' }]);
  });
  it('rolls back an earlier parts clear when resetting the ECO counter fails', async () => {
    await database.query('CREATE TABLE components (id INTEGER); INSERT INTO components VALUES (1)');
    const result = await deletePartsAndProjectData();
    expect(result.success).toBe(false);
    expect((await database.query('SELECT * FROM components')).rows).toEqual([{ id: 1 }]);
  });
});
