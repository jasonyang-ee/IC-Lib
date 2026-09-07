import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { poolProxy, disk } = vi.hoisted(() => ({
  poolProxy: { connect: vi.fn(), query: vi.fn() },
  disk: { existsSync: vi.fn(() => true), unlinkSync: vi.fn(), renameSync: vi.fn() },
}));
vi.mock('../config/database.js', () => ({ default: poolProxy }));
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, default: { ...actual.default, ...disk } };
});
import { deleteFile, finalizeTempFile, restoreDeletedFile, renameFile } from '../controllers/fileUploadController.js';
import { deletePhysicalFile, deleteFileGroup, bulkDeleteOrphanFiles } from '../controllers/fileLibraryController.js';
import { deleteCadFile, getOrphanCadFiles, regenerateAllCadText, unlinkCadFileFromComponent } from '../services/cadFileService.js';

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

describe('CAD removal on scratch PostgreSQL', () => {
  let dataDirectory;
  let database;
  let postgres;

  beforeAll(async () => {
    dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'iclib-cad-removal-'));
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
      CREATE FUNCTION created_at(UUID) RETURNS TIMESTAMP LANGUAGE SQL IMMUTABLE AS 'SELECT NULL::timestamp';
      CREATE TABLE manufacturers (id UUID PRIMARY KEY, name TEXT);
      CREATE TABLE component_categories (id UUID PRIMARY KEY, name TEXT);
      CREATE TABLE components (
        id UUID PRIMARY KEY, manufacturer_pn TEXT, part_number TEXT, approval_status TEXT,
        description TEXT, value TEXT, package_size TEXT, manufacturer_id UUID, category_id UUID,
        pcb_footprint TEXT, pad_file TEXT, step_model TEXT, schematic TEXT, pspice TEXT, updated_at TIMESTAMP
      );
      CREATE TABLE eco_orders (id UUID PRIMARY KEY, status TEXT);
    `);
    // Use the real CAD tables and FK actions, including ECO staging cascades.
    const schema = fs.readFileSync(new URL('../../../database/init-schema.sql', import.meta.url), 'utf8');
    for (const table of ['cad_files', 'component_cad_files', 'footprint_related_cad_files', 'eco_cad_files', 'eco_file_rename_files']) {
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
      || !path.basename(resolvedDirectory).startsWith('iclib-cad-removal-')) {
      throw new Error('Refusing to remove a directory outside the scratch fixture');
    }
    fs.rmSync(dataDirectory, { recursive: true, force: true });
  }, 15000);

  beforeEach(async () => {
    vi.stubEnv('CONFIG_ECO', 'false');
    disk.unlinkSync.mockClear();
    disk.renameSync.mockClear();
    disk.existsSync.mockReturnValue(true);
    await database.query(`
      TRUNCATE components, cad_files, component_cad_files, footprint_related_cad_files, eco_orders,
        eco_cad_files, eco_file_rename_files;
      INSERT INTO components (id, manufacturer_pn, part_number, approval_status)
        VALUES ('${componentId}', 'PART', 'PN-1', 'new');
    `);
  });

  const addFile = async (n, name, type) => {
    await database.query('INSERT INTO cad_files (id, file_name, file_type) VALUES ($1, $2, $3)', [id(n), name, type]);
    return id(n);
  };
  const link = async (fileId, db = database) => db.query(
    'INSERT INTO component_cad_files (component_id, cad_file_id) VALUES ($1, $2)', [componentId, fileId],
  );
  const linkedNames = async () => (await database.query(`
    SELECT cf.file_name FROM component_cad_files ccf JOIN cad_files cf ON cf.id = ccf.cad_file_id ORDER BY cf.file_name
  `)).rows.map(row => row.file_name);
  const removePartFile = async (role = 'read-write') => {
    const res = response();
    await deleteFile({ body: { category: 'footprint', mfgPartNumber: 'PART', filename: 'part_a.psm' }, user: { role } }, res);
    return res;
  };
  const addVariants = async (bindings = true) => {
    for (const [n, name, type] of [
      [1, 'part_a.psm', 'footprint'], [2, 'part_a.dra', 'footprint'],
      [3, 'part_b.psm', 'footprint'], [4, 'part_c.psm', 'footprint'],
      [5, 'shared.pad', 'pad'], [6, 'a.pad', 'pad'], [7, 'unbound.pad', 'pad'], [8, 'body.step', 'model'],
    ]) await link(await addFile(n, name, type));
    if (bindings) {
      for (const [footprint, related, type] of [[1, 5, 'pad'], [2, 6, 'pad'], [1, 8, 'model'], [3, 5, 'pad'], [4, 8, 'model']]) {
        await database.query(`INSERT INTO footprint_related_cad_files
          (footprint_cad_file_id, related_cad_file_id, related_file_type) VALUES ($1, $2, $3)`, [id(footprint), id(related), type]);
      }
    }
    await regenerateAllCadText(componentId);
  };
  const stage = async (fileId, status = 'pending', action = 'link') => {
    await database.query('INSERT INTO eco_orders VALUES ($1, $2)', [id(200), status]);
    if (action === 'rename') {
      await database.query(`INSERT INTO eco_file_rename_files (eco_id, cad_file_id, file_type, old_file_name, new_file_name)
        VALUES ($1, $2, 'footprint', 'part_a.psm', 'next.psm')`, [id(200), fileId]);
    } else {
      await database.query(`INSERT INTO eco_cad_files (eco_id, cad_file_id, file_type, file_name, action)
        VALUES ($1, $2, 'footprint', 'part_a.psm', $3)`, [id(200), fileId, action]);
    }
  };

  it('removes only a variant and its exclusive dependencies, retaining shared and unbound files', async () => {
    await addVariants();
    const res = await removePartFile();
    expect(res.status).not.toHaveBeenCalled();
    expect(await linkedNames()).toEqual(['body.step', 'part_b.psm', 'part_c.psm', 'shared.pad', 'unbound.pad']);
    expect((await database.query('SELECT pad_file, step_model, pcb_footprint FROM components')).rows[0]).toEqual({
      pad_file: 'shared,unbound', step_model: 'body', pcb_footprint: 'part_b,part_c',
    });
    expect((await database.query('SELECT * FROM cad_files')).rowCount).toBe(8);
    expect((await database.query('SELECT * FROM footprint_related_cad_files')).rowCount).toBe(5);
    expect(disk.unlinkSync).not.toHaveBeenCalled();
  });

  it('keeps every unbound pad/model when several variants have no relationship history', async () => {
    await addVariants(false);
    await removePartFile();
    expect(await linkedNames()).toEqual(['a.pad', 'body.step', 'part_b.psm', 'part_c.psm', 'shared.pad', 'unbound.pad']);
  });

  it.each(['reviewing', 'prototype', 'production', 'archived'])('rejects legacy unlink for a controlled %s part', async (status) => {
    vi.stubEnv('CONFIG_ECO', 'true');
    await addVariants();
    await database.query('UPDATE components SET approval_status = $1', [status]);
    const before = await linkedNames();
    const res = await removePartFile();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(await linkedNames()).toEqual(before);
  });

  it('still allows admin direct unlink in ECO mode', async () => {
    vi.stubEnv('CONFIG_ECO', 'true');
    await addVariants();
    await database.query("UPDATE components SET approval_status = 'production'");
    expect((await removePartFile('admin')).status).not.toHaveBeenCalled();
    expect(await linkedNames()).not.toContain('part_a.psm');
  });

  it('rolls back standalone unlink if derived TEXT cannot be saved', async () => {
    await link(await addFile(1, 'part_a.psm', 'footprint'));
    await database.query("UPDATE components SET pcb_footprint = 'part_a'");
    await database.query("ALTER TABLE components ADD CONSTRAINT reject_empty CHECK (pcb_footprint <> '')");
    try {
      await expect(unlinkCadFileFromComponent(id(1), componentId, 'footprint', 'part_a.psm')).rejects.toThrow();
      expect(await linkedNames()).toEqual(['part_a.psm']);
      expect((await database.query('SELECT pcb_footprint FROM components')).rows[0].pcb_footprint).toBe('part_a');
    } finally {
      await database.query('ALTER TABLE components DROP CONSTRAINT reject_empty');
    }
  });

  it.each(['approved', 'rejected'])('lists unused files from %s ECOs as orphans', async (status) => {
    await stage(await addFile(1, 'part_a.psm', 'footprint'), status);
    expect((await getOrphanCadFiles()).map(file => file.id)).toEqual([id(1)]);
  });

  it.each(['link', 'unlink', 'rename'])('protects active ECO %s references from listing and physical deletion', async (action) => {
    await stage(await addFile(1, 'part_a.psm', 'footprint'), 'pending', action);
    expect(await getOrphanCadFiles()).toEqual([]);
    const res = response();
    await deletePhysicalFile({ params: { type: 'footprint' }, body: { fileName: 'part_a.psm' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect((await database.query('SELECT * FROM cad_files')).rowCount).toBe(1);
    expect(disk.unlinkSync).not.toHaveBeenCalled();
  });

  it('rejects a whole footprint group before deleting either member when the second is staged', async () => {
    await addFile(1, 'part_a.psm', 'footprint');
    await stage(await addFile(2, 'part_a.dra', 'footprint'));
    const res = response();
    await deleteFileGroup({ params: { type: 'footprint' }, body: { fileNames: ['part_a.psm', 'part_a.dra'] } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect((await database.query('SELECT * FROM cad_files')).rowCount).toBe(2);
    expect(disk.unlinkSync).not.toHaveBeenCalled();
  });

  it('deletes an unused group after commit', async () => {
    await addFile(1, 'part_a.psm', 'footprint');
    await addFile(2, 'part_a.dra', 'footprint');
    const res = response();
    await bulkDeleteOrphanFiles({ params: { type: 'footprint' }, body: { fileNames: ['part_a.psm', 'part_a.dra'] } }, res);
    expect(res.status).not.toHaveBeenCalled();
    expect((await database.query('SELECT * FROM cad_files')).rowCount).toBe(0);
    expect(disk.unlinkSync).toHaveBeenCalledTimes(2);
  });

  it('rechecks references after a concurrent component link commits', async () => {
    await addFile(1, 'part_a.psm', 'footprint');
    const writer = await database.connect();
    let deletion;
    try {
      await writer.query('BEGIN');
      await link(id(1), writer);
      // A real FK key-share lock keeps deletion waiting until the writer commits.
      deletion = deleteCadFile(id(1)).then(() => null, error => error);
      let blocked = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        const waiting = await database.query(`SELECT 1 FROM pg_stat_activity
          WHERE pid <> pg_backend_pid() AND wait_event_type = 'Lock'
            AND query LIKE 'SELECT * FROM cad_files%FOR UPDATE'`);
        if (waiting.rowCount) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true);
      await writer.query('COMMIT');
      const error = await deletion;
      expect(error?.status).toBe(409);
      expect(await linkedNames()).toEqual(['part_a.psm']);
      expect(disk.unlinkSync).not.toHaveBeenCalled();
    } finally {
      await writer.query('ROLLBACK');
      writer.release();
      await deletion;
    }
  });

  const finalizeExisting = async (role = 'lab', extra = {}) => {
    const res = response();
    await finalizeTempFile({ user: { role }, body: {
      files: [{ tempFilename: '100-200-part_a.psm', category: 'footprint', resolution: 'use_existing' }],
      componentId, mfgPartNumber: 'PART', ...extra,
    } }, res);
    return res.json.mock.calls[0][0].results[0];
  };

  it.each(['reviewing', 'prototype', 'production', 'archived'])('protects %s components in finalize and restore', async status => {
    vi.stubEnv('CONFIG_ECO', 'true');
    await database.query('UPDATE components SET approval_status = $1', [status]);
    const finalized = await finalizeExisting();
    expect(finalized.error).toContain('ECO approval');
    const res = response();
    await restoreDeletedFile({ user: { role: 'lab' }, body: { files: [{
      tempFilename: '100-200-part_a.psm', filename: 'part_a.psm', category: 'footprint', mfgPartNumber: 'PART',
    }] } }, res);
    expect(res.json.mock.calls[0][0].results[0].error).toContain('ECO approval');
    expect((await database.query('SELECT * FROM cad_files')).rowCount).toBe(0);
    expect(await linkedNames()).toEqual([]);
    expect(disk.unlinkSync).not.toHaveBeenCalled();
  });

  it('allows new-part links, unlinked ECO registration and the admin exception', async () => {
    vi.stubEnv('CONFIG_ECO', 'true');
    const linked = await finalizeExisting();
    expect(linked).toMatchObject({ filename: 'part_a.psm', linked: true });
    expect(await linkedNames()).toEqual(['part_a.psm']);
    expect((await database.query('SELECT pcb_footprint FROM components')).rows[0].pcb_footprint).toBe('part_a');
    await database.query('DELETE FROM component_cad_files');
    await database.query("UPDATE components SET approval_status = 'production'");
    expect((await finalizeExisting('lab', { componentId: undefined, mfgPartNumber: undefined })).error).toBeUndefined();
    expect(await linkedNames()).toEqual([]);
    expect((await finalizeExisting('admin')).error).toBeUndefined();
    expect(await linkedNames()).toEqual(['part_a.psm']);
  });

  it('rolls back registration and junction writes when TEXT regeneration fails', async () => {
    await database.query('ALTER TABLE components ADD CONSTRAINT upload_text_failure CHECK (pcb_footprint IS NULL)');
    try {
      const result = await finalizeExisting();
      expect(result.error).toContain('retained for retry');
      expect((await database.query('SELECT * FROM cad_files')).rowCount).toBe(0);
      expect(await linkedNames()).toEqual([]);
      expect(disk.unlinkSync).not.toHaveBeenCalled();
    } finally {
      await database.query('ALTER TABLE components DROP CONSTRAINT upload_text_failure');
    }
  });

  it('rejects ambiguous MPNs but honors the selected component ID', async () => {
    await database.query("INSERT INTO components (id, manufacturer_pn, approval_status) VALUES ($1, 'PART', 'new')", [id(101)]);
    const ambiguous = await finalizeExisting('lab', { componentId: undefined, mfgPartNumber: 'PART' });
    expect(ambiguous.error).toContain('ambiguous');
    expect(await linkedNames()).toEqual([]);
    const exact = await finalizeExisting();
    expect(exact.error).toBeUndefined();
    expect((await database.query('SELECT component_id FROM component_cad_files')).rows).toEqual([{ component_id: componentId }]);
  });

  it('rechecks a component status change committed while finalization waits for its lock', async () => {
    vi.stubEnv('CONFIG_ECO', 'true');
    const writer = await database.connect();
    let upload;
    try {
      await writer.query('BEGIN');
      await writer.query("UPDATE components SET approval_status = 'reviewing' WHERE id = $1", [componentId]);
      upload = finalizeExisting();
      let blocked = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        const waiting = await database.query(`SELECT 1 FROM pg_stat_activity
          WHERE pid <> pg_backend_pid() AND wait_event_type = 'Lock'
          AND query LIKE '%SELECT id, approval_status FROM components%FOR UPDATE%'`);
        if (waiting.rowCount) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true);
      await writer.query('COMMIT');
      expect((await upload).error).toContain('ECO approval');
      expect(await linkedNames()).toEqual([]);
      expect(disk.unlinkSync).not.toHaveBeenCalled();
    } finally {
      await writer.query('ROLLBACK');
      writer.release();
      await upload;
    }
  });

  it.each(['lab', 'read-write', 'approver'])('blocks legacy shared rename by %s even when the supplied MPN is new', async role => {
    vi.stubEnv('CONFIG_ECO', 'true');
    disk.existsSync.mockImplementation(filename => !String(filename).endsWith('next.psm'));
    const fileId = await addFile(1, 'part_a.psm', 'footprint');
    await link(fileId);
    await database.query("INSERT INTO components (id, manufacturer_pn, approval_status) VALUES ($1, 'CONTROLLED', 'production')", [id(101)]);
    await database.query('INSERT INTO component_cad_files (component_id, cad_file_id) VALUES ($1, $2)', [id(101), fileId]);
    const res = response();
    await renameFile({ user: { role }, body: { category: 'footprint', mfgPartNumber: 'PART', oldFilename: 'part_a.psm', newFilename: 'next.psm' } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect((await database.query('SELECT file_name FROM cad_files')).rows[0].file_name).toBe('part_a.psm');
    expect(disk.renameSync).not.toHaveBeenCalled();
  });

  it.each(['new', 'production'])('retains the admin legacy rename exception for %s consumers', async status => {
    vi.stubEnv('CONFIG_ECO', 'true');
    disk.existsSync.mockImplementation(filename => !String(filename).endsWith('next.psm'));
    await link(await addFile(1, 'part_a.psm', 'footprint'));
    await database.query('UPDATE components SET approval_status = $1', [status]);
    const res = response();
    await renameFile({ user: { role: 'admin' }, body: { category: 'footprint', mfgPartNumber: 'PART', oldFilename: 'part_a.psm', newFilename: 'next.psm' } }, res);
    expect(res.status).not.toHaveBeenCalled();
    expect((await database.query('SELECT pcb_footprint FROM components')).rows[0].pcb_footprint).toBe('next');
    expect(disk.renameSync).toHaveBeenCalledTimes(1);
  });
});
