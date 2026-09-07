import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { poolProxy } = vi.hoisted(() => ({ poolProxy: { connect: vi.fn(), query: vi.fn() } }));
vi.mock('../config/database.js', () => ({ default: poolProxy }));
vi.mock('../utils/logger.js', () => ({ logError: vi.fn() }));
import { consumeProjectComponents } from '../controllers/projectController.js';
import { updateAlternativeInventory } from '../controllers/inventoryController.js';

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
const consume = async (id = 1) => {
  const res = response();
  await consumeProjectComponents({ params: { id }, user: {} }, res);
  return res;
};

describe('stock writes on scratch PostgreSQL', () => {
  let dataDirectory;
  let database;
  let postgres;

  beforeAll(async () => {
    dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'iclib-consumption-'));
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
    await database.query(`
      CREATE TABLE projects (id INTEGER PRIMARY KEY, name TEXT);
      CREATE TABLE components (id INTEGER PRIMARY KEY, part_number TEXT, description TEXT);
      CREATE TABLE components_alternative (id INTEGER PRIMARY KEY, component_id INTEGER REFERENCES components(id));
      CREATE TABLE project_components (
        id INTEGER PRIMARY KEY, project_id INTEGER REFERENCES projects(id),
        component_id INTEGER REFERENCES components(id), alternative_id INTEGER REFERENCES components_alternative(id),
        quantity INTEGER NOT NULL
      );
      CREATE TABLE inventory (component_id INTEGER UNIQUE REFERENCES components(id), quantity INTEGER);
      CREATE TABLE inventory_alternative (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        alternative_id INTEGER UNIQUE REFERENCES components_alternative(id),
        quantity INTEGER, location TEXT, min_quantity INTEGER, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE activity_log (component_id INTEGER, user_id UUID, part_number TEXT, activity_type TEXT, details JSONB);
    `);
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
      || !path.basename(resolvedDirectory).startsWith('iclib-consumption-')) {
      throw new Error('Refusing to remove a directory outside the scratch fixture');
    }
    fs.rmSync(dataDirectory, { recursive: true, force: true });
  }, 15000);

  beforeEach(async () => {
    poolProxy.query.mockImplementation((...args) => database.query(...args));
    await database.query(`
      TRUNCATE projects, components, components_alternative, project_components, inventory, inventory_alternative, activity_log;
      INSERT INTO projects VALUES (1, 'Build');
      INSERT INTO components VALUES (1, 'PN-1', 'Primary'), (2, 'PN-2', 'Other');
      INSERT INTO components_alternative VALUES (1, 2);
      INSERT INTO project_components VALUES (1, 1, 1, NULL, 3), (2, 1, NULL, 1, 4);
      INSERT INTO inventory VALUES (1, 10);
      INSERT INTO inventory_alternative (alternative_id, quantity) VALUES (1, 10);
    `);
  });

  const quantities = async () => (await database.query(`
    SELECT quantity FROM inventory UNION ALL SELECT quantity FROM inventory_alternative
  `)).rows.map(row => row.quantity);

  it('decrements the primary and alternative stock and commits the audit record', async () => {
    const res = await consume();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      updates: [{ component_id: 1, new_quantity: 7 }, { alternative_id: 1, new_quantity: 6 }],
    }));
    expect(await quantities()).toEqual([7, 6]);
    const audit = await database.query('SELECT details FROM activity_log');
    expect(audit.rows[0].details).toMatchObject({ consumed_quantity: 3, new_quantity: 7 });
  });

  it.each([[1, -2], [2, -2], [1, 0]])('rejects stored invalid quantity on line %i: %i', async (lineId, quantity) => {
    await database.query('UPDATE project_components SET quantity = $2 WHERE id = $1', [lineId, quantity]);
    const res = await consume();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      details: expect.arrayContaining([expect.objectContaining({ requested_quantity: quantity })]),
    }));
    expect(await quantities()).toEqual([10, 10]);
    expect((await database.query('SELECT * FROM activity_log')).rows).toEqual([]);
  });

  it('rejects a missing project instead of reporting successful consumption', async () => {
    const res = await consume(99);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(await quantities()).toEqual([10, 10]);
  });

  it('rolls back earlier stock and audit writes when an alternative is short', async () => {
    await database.query('UPDATE inventory_alternative SET quantity = 1');
    const res = await consume();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(await quantities()).toEqual([10, 1]);
    expect((await database.query('SELECT * FROM activity_log')).rows).toEqual([]);
  });

  it('reports database faults as server errors and rolls back the entire consumption', async () => {
    // This row is valid; a trigger forces a failure after the primary deduction.
    await database.query(`
      CREATE FUNCTION fail_consume() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'private database failure'; END $$;
      CREATE TRIGGER fail_consume BEFORE UPDATE ON inventory_alternative
        FOR EACH ROW EXECUTE FUNCTION fail_consume();
    `);
    try {
      const res = await consume();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to consume project components' });
      expect(await quantities()).toEqual([10, 10]);
      expect((await database.query('SELECT * FROM activity_log')).rows).toEqual([]);
    } finally {
      await database.query('DROP TRIGGER fail_consume ON inventory_alternative; DROP FUNCTION fail_consume()');
    }
  });

  it('allows only one concurrent consumption when stock covers a single build', async () => {
    await database.query('UPDATE inventory SET quantity = 3; UPDATE inventory_alternative SET quantity = 4');
    const results = await Promise.all([consume(), consume()]);
    const statuses = results.map(res => res.status.mock.calls[0]?.[0] || 200).sort();
    expect(statuses).toEqual([200, 409]);
    expect(await quantities()).toEqual([0, 0]);
    expect((await database.query('SELECT * FROM activity_log')).rows).toHaveLength(1);
  });

  it('retains independent first-time alternative stock edits from concurrent requests', async () => {
    await database.query('DELETE FROM inventory_alternative');
    let readCount = 0;
    let finishReads;
    const readsFinished = new Promise(resolve => { finishReads = resolve; });
    // Force the old SELECT-then-INSERT implementation to observe the same
    // missing row twice. An atomic write does not use this read barrier.
    poolProxy.query.mockImplementation(async (sql, params) => {
      const result = await database.query(sql, params);
      if (sql.startsWith('SELECT id FROM inventory_alternative')) {
        readCount++;
        if (readCount === 2) finishReads();
        await readsFinished;
      }
      return result;
    });
    const next = vi.fn();
    const responses = [response(), response()];
    await Promise.all([
      updateAlternativeInventory({ params: { altId: 1 }, body: { quantity: 8 } }, responses[0], next),
      updateAlternativeInventory({ params: { altId: 1 }, body: { location: 'Shelf A' } }, responses[1], next),
    ]);
    expect(next).not.toHaveBeenCalled();
    expect(responses[0].json).toHaveBeenCalled();
    expect(responses[1].json).toHaveBeenCalled();
    expect((await database.query('SELECT quantity, location, min_quantity FROM inventory_alternative')).rows)
      .toEqual([{ quantity: 8, location: 'Shelf A', min_quantity: 0 }]);
  });

  it('preserves omitted alternative fields while applying explicit zero and empty values', async () => {
    await database.query("UPDATE inventory_alternative SET location = 'Shelf A', min_quantity = 5");
    const next = vi.fn();
    const res = response();
    await updateAlternativeInventory({ params: { altId: 1 }, body: { quantity: 0, location: '' } }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ quantity: 0, location: '', min_quantity: 5 }));
  });
});
