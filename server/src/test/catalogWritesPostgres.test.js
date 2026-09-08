import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { poolProxy, vendorSearch } = vi.hoisted(() => ({
  poolProxy: { query: vi.fn(), connect: vi.fn() }, vendorSearch: vi.fn(),
}));
vi.mock('../config/database.js', () => ({ default: poolProxy }));
vi.mock('../services/digikeyService.js', () => ({ searchPart: vendorSearch }));
vi.mock('../services/mouserService.js', () => ({ searchPart: vendorSearch }));
vi.mock('../services/cadFileService.js', () => ({ default: { syncComponentCadFiles: vi.fn() } }));
import { updateDistributorInfo, updateComponentSpecifications, updateComponent, createAlternative, updateAlternative, deleteAlternative, promoteAlternative, changeComponentCategory } from '../controllers/componentController.js';
import { syncCategorySpecification } from '../services/specificationService.js';
import { getOrCreateManufacturer } from '../services/manufacturerService.js';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
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

describe('Catalog writes on scratch PostgreSQL', () => {
  let directory;
  let database;
  let postgres;
  beforeAll(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'iclib-catalog-review-'));
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
    await database.query(`
      CREATE TABLE users (id UUID PRIMARY KEY);
      CREATE TABLE manufacturers (id UUID PRIMARY KEY DEFAULT uuidv7(), name TEXT UNIQUE);
      CREATE TABLE component_categories (id UUID PRIMARY KEY, name TEXT, prefix TEXT, leading_zeros INTEGER);
      CREATE TABLE activity_log (component_id UUID, user_id UUID, part_number TEXT, activity_type TEXT, details JSONB);
      CREATE FUNCTION get_part_type(UUID,TEXT,TEXT,TEXT,TEXT) RETURNS TEXT LANGUAGE sql AS $$ SELECT 'test'::text $$;
      CREATE FUNCTION created_at(UUID) RETURNS TIMESTAMPTZ LANGUAGE sql AS $$ SELECT NOW() $$;
    `);
    const schema = fs.readFileSync(new URL('../../../database/init-schema.sql', import.meta.url), 'utf8');
    for (const table of ['components', 'distributors', 'components_alternative', 'distributor_info', 'category_specifications', 'component_specification_values']) {
      const definition = schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\n\\);`));
      await database.query(definition[0]);
    }
  }, 15000);
  afterAll(async () => {
    vi.unstubAllEnvs();
    await database?.end();
    if (!directory) return;
    try { runTool('pg_ctl', ['-D', directory, '-w', 'stop', '-m', 'fast']); } catch { postgres?.kill(); }
    const resolved = path.resolve(directory);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('iclib-catalog-review-')) {
      throw new Error('Unsafe scratch cleanup path');
    }
    fs.rmSync(resolved, { recursive: true, force: true });
  }, 15000);
  beforeEach(async () => {
    vi.stubEnv('CONFIG_ECO', 'true');
    poolProxy.query.mockImplementation((...args) => database.query(...args));
    poolProxy.connect.mockImplementation(() => database.connect());
    vendorSearch.mockReset().mockResolvedValue({ results: [] });
    await database.query(`
      TRUNCATE users, manufacturers, component_categories, components, distributors, components_alternative,
        distributor_info, category_specifications, component_specification_values, activity_log CASCADE;
      INSERT INTO component_categories VALUES ('${id(10)}','First','FIRST',5), ('${id(11)}','Second','SECOND',5);
      INSERT INTO components (id,category_id,part_number,approval_status) VALUES ('${id(1)}','${id(10)}','FIRST-00001','new');
      INSERT INTO distributors (id,name) VALUES ('${id(20)}','Digikey'), ('${id(21)}','Mouser');
      INSERT INTO distributor_info (component_id,distributor_id,sku,stock_quantity) VALUES ('${id(1)}','${id(20)}','old',7);
      INSERT INTO components_alternative (id,component_id,manufacturer_pn) VALUES ('${id(30)}','${id(1)}','ALT');
      INSERT INTO category_specifications (id,category_id,spec_name,unit) VALUES ('${id(40)}','${id(10)}','Own','V'), ('${id(41)}','${id(11)}','Foreign','A');
      INSERT INTO component_specification_values (component_id,category_spec_id,spec_value) VALUES ('${id(1)}','${id(40)}','5');
    `);
  });
  const invoke = async (handler, body, role = 'read-write') => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();
    await handler({ params: { id: id(1), altId: id(30) }, body, user: { id: null, role } }, res, next);
    return { res, next };
  };
  const distributors = async () => (await database.query('SELECT distributor_id,sku,stock_quantity FROM distributor_info ORDER BY distributor_id')).rows;

  it('rolls back distributor deletion and earlier upserts after a late invalid reference', async () => {
    const before = await distributors();
    const { next } = await invoke(updateDistributorInfo, { distributors: [
      { distributor_id: id(21), sku: 'new' }, { distributor_id: id(99), sku: 'invalid' },
    ] });
    expect(next).toHaveBeenCalled();
    expect(await distributors()).toEqual(before);
  });
  it.each(['Digikey', 'Mouser'])('retains an authoritative zero stock from %s', async distributorName => {
    vendorSearch.mockResolvedValue({ results: [{ pricing: [], stock: 0 }] });
    const { res, next } = await invoke(updateDistributorInfo, { distributors: [
      { distributor_id: id(20), distributor_name: distributorName, sku: 'new', stock_quantity: 7 },
    ] });
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ stock_quantity: 0, in_stock: false })]);
  });
  it('rechecks status after asynchronous vendor enrichment', async () => {
    vendorSearch.mockImplementation(async () => {
      await database.query("UPDATE components SET approval_status='production'");
      return { results: [] };
    });
    const before = await distributors();
    const { res } = await invoke(updateDistributorInfo, { distributors: [
      { distributor_id: id(21), distributor_name: 'Mouser', sku: 'new' },
    ] });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(await distributors()).toEqual(before);
  });
  it('rejects a foreign category specification without altering either category or values', async () => {
    const { next } = await invoke(updateComponentSpecifications, { specifications: [{ category_spec_id: id(41), unit: 'WRONG', spec_value: '9' }] });
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
    expect((await database.query('SELECT unit FROM category_specifications WHERE id=$1', [id(41)])).rows[0].unit).toBe('A');
    expect((await database.query('SELECT category_spec_id,spec_value FROM component_specification_values')).rows).toEqual([{ category_spec_id: id(40), spec_value: '5' }]);
  });
  const writes = [
    ['fields', updateComponent, { description: 'Changed' }],
    ['specifications', updateComponentSpecifications, { specifications: [] }],
    ['alternative creation', createAlternative, { manufacturer_pn: 'NEW' }],
    ['alternative update', updateAlternative, { manufacturer_pn: 'NEW' }],
    ['alternative deletion', deleteAlternative, {}],
    ['alternative promotion', promoteAlternative, {}],
    ['category change', changeComponentCategory, { new_category_id: id(11) }],
  ];
  it.each(writes)('rechecks locked component policy for %s after middleware allowed new', async (_name, handler, body) => {
    await database.query("UPDATE components SET approval_status='production'");
    const before = (await database.query('SELECT row_to_json(c) AS data FROM components c')).rows;
    const { res } = await invoke(handler, body);
    expect(res.status).toHaveBeenCalledWith(403);
    expect((await database.query('SELECT row_to_json(c) AS data FROM components c')).rows).toEqual(before);
    expect((await database.query('SELECT manufacturer_pn FROM components_alternative')).rows).toEqual([{ manufacturer_pn: 'ALT' }]);
  });
  it.each([['create', createAlternative], ['update', updateAlternative]])('rolls back alternative %s when a distributor insert fails', async (_name, handler) => {
    const { next } = await invoke(handler, { manufacturer_pn: 'CHANGED', distributors: [{ distributor_id: id(99), sku: 'bad' }] });
    expect(next).toHaveBeenCalled();
    expect((await database.query('SELECT manufacturer_pn FROM components_alternative')).rows).toEqual([{ manufacturer_pn: 'ALT' }]);
  });
  it('recovers a concurrent duplicate specification insertion without aborting the caller transaction', async () => {
    const client = await database.connect();
    await client.query('BEGIN');
    const proxy = { query: async (sql, params) => {
      if (sql.includes('INSERT INTO category_specifications')) {
        await database.query('INSERT INTO category_specifications (category_id,spec_name) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id(10), 'Concurrent']);
      }
      return client.query(sql, params);
    } };
    try {
      const spec = await syncCategorySpecification(proxy, id(10), { spec_name: 'Concurrent', unit: 'V' });
      expect(spec).toMatchObject({ category_id: id(10), spec_name: 'Concurrent', unit: 'V' });
      await client.query('COMMIT');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
  it('recovers concurrent manufacturer creation inside an alternative transaction', async () => {
    const client = await database.connect();
    await client.query('BEGIN');
    const proxy = { query: async (sql, params) => {
      if (sql.includes('INSERT INTO manufacturers')) {
        await database.query("INSERT INTO manufacturers (name) VALUES ('Concurrent') ON CONFLICT DO NOTHING");
      }
      return client.query(sql, params);
    } };
    try {
      const manufacturerId = await getOrCreateManufacturer(proxy, 'Concurrent');
      expect(manufacturerId).toEqual((await database.query("SELECT id FROM manufacturers WHERE name='Concurrent'")).rows[0].id);
      await client.query('COMMIT');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
  it.each([['admin', 'true', 'production'], ['read-write', 'false', 'production'], ['read-write', 'true', 'new']])('allows distributor editing for role %s, ECO %s, status %s', async (role, eco, status) => {
    vi.stubEnv('CONFIG_ECO', eco);
    await database.query('UPDATE components SET approval_status=$1', [status]);
    const { res, next } = await invoke(updateDistributorInfo, { distributors: [] }, role);
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([]);
    expect(await distributors()).toEqual([]);
  });
});
