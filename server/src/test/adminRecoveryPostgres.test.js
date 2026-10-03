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
import { importAllSettings, importCategories, importUsers, updateCategoryConfig, updateGlobalPrefix } from '../controllers/settingsController.js';
import { importCSVFile } from '../../../scripts/import.js';
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

  const prepareImports = async () => {
    await database.query(`
      CREATE TABLE users (id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, username TEXT UNIQUE,
        role TEXT, password_hash TEXT, is_active BOOLEAN DEFAULT true, created_by INTEGER);
      CREATE TABLE component_categories (id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name TEXT UNIQUE,
        prefix TEXT UNIQUE, leading_zeros INTEGER, display_order INTEGER);
      CREATE TABLE category_specifications (id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        category_id INTEGER REFERENCES component_categories(id), spec_name TEXT, unit TEXT,
        mapping_spec_names JSONB, display_order INTEGER, is_required BOOLEAN, updated_at TIMESTAMP);
      CREATE TABLE user_activity_log (type_name TEXT, description TEXT, user_id INTEGER);
      INSERT INTO users (username, role) VALUES ('admin', 'admin'), ('old', 'read-only');
      INSERT INTO component_categories (name, prefix) VALUES ('Original', 'O');
    `);
  };

  it.each([['all', importAllSettings], ['categories', importCategories]])('rolls back a failed %s category import instead of reporting rolled-back writes', async (kind, handler) => {
    await prepareImports();
    const categories = [{ name: 'New', prefix: 'N' }, { name: 'Collision', prefix: 'O' }];
    const res = response();
    await handler({ body: kind === 'all' ? { data: { categories } } : { categories }, user: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect((await database.query('SELECT name FROM component_categories')).rows).toEqual([{ name: 'Original' }]);
  });

  it('rolls back imported users on a later database failure', async () => {
    await prepareImports();
    await database.query(`CREATE FUNCTION fail_user() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.username = 'bad' THEN RAISE EXCEPTION 'write failed'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER fail_user BEFORE INSERT ON users FOR EACH ROW EXECUTE FUNCTION fail_user();`);
    const res = response();
    await importUsers({ body: { users: [{ username: 'old', role: 'approver' }, { username: 'bad', role: 'read-only' }] }, user: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect((await database.query("SELECT role, is_active FROM users WHERE username = 'old'")).rows[0]).toEqual({ role: 'read-only', is_active: true });
  });

  it('rejects malformed replacement specs before deleting existing definitions', async () => {
    await prepareImports();
    await database.query("INSERT INTO category_specifications (category_id, spec_name) VALUES (1, 'Keep')");
    const res = response();
    await importCategories({ body: { categories: [{ name: 'Original', prefix: 'O', specifications: [{}] }] } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect((await database.query('SELECT spec_name FROM category_specifications')).rows).toEqual([{ spec_name: 'Keep' }]);
  });

  it('renumbers literal punctuation prefixes and attributes the audit to the signed-in actor', async () => {
    await prepareImports();
    await database.query(`UPDATE component_categories SET prefix = 'R+' WHERE id = 1;
      CREATE TABLE components (id INTEGER PRIMARY KEY, category_id INTEGER, part_number TEXT, updated_at TIMESTAMP);
      INSERT INTO components VALUES (1, 1, 'R+-00001', NULL);`);
    const res = response();
    await updateCategoryConfig({ params: { id: 1 }, body: { prefix: 'R' }, user: { id: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, updated_part_count: 1 }));
    expect((await database.query('SELECT part_number FROM components')).rows[0].part_number).toBe('R-00001');
    expect((await database.query('SELECT user_id FROM user_activity_log')).rows[0].user_id).toBe(1);
  });

  it('keeps a populated legacy CSV dry run read-only, including new manufacturers', async () => {
    await prepareImports();
    await database.query("INSERT INTO component_categories (name, prefix, leading_zeros) VALUES ('Diode', 'D', 5); CREATE TABLE manufacturers (id INTEGER GENERATED ALWAYS AS IDENTITY, name TEXT)");
    const csv = path.join(dataDirectory, 'Diode.csv');
    fs.writeFileSync(csv, 'PART_NUMBER,Manufacturer,Manufacturer PN\nD-1,New Manufacturer,Part-1\n');
    await importCSVFile(csv, { db: database, dryRun: true });
    expect((await database.query('SELECT * FROM manufacturers')).rows).toEqual([]);
  });

  it('rolls back global prefix settings if applying them to categories fails', async () => {
    await prepareImports();
    const schema = fs.readFileSync(new URL('../../../database/init-schema.sql', import.meta.url), 'utf8');
    await database.query(schema.match(/CREATE TABLE IF NOT EXISTS admin_settings \([\s\S]*?\n\);/)[0]);
    await database.query(`CREATE UNIQUE INDEX idx_admin_settings_singleton ON admin_settings((1));
      INSERT INTO admin_settings (global_prefix) VALUES ('OLD');
      CREATE FUNCTION fail_prefix() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'prefix failure'; END $$;
      CREATE TRIGGER fail_prefix BEFORE UPDATE ON component_categories FOR EACH ROW EXECUTE FUNCTION fail_prefix();`);
    const res = response();
    await updateGlobalPrefix({ body: { enabled: true, prefix: 'NEW', leading_zeros: 5 } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect((await database.query('SELECT global_prefix_enabled, global_prefix FROM admin_settings')).rows)
      .toEqual([{ global_prefix_enabled: false, global_prefix: 'OLD' }]);
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
