import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { poolProxy, disk, bytes } = vi.hoisted(() => ({
  poolProxy: { connect: vi.fn(), query: vi.fn() },
  disk: { existsSync: vi.fn(), renameSync: vi.fn(), copyFileSync: vi.fn(), unlinkSync: vi.fn(), mkdirSync: vi.fn() },
  bytes: new Map(),
}));
vi.mock('../config/database.js', () => ({ default: poolProxy }));
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, default: { ...actual.default, ...disk } };
});
vi.mock('../services/emailService.js', () => ({
  sendECONotification: vi.fn().mockResolvedValue(undefined),
  sendApprovedECODocumentControlNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../services/packageService.js', () => ({ listPackages: vi.fn().mockResolvedValue([]) }));
import { createMassFileRenameEco } from '../services/massFileRenameEcoService.js';
import { createECO, approveECO, rejectECO, deleteECO, deleteApprovalStage, reorderApprovalStages, setStageApprovers } from '../controllers/ecoController.js';
import { renamePhysicalFile, renameFootprintGroup } from '../controllers/fileLibraryController.js';
import { finalizeCadUpload } from '../services/cadUploadService.js';

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
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const componentId = id(100);

describe('Shared rename lifecycle on scratch PostgreSQL', () => {
  let dataDirectory;
  let database;
  let postgres;
  beforeAll(async () => {
    dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'iclib-shared-rename-'));
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
    poolProxy.query.mockImplementation((...args) => database.query(...args));
    await database.query(`
      CREATE TABLE users (id UUID PRIMARY KEY, username TEXT, display_name TEXT, delegation UUID, role TEXT);
      CREATE TABLE manufacturers (id UUID PRIMARY KEY, name TEXT);
      CREATE TABLE component_categories (id UUID PRIMARY KEY, name TEXT, prefix TEXT, leading_zeros INTEGER);
      CREATE TABLE activity_log (id UUID DEFAULT uuidv7(), component_id UUID, user_id UUID,
        part_number TEXT, activity_type TEXT, details JSONB);
      CREATE TABLE admin_settings (eco_complete_notification_email TEXT);
    `);
    // Use the real CAD tables and FK actions, including ECO staging cascades.
    const schema = fs.readFileSync(new URL('../../../database/init-schema.sql', import.meta.url), 'utf8');
    for (const table of ['components', 'distributors', 'components_alternative', 'distributor_info', 'category_specifications', 'component_specification_values', 'cad_files', 'component_cad_files', 'footprint_related_cad_files', 'eco_approval_stages', 'eco_settings', 'eco_orders', 'eco_changes', 'eco_approvals', 'eco_stage_approvers', 'eco_file_rename_files', 'eco_file_rename_components', 'eco_distributors', 'eco_alternative_parts', 'eco_specifications', 'eco_cad_files']) {
      const definition = schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\n\\);`));
      if (!definition) throw new Error(`Missing table ${table}`);
      await database.query(definition[0]);
    }
  }, 15000);

  afterAll(async () => {
    vi.unstubAllEnvs();
    await database?.end();
    if (!dataDirectory) return;
    try {
      runTool('pg_ctl', ['-D', dataDirectory, '-w', 'stop', '-m', 'fast']);
    } catch {
      postgres?.kill();
    }
    const resolvedDirectory = path.resolve(dataDirectory);
    if (path.dirname(resolvedDirectory) !== path.resolve(os.tmpdir())
      || !path.basename(resolvedDirectory).startsWith('iclib-shared-rename-')) {
      throw new Error('Refusing to remove a directory outside the scratch fixture');
    }
    fs.rmSync(dataDirectory, { recursive: true, force: true });
  }, 15000);


  beforeEach(async () => {
    vi.stubEnv('CONFIG_ECO', 'true');
    bytes.clear();
    bytes.set('old.pad', 'original bytes');
    disk.existsSync.mockImplementation(file => bytes.has(path.basename(file)));
    disk.renameSync.mockImplementation((from, to) => {
      const source = path.basename(from);
      const target = path.basename(to);
      if (!bytes.has(source)) throw new Error('Missing source');
      bytes.set(target, bytes.get(source));
      bytes.delete(source);
    });
    disk.copyFileSync.mockImplementation((from, to) => bytes.set(path.basename(to), bytes.get(path.basename(from))));
    disk.unlinkSync.mockImplementation(file => bytes.delete(path.basename(file)));
    poolProxy.connect.mockImplementation(() => database.connect());
    poolProxy.query.mockImplementation((...args) => database.query(...args));
    await database.query(`
      DROP TRIGGER IF EXISTS fail_approval ON eco_orders;
      DROP TRIGGER IF EXISTS fail_audit ON activity_log;
      DROP TRIGGER IF EXISTS fail_cad_rename ON cad_files;
      TRUNCATE users, components, cad_files, component_cad_files, eco_settings, eco_orders,
        eco_approval_stages, eco_changes, eco_approvals, eco_stage_approvers, eco_file_rename_files,
        eco_file_rename_components, activity_log, components_alternative, distributor_info,
        distributors, category_specifications, component_specification_values, component_categories,
        manufacturers, footprint_related_cad_files, eco_distributors, eco_alternative_parts,
        eco_specifications, eco_cad_files;
      INSERT INTO users (id, display_name, role) VALUES ('${id(1)}', 'Author', 'read-write'), ('${id(2)}', 'Approver', 'admin');
      INSERT INTO components (id, part_number, approval_status, pad_file)
        VALUES ('${componentId}', 'PN-1', 'production', 'old'), ('${id(101)}', 'PN-2', 'new', 'old');
      INSERT INTO cad_files (id, file_name, file_type, file_path) VALUES ('${id(10)}', 'old.pad', 'pad', 'pad/old.pad');
      INSERT INTO component_cad_files (component_id, cad_file_id) VALUES ('${componentId}', '${id(10)}'), ('${id(101)}', '${id(10)}');
      INSERT INTO eco_settings (prefix) VALUES ('ECO-');
    `);
  });

  const stage = async (client, affectedComponents = [{ id: componentId, part_number: 'PN-1', approval_status: 'production' }]) => {
    const result = await createMassFileRenameEco(client, {
      user: { id: id(1), role: 'read-write' },
      files: [{ cad_file_id: id(10), file_type: 'pad', old_file_name: 'old.pad', new_file_name: 'new.pad' }],
      affectedComponents,
    });
    return result.eco.id;
  };
  const stagedEco = async () => {
    const client = await database.connect();
    try {
      await client.query('BEGIN');
      const ecoId = await stage(client);
      await client.query('COMMIT');
      return ecoId;
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  };
  const request = (ecoId, role = 'admin') => ({ params: { id: ecoId }, body: {}, user: { id: id(2), role } });
  const waitForLock = async () => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const result = await database.query("SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock'");
      if (result.rowCount) return;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error('Expected a competing transaction to wait');
  };
  const state = async () => ({
    files: (await database.query('SELECT file_name FROM cad_files')).rows,
    components: (await database.query('SELECT approval_status, pad_file FROM components ORDER BY id')).rows,
    ecos: (await database.query('SELECT status FROM eco_orders')).rows,
    bytes: [...bytes].sort(([first], [second]) => first.localeCompare(second)),
  });

  const footprintRequest = async (role = 'read-write') => {
    await database.query("UPDATE cad_files SET file_type = 'footprint', file_name = 'old.psm', file_path = 'footprint/old.psm'");
    await database.query(`
      INSERT INTO cad_files (id, file_name, file_type, file_path) VALUES ('${id(11)}', 'old.dra', 'footprint', 'footprint/old.dra');
      INSERT INTO component_cad_files (component_id, cad_file_id) VALUES ('${componentId}', '${id(11)}');
      UPDATE components SET pcb_footprint = 'old', pad_file = NULL;
    `);
    bytes.clear();
    bytes.set('old.psm', 'original bytes');
    bytes.set('old.dra', 'drawing bytes');
    return {
      params: { type: 'footprint' },
      body: { oldFileName: 'old.psm', newFileName: 'new.psm', fileNames: ['old.psm', 'old.dra'], newBaseName: 'new' },
      user: { id: id(1), role },
    };
  };

  it.each(['group', 'shared'])('holds %s rename destinations against concurrent uploads', async operation => {
    const req = operation === 'group' ? await footprintRequest('admin') : request(await stagedEco());
    const target = operation === 'group' ? 'new.dra' : 'new.pad';
    bytes.set('upload.tmp', 'uploaded bytes');
    let paused;
    let resumeRename;
    const pause = new Promise(resolve => { paused = resolve; });
    const resume = new Promise(resolve => { resumeRename = resolve; });
    let didPause = false;
    poolProxy.connect.mockImplementationOnce(async () => {
      const client = await database.connect();
      return {
        query: async (...args) => {
          const result = await client.query(...args);
          const barrier = operation === 'group'
            ? args[0].includes('UPDATE cad_files SET file_name')
            : args[0].includes('SELECT id, file_name, file_type FROM cad_files WHERE id = $1 FOR UPDATE');
          if (barrier && !didPause) { didPause = true; paused(); await resume; }
          return result;
        },
        release: (...args) => client.release(...args),
      };
    });
    const res = response();
    const renaming = (operation === 'group' ? renameFootprintGroup : approveECO)(req, res);
    let uploading;
    let outcome;
    try {
      await pause;
      uploading = finalizeCadUpload({ tempFilename: 'upload.tmp', filename: target,
        category: operation === 'group' ? 'footprint' : 'pad',
      }).then(value => { outcome = { value }; }, error => { outcome = { error }; });
      await waitForLock();
      resumeRename();
      await renaming;
      await uploading;
      expect(res.status).not.toHaveBeenCalled();
      expect(outcome.error?.status).toBe(409);
      expect(bytes.get(target)).toBe(operation === 'group' ? 'drawing bytes' : 'original bytes');
      expect(bytes.get('upload.tmp')).toBe('uploaded bytes');
      expect((await database.query('SELECT file_name FROM cad_files ORDER BY file_name')).rows)
        .toEqual((operation === 'group' ? ['new.dra', 'new.psm'] : ['new.pad']).map(file_name => ({ file_name })));
      expect((await database.query("SELECT * FROM pg_locks WHERE locktype = 'advisory'")).rowCount).toBe(0);
    } finally {
      resumeRename();
      await renaming;
      await uploading;
    }
  });

  const seedAlternative = async (owner = componentId) => {
    await database.query(`
      INSERT INTO components_alternative (id, component_id, manufacturer_pn) VALUES ($1, $2, 'original-alt');
    `, [id(200), owner]);
    await database.query(`
      INSERT INTO distributors (id, name) VALUES ('${id(201)}', 'Vendor');
      INSERT INTO distributor_info (alternative_id, distributor_id, sku) VALUES ('${id(200)}', '${id(201)}', 'original-sku');
    `);
  };
  const componentEcoRequest = (extra) => ({
    body: { component_id: componentId, part_number: 'PN-1', ...extra },
    user: { id: id(1), role: 'read-write' },
  });

  it('routes a legacy approval_status field through status-proposal validation and lifecycle tags', async () => {
    const invalid = response();
    await createECO(componentEcoRequest({ changes: [{ field_name: 'approval_status', new_value: 'new' }] }), invalid);
    expect(invalid.status).toHaveBeenCalledWith(400);
    expect((await database.query('SELECT * FROM eco_orders')).rowCount).toBe(0);
    const valid = response();
    await createECO(componentEcoRequest({ changes: [{ field_name: 'approval_status', new_value: 'prototype' }] }), valid);
    expect(valid.status).toHaveBeenCalledWith(201);
    expect((await database.query('SELECT field_name, new_value FROM eco_changes')).rows)
      .toEqual([{ field_name: '_status_proposal', new_value: 'prototype' }]);
    const approval = response();
    await approveECO(request(valid.json.mock.lastCall[0].id), approval);
    expect(approval.status).not.toHaveBeenCalled();
    expect((await database.query('SELECT approval_status FROM components WHERE id = $1', [componentId])).rows)
      .toEqual([{ approval_status: 'prototype' }]);
  });

  it('allows null optional alternative/distributor groups on ordinary field ECOs', async () => {
    const res = response();
    await createECO(componentEcoRequest({
      alternatives: null, distributors: null, changes: [{ field_name: 'description', new_value: 'new description' }],
    }), res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it.each(['raw status', 'missing category'])('refuses unsafe historical ECO staging: %s', async (kind) => {
    const result = await database.query(`
      INSERT INTO eco_orders (component_id, part_number, initiated_by, eco_number)
      VALUES ($1, 'PN-1', $2, 'ECO-1') RETURNING id
    `, [componentId, id(1)]);
    const ecoId = result.rows[0].id;
    await database.query('INSERT INTO eco_changes (eco_id, field_name, new_value) VALUES ($1, $2, $3)', [
      ecoId, kind === 'raw status' ? 'approval_status' : 'category_id', kind === 'raw status' ? 'new' : id(300),
    ]);
    const res = response();
    await approveECO(request(ecoId), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect((await database.query('SELECT status FROM eco_orders')).rows).toEqual([{ status: 'pending' }]);
    expect((await database.query('SELECT approval_status FROM components WHERE id = $1', [componentId])).rows)
      .toEqual([{ approval_status: 'production' }]);
  });

  it('rejects conflicting status fields instead of approving an unreviewed second status', async () => {
    const res = response();
    await createECO(componentEcoRequest({ changes: [
      { field_name: '_status_proposal', new_value: 'prototype' },
      { field_name: 'approval_status', new_value: 'new' },
    ] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect((await database.query('SELECT * FROM eco_orders')).rowCount).toBe(0);
  });

  it('rechecks a staged status transition against current component status before approval', async () => {
    const res = response();
    await createECO(componentEcoRequest({ changes: [{ field_name: '_status_proposal', new_value: 'prototype' }] }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    await database.query("UPDATE components SET approval_status = 'prototype' WHERE id = $1", [componentId]);
    const approval = response();
    await approveECO(request(res.json.mock.lastCall[0].id), approval);
    expect(approval.status).toHaveBeenCalledWith(409);
    expect((await database.query('SELECT status FROM eco_orders')).rows).toEqual([{ status: 'pending' }]);
  });

  it.each(['alternatives', 'distributors'])('rejects staging %s belonging to another component', async (field) => {
    await seedAlternative(id(101));
    const res = response();
    await createECO(componentEcoRequest({ [field]: [{
      alternative_id: id(200), distributor_id: id(201), action: 'delete',
    }] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect((await database.query('SELECT * FROM eco_orders')).rowCount).toBe(0);
    expect((await database.query('SELECT manufacturer_pn FROM components_alternative')).rows)
      .toEqual([{ manufacturer_pn: 'original-alt' }]);
  });

  it.each(['alternatives', 'distributors'])('refuses previously staged cross-component %s during approval', async (field) => {
    await seedAlternative(id(101));
    const result = await database.query(`
      INSERT INTO eco_orders (component_id, part_number, initiated_by, eco_number)
      VALUES ($1, 'PN-1', $2, 'ECO-1') RETURNING id
    `, [componentId, id(1)]);
    const ecoId = result.rows[0].id;
    if (field === 'alternatives') {
      await database.query("INSERT INTO eco_alternative_parts (eco_id, alternative_id, action) VALUES ($1, $2, 'delete')", [ecoId, id(200)]);
    } else {
      await database.query("INSERT INTO eco_distributors (eco_id, alternative_id, distributor_id, action) VALUES ($1, $2, $3, 'delete')", [ecoId, id(200), id(201)]);
    }
    const res = response();
    await approveECO(request(ecoId), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect((await database.query('SELECT status FROM eco_orders')).rows).toEqual([{ status: 'pending' }]);
    expect((await database.query('SELECT manufacturer_pn FROM components_alternative')).rows)
      .toEqual([{ manufacturer_pn: 'original-alt' }]);
    expect((await database.query('SELECT sku FROM distributor_info')).rows).toEqual([{ sku: 'original-sku' }]);
  });

  it('applies category-copy alternative and distributor edits only to the copied records and honors cleared fields', async () => {
    await seedAlternative();
    await database.query(`
      INSERT INTO component_categories (id, name, prefix, leading_zeros) VALUES ('${id(300)}', 'Target', 'TGT', 3);
      UPDATE components SET description = 'old description', value = 'old value', datasheet_url = 'old URL' WHERE id = '${componentId}';
    `);
    const res = response();
    await createECO(componentEcoRequest({
      changes: [
        { field_name: 'category_id', new_value: id(300) },
        { field_name: 'description', new_value: '' },
        { field_name: 'value', new_value: '' },
        { field_name: 'datasheet_url', new_value: '' },
      ],
      alternatives: [{ alternative_id: id(200), action: 'update', manufacturer_pn: 'updated-alt' }],
      distributors: [{ alternative_id: id(200), distributor_id: id(201), action: 'update', sku: 'updated-sku' }],
    }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    const approval = response();
    await approveECO(request(res.json.mock.lastCall[0].id), approval);
    expect(approval.status).not.toHaveBeenCalled();
    const oldPart = (await database.query('SELECT approval_status, description, value, datasheet_url FROM components WHERE id = $1', [componentId])).rows[0];
    expect(oldPart).toEqual({ approval_status: 'archived', description: 'old description', value: 'old value', datasheet_url: 'old URL' });
    const newPart = (await database.query("SELECT * FROM components WHERE part_number = 'TGT-001'")).rows[0];
    expect(newPart).toMatchObject({ description: '', value: '', datasheet_url: '' });
    expect((await database.query(`
      SELECT ca.component_id, ca.manufacturer_pn, di.sku FROM components_alternative ca
      JOIN distributor_info di ON di.alternative_id = ca.id ORDER BY ca.component_id
    `)).rows).toEqual([
      { component_id: componentId, manufacturer_pn: 'original-alt', sku: 'original-sku' },
      { component_id: newPart.id, manufacturer_pn: 'updated-alt', sku: 'updated-sku' },
    ]);
  });

  it.each([
    ['single admin', renamePhysicalFile, 'admin', true, false],
    ['group admin', renameFootprintGroup, 'admin', true, false],
    ['single ECO off', renamePhysicalFile, 'read-write', false, false],
    ['group ECO off', renameFootprintGroup, 'read-write', false, false],
    ['single one consumer', renamePhysicalFile, 'read-write', true, true],
    ['group one consumer', renameFootprintGroup, 'read-write', true, true],
  ])('preserves direct File Library policy: %s', async (_, handler, role, ecoEnabled, oneConsumer) => {
    const req = await footprintRequest(role);
    vi.stubEnv('CONFIG_ECO', String(ecoEnabled));
    if (oneConsumer) await database.query('DELETE FROM component_cad_files WHERE component_id = $1', [id(101)]);
    const res = response();
    await handler(req, res);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json.mock.lastCall[0]).toMatchObject({ success: true, updatedCount: oneConsumer ? 1 : 2 });
    expect(res.json.mock.lastCall[0].stagedEco).toBeUndefined();
    expect(bytes.get('new.psm')).toBe('original bytes');
    expect((await database.query('SELECT pcb_footprint FROM components WHERE id = $1', [componentId])).rows)
      .toEqual([{ pcb_footprint: 'new' }]);
    expect((await database.query('SELECT * FROM eco_orders')).rowCount).toBe(0);
  });

  it.each([['single', renamePhysicalFile], ['group', renameFootprintGroup]])('rejects stale %s source after waiting for a competing rename', async (_, handler) => {
    const req = await footprintRequest('admin');
    const other = await database.connect();
    let pending;
    try {
      await other.query('BEGIN');
      await other.query("UPDATE cad_files SET file_name = 'other.psm' WHERE id = $1", [id(10)]);
      const res = response();
      pending = handler(req, res);
      await waitForLock();
      bytes.set('other.psm', bytes.get('old.psm'));
      bytes.delete('old.psm');
      await other.query('COMMIT');
      await pending;
      expect(res.status).toHaveBeenCalledWith(409);
      expect(bytes.get('other.psm')).toBe('original bytes');
      expect(bytes.has('new.psm')).toBe(false);
      expect(bytes.get('old.dra')).toBe('drawing bytes');
      expect((await database.query('SELECT file_name FROM cad_files ORDER BY id')).rows)
        .toEqual([{ file_name: 'other.psm' }, { file_name: 'old.dra' }]);
    } finally {
      await other.query('ROLLBACK');
      other.release();
      await pending;
    }
  });

  it.each([false, true])('restores the whole direct footprint pair on database failure (deferred: %s)', async (deferred) => {
    const req = await footprintRequest('admin');
    const before = await state();
    await database.query(`
      CREATE OR REPLACE FUNCTION reject_cad_rename() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'injected CAD rename failure'; END $$;
      CREATE ${deferred ? 'CONSTRAINT' : ''} TRIGGER fail_cad_rename AFTER UPDATE ON cad_files
      ${deferred ? 'DEFERRABLE INITIALLY DEFERRED' : ''}
      FOR EACH ROW WHEN (NEW.file_name = 'new.dra') EXECUTE FUNCTION reject_cad_rename();
    `);
    const res = response();
    await renameFootprintGroup(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(await state()).toEqual(before);
    expect((await database.query('SELECT pcb_footprint FROM components ORDER BY id')).rows)
      .toEqual([{ pcb_footprint: 'old' }, { pcb_footprint: 'old' }]);
  });

  it.each([['single', renamePhysicalFile], ['group', renameFootprintGroup]])('refreshes %s rename consumers and exposes accurate staged counts', async (_, handler) => {
    await database.query("UPDATE cad_files SET file_type = 'footprint', file_name = 'old.psm' WHERE id = $1", [id(10)]);
    bytes.clear();
    bytes.set('old.psm', 'original bytes');
    bytes.set('old.dra', 'drawing bytes');
    await database.query(`
      INSERT INTO cad_files (id, file_name, file_type) VALUES ('${id(11)}', 'old.dra', 'footprint');
      INSERT INTO component_cad_files (component_id, cad_file_id) VALUES ('${componentId}', '${id(11)}');
    `);
    let changed = false;
    poolProxy.query.mockImplementation(async (sql, ...args) => {
      const result = await database.query(sql, ...args);
      if (!changed && sql.includes('FROM cad_files') && sql.includes('file_name = $1')) {
        changed = true;
        await database.query("UPDATE components SET approval_status = 'prototype' WHERE id = $1", [id(101)]);
      }
      return result;
    });
    const res = response();
    await handler({
      params: { type: 'footprint' },
      body: { oldFileName: 'old.psm', newFileName: 'new.psm', fileNames: ['old.psm', 'old.dra'], newBaseName: 'new' },
      user: { id: id(1), role: 'read-write' },
    }, res);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json.mock.lastCall[0]).toMatchObject({ stagedEco: true, affectedCount: 2, skippedCount: 0, updatedCount: 2 });
    expect((await database.query('SELECT original_approval_status FROM eco_file_rename_components ORDER BY component_id')).rows)
      .toEqual([{ original_approval_status: 'production' }, { original_approval_status: 'prototype' }]);
    expect([...bytes]).toEqual([['old.psm', 'original bytes'], ['old.dra', 'drawing bytes']]);
  });

  it.each([['single', renamePhysicalFile], ['group', renameFootprintGroup]])('stages %s rename when a consumer becomes controlled after discovery', async (_, handler) => {
    await database.query("UPDATE components SET approval_status = 'new'");
    await database.query("UPDATE cad_files SET file_type = 'footprint', file_name = 'old.psm'");
    bytes.clear();
    bytes.set('old.psm', 'original bytes');
    bytes.set('old.dra', 'drawing bytes');
    await database.query(`INSERT INTO cad_files (id, file_name, file_type) VALUES ('${id(11)}', 'old.dra', 'footprint')`);
    let changed = false;
    // The old implementation makes its routing decision from an unlocked
    // consumer snapshot. Change status after that snapshot (or file discovery
    // when the replacement no longer performs the unlocked consumer read).
    const changeStatus = async () => {
      if (changed) return;
      changed = true;
      await database.query("UPDATE components SET approval_status = 'production' WHERE id = $1", [componentId]);
    };
    poolProxy.query.mockImplementation(async (sql, ...args) => {
      const result = await database.query(sql, ...args);
      if (sql.includes('c.approval_status') && sql.includes('WHERE ccf.cad_file_id')) await changeStatus();
      return result;
    });
    poolProxy.connect.mockImplementation(async () => {
      const client = await database.connect();
      const query = client.query.bind(client);
      return {
        query: async (sql, ...args) => {
          if (sql === 'BEGIN') await changeStatus();
          return query(sql, ...args);
        },
        release: () => client.release(),
      };
    });
    const res = response();
    await handler({
      params: { type: 'footprint' },
      body: { oldFileName: 'old.psm', newFileName: 'new.psm', fileNames: ['old.psm', 'old.dra'], newBaseName: 'new' },
      user: { id: id(1), role: 'read-write' },
    }, res);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json.mock.lastCall[0]).toMatchObject({ stagedEco: true, affectedCount: 2, skippedCount: 1, updatedCount: 1 });
    expect([...bytes]).toEqual([['old.psm', 'original bytes'], ['old.dra', 'drawing bytes']]);
    expect((await database.query('SELECT file_name FROM cad_files ORDER BY id')).rows).toEqual([{ file_name: 'old.psm' }, { file_name: 'old.dra' }]);
    expect((await database.query('SELECT approval_status FROM components ORDER BY id')).rows)
      .toEqual([{ approval_status: 'reviewing' }, { approval_status: 'new' }]);
  });

  it('serializes parallel votes and applies only after the required distinct approvals', async () => {
    await database.query(`
      INSERT INTO users (id, display_name, role) VALUES ('${id(3)}', 'Second approver', 'approver');
      INSERT INTO eco_approval_stages (stage_name, stage_order, required_approvals) VALUES ('Review', 1, 2);
    `);
    const ecoId = await stagedEco();
    const first = response();
    const repeated = response();
    await Promise.all([approveECO(request(ecoId), first), approveECO(request(ecoId), repeated)]);
    expect([first, repeated].filter(res => res.status.mock.lastCall?.[0] === 403)).toHaveLength(1);
    expect((await database.query('SELECT status FROM eco_orders')).rows).toEqual([{ status: 'in_review' }]);
    expect((await database.query('SELECT user_id FROM eco_approvals')).rows).toEqual([{ user_id: id(2) }]);
    expect([...bytes]).toEqual([['old.pad', 'original bytes']]);
    const second = response();
    await approveECO({ ...request(ecoId), user: { id: id(3), role: 'approver' } }, second);
    expect(second.status).not.toHaveBeenCalled();
    expect(second.json.mock.lastCall[0].status).toBe('approved');
    expect([...bytes]).toEqual([['new.pad', 'original bytes']]);
  });

  it.each([['reject', rejectECO], ['delete', deleteECO]])('captures current locked status before %s restores it', async (_, handler) => {
    const writer = await database.connect();
    const staging = await database.connect();
    let operation;
    try {
      await writer.query('BEGIN');
      await writer.query("UPDATE components SET approval_status = 'archived' WHERE id = $1", [componentId]);
      await staging.query('BEGIN');
      operation = stage(staging);
      await waitForLock();
      await writer.query('COMMIT');
      const ecoId = await operation;
      await staging.query('COMMIT');
      const res = response();
      await handler(request(ecoId), res);
      expect(res.status).not.toHaveBeenCalled();
      expect((await database.query('SELECT approval_status FROM components WHERE id = $1', [componentId])).rows[0].approval_status).toBe('archived');
      expect([...bytes]).toEqual([['old.pad', 'original bytes']]);
    } finally {
      await writer.query('ROLLBACK');
      await operation?.catch(() => {});
      await staging.query('ROLLBACK');
      writer.release();
      staging.release();
    }
  });

  it.each([false, true])('reverts disk when approval fails after apply (deferred: %s)', async (deferred) => {
    const ecoId = await stagedEco();
    const before = await state();
    await database.query(`
      CREATE OR REPLACE FUNCTION reject_approval() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'injected approval failure'; END $$;
      CREATE ${deferred ? 'CONSTRAINT' : ''} TRIGGER fail_approval AFTER UPDATE ON eco_orders
      ${deferred ? 'DEFERRABLE INITIALLY DEFERRED' : ''} FOR EACH ROW EXECUTE FUNCTION reject_approval();
    `);
    const res = response();
    await approveECO(request(ecoId), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(await state()).toEqual(before);
  });

  it('commits approval despite a best-effort audit insert failure', async () => {
    const ecoId = await stagedEco();
    await database.query(`
      CREATE OR REPLACE FUNCTION reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'injected audit failure'; END $$;
      CREATE TRIGGER fail_audit BEFORE INSERT ON activity_log FOR EACH ROW EXECUTE FUNCTION reject_audit();
    `);
    const res = response();
    await approveECO(request(ecoId), res);
    expect(res.status).not.toHaveBeenCalled();
    expect(await state()).toEqual({
      files: [{ file_name: 'new.pad' }],
      components: [{ approval_status: 'production', pad_file: 'new' }, { approval_status: 'new', pad_file: 'new' }],
      ecos: [{ status: 'approved' }],
      bytes: [['new.pad', 'original bytes']],
    });
  });

  it.each([['approve', approveECO], ['reject', rejectECO]])('reports committed %s success when notification lookup fails', async (_, handler) => {
    const ecoId = await stagedEco();
    poolProxy.query.mockImplementation((sql, ...args) => {
      if (sql.includes('SELECT display_name')) throw new Error('injected notification lookup failure');
      return database.query(sql, ...args);
    });
    const res = response();
    await handler(request(ecoId), res);
    expect(res.status).not.toHaveBeenCalled();
    expect((await database.query('SELECT status FROM eco_orders')).rows).toEqual([{ status: handler === approveECO ? 'approved' : 'rejected' }]);
  });

  it('reports the created ECO when its notification lookup fails', async () => {
    poolProxy.query.mockRejectedValue(new Error('injected notification lookup failure'));
    const res = response();
    await createECO({
      user: { id: id(1), role: 'read-write' },
      body: { component_id: componentId, part_number: 'PN-1', changes: [{ field_name: 'description', old_value: '', new_value: 'Updated' }] },
    }, res);
    expect(res.status.mock.lastCall).toEqual([201]);
    expect((await database.query('SELECT id FROM eco_orders')).rows).toEqual([{ id: res.json.mock.lastCall[0].id }]);
  });

  it.each([
    ['approve', approveECO, {}, 404], ['reject', rejectECO, {}, 404],
    ['reorder stages', reorderApprovalStages, {}, 400],
    ['assign stage (invalid body)', setStageApprovers, {}, 400],
    ['assign stage (missing stage)', setStageApprovers, { user_ids: [] }, 404],
  ])('ends the transaction when %s returns early', async (_, handler, body, status) => {
    const owned = await database.connect();
    poolProxy.connect.mockResolvedValue({ query: (...args) => owned.query(...args), release: vi.fn() });
    try {
      const res = response();
      await handler({ ...request(id(999)), body }, res);
      expect(res.status).toHaveBeenCalledWith(status);
      const result = await database.query('SELECT state FROM pg_stat_activity WHERE pid = $1', [owned.processID]);
      expect(result.rows[0].state).toBe('idle');
    } finally {
      await owned.query('ROLLBACK');
      owned.release();
    }
  });

  it('preserves parallel stage groups and active ECO order pointers when another stage is deleted', async () => {
    await database.query(`
      INSERT INTO eco_approval_stages (id, stage_name, stage_order) VALUES
        ('${id(20)}', 'First', 1), ('${id(21)}', 'Parallel A', 2), ('${id(22)}', 'Parallel B', 2);
    `);
    const ecoId = await stagedEco();
    await database.query('UPDATE eco_orders SET current_stage_order = 2 WHERE id = $1', [ecoId]);
    const res = response();
    await deleteApprovalStage(request(id(20)), res);
    expect(res.status).not.toHaveBeenCalled();
    expect((await database.query('SELECT stage_order FROM eco_approval_stages ORDER BY id')).rows)
      .toEqual([{ stage_order: 2 }, { stage_order: 2 }]);
    expect((await database.query('SELECT current_stage_order FROM eco_orders')).rows).toEqual([{ current_stage_order: 2 }]);
  });

  it('ends the transaction when deletion of an in-use approval stage is refused', async () => {
    await database.query(`INSERT INTO eco_approval_stages (id, stage_name, stage_order) VALUES ('${id(20)}', 'Review', 1)`);
    await stagedEco();
    const owned = await database.connect();
    poolProxy.connect.mockResolvedValue({ query: (...args) => owned.query(...args), release: vi.fn() });
    try {
      const res = response();
      await deleteApprovalStage(request(id(20)), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect((await database.query('SELECT state FROM pg_stat_activity WHERE pid = $1', [owned.processID])).rows[0].state).toBe('idle');
    } finally {
      await owned.query('ROLLBACK');
      owned.release();
    }
  });

  it('serializes concurrent replacement of stage approver assignments', async () => {
    await database.query(`INSERT INTO eco_approval_stages (id, stage_name, stage_order) VALUES ('${id(20)}', 'Review', 1)`);
    let releaseFirst;
    const firstPaused = new Promise(resolve => { releaseFirst = resolve; });
    let signalDeleted;
    const deleted = new Promise(resolve => { signalDeleted = resolve; });
    const firstClient = await database.connect();
    poolProxy.connect.mockResolvedValueOnce({
      query: async (sql, ...args) => {
        const result = await firstClient.query(sql, ...args);
        if (sql.includes('DELETE FROM eco_stage_approvers')) {
          signalDeleted();
          await firstPaused;
        }
        return result;
      },
      release: () => firstClient.release(),
    });
    const firstResponse = response();
    const secondResponse = response();
    const firstRequest = setStageApprovers({ ...request(id(20)), body: { user_ids: [id(1)] } }, firstResponse);
    let secondRequest;
    try {
      await deleted;
      secondRequest = setStageApprovers({ ...request(id(20)), body: { user_ids: [id(2)] } }, secondResponse);
      // The old handler finishes instead of waiting; assert the resulting sets below.
      await waitForLock().catch(() => {});
      releaseFirst();
      await Promise.all([firstRequest, secondRequest]);
      expect(firstResponse.status).not.toHaveBeenCalled();
      expect(secondResponse.status).not.toHaveBeenCalled();
      expect(firstResponse.json.mock.lastCall[0].map(row => row.user_id)).toEqual([id(1)]);
      expect(secondResponse.json.mock.lastCall[0].map(row => row.user_id)).toEqual([id(2)]);
      expect((await database.query('SELECT user_id FROM eco_stage_approvers')).rows).toEqual([{ user_id: id(2) }]);
    } finally {
      releaseFirst();
      await Promise.all([firstRequest, secondRequest]);
    }
  });

  it.each([['approve', approveECO], ['reject', rejectECO], ['delete', deleteECO]])('rechecks terminal status after competing approval before %s', async (_, handler) => {
    const ecoId = await stagedEco();
    const writer = await database.connect();
    let operation;
    const res = response();
    try {
      await writer.query('BEGIN');
      await writer.query("UPDATE eco_orders SET status = 'approved' WHERE id = $1", [ecoId]);
      operation = handler(request(ecoId), res);
      await waitForLock();
      await writer.query('COMMIT');
      await operation;
      expect(res.status.mock.lastCall?.[0]).toBe(handler === deleteECO ? 404 : 400);
      expect((await database.query('SELECT status FROM eco_orders WHERE id = $1', [ecoId])).rows).toEqual([{ status: 'approved' }]);
      expect([...bytes]).toEqual([['old.pad', 'original bytes']]);
    } finally {
      await writer.query('ROLLBACK');
      writer.release();
      await operation;
    }
  });
});
