import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockReq, mockRes } from './fixtures/controllerTestKit.js';

const mocks = vi.hoisted(() => ({
  files: new Map(),
  fs: { existsSync: vi.fn(), mkdirSync: vi.fn(), copyFileSync: vi.fn(), renameSync: vi.fn(), unlinkSync: vi.fn(), constants: { COPYFILE_EXCL: 1 } },
  client: { query: vi.fn(), release: vi.fn() },
  pool: { query: vi.fn(), connect: vi.fn() },
  cad: { registerCadFile: vi.fn(), linkCadFileToComponent: vi.fn() },
  packages: { listPackages: vi.fn() },
}));
vi.mock('fs', () => ({ default: mocks.fs }));
vi.mock('../config/database.js', () => ({ default: mocks.pool }));
vi.mock('../services/cadFileService.js', () => ({ default: mocks.cad }));
vi.mock('../services/packageService.js', () => ({ listPackages: mocks.packages.listPackages }));
const { finalizeTempFile, restoreDeletedFile } = await import('../controllers/fileUploadController.js');
const base = filename => path.basename(String(filename));
const token = '123-456-MyPart.PSM';
const entry = { tempFilename: token, category: 'footprint' };
const finalize = async (files = [entry], options = {}) => {
  const res = mockRes();
  await finalizeTempFile(mockReq({ body: { files, ...options } }), res);
  return res.json.mock.calls[0][0];
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('CONFIG_ECO', 'false');
  mocks.files.clear();
  mocks.files.set(token, 'new bytes');
  mocks.pool.connect.mockResolvedValue(mocks.client);
  mocks.client.query.mockResolvedValue({ rows: [{ id: 'component-1', approval_status: 'new' }] });
  mocks.cad.registerCadFile.mockImplementation(async (file_name, file_type) => ({ id: 'cad-1', file_name, file_type }));
  mocks.cad.linkCadFileToComponent.mockResolvedValue([]);
  mocks.packages.listPackages.mockResolvedValue([{ short_name: 'SOIC', count_policy: 'append', aliases: [{ alias: 'SOIC' }] }]);
  mocks.fs.existsSync.mockImplementation(filename => mocks.files.has(base(filename)));
  mocks.fs.copyFileSync.mockImplementation((source, target) => {
    if (mocks.files.has(base(target))) throw Object.assign(new Error('EEXIST'), { code: 'EEXIST' });
    if (!mocks.files.has(base(source))) throw new Error('ENOENT');
    mocks.files.set(base(target), mocks.files.get(base(source)));
  });
  mocks.fs.renameSync.mockImplementation((source, target) => {
    if (!mocks.files.has(base(source))) throw new Error('ENOENT');
    mocks.files.set(base(target), mocks.files.get(base(source)));
    mocks.files.delete(base(source));
  });
  mocks.fs.unlinkSync.mockImplementation(filename => mocks.files.delete(base(filename)));
});
afterEach(() => vi.unstubAllEnvs());

describe('CAD upload finalization and recovery', () => {
  it('normalizes the filename and registers/links using the same transaction', async () => {
    const result = await finalize([entry], { componentId: 'component-1' });
    expect(result.results).toEqual([expect.objectContaining({ filename: 'mypart.psm', cadFileId: 'cad-1', tempFilename: token })]);
    expect(mocks.files).toEqual(new Map([['mypart.psm', 'new bytes']]));
    expect(mocks.cad.registerCadFile).toHaveBeenCalledWith('mypart.psm', 'footprint', null, mocks.client);
    expect(mocks.cad.linkCadFileToComponent).toHaveBeenCalledWith('cad-1', 'component-1', 'footprint', 'mypart.psm', mocks.client);
  });

  it('canonicalizes vendor package names and supports unlinked new-part/ECO uploads', async () => {
    mocks.files.set('100-200-8-SOIC_N.PSM', 'vendor bytes');
    const result = await finalize([{ ...entry, tempFilename: '100-200-8-SOIC_N.PSM' }]);
    expect(result.results[0]).toMatchObject({ filename: 'soic-8_b.psm', cadFileId: 'cad-1' });
    expect(mocks.cad.linkCadFileToComponent).not.toHaveBeenCalled();
  });

  it('retains an unresolved collision instead of silently discarding the upload', async () => {
    mocks.files.set('mypart.psm', 'original bytes');
    const result = await finalize();
    expect(result.results[0].error).toContain('already exists');
    expect(mocks.files).toEqual(new Map([[token, 'new bytes'], ['mypart.psm', 'original bytes']]));
    expect(mocks.client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('replaces the destination only after explicit overwrite', async () => {
    mocks.files.set('mypart.psm', 'original bytes');
    const result = await finalize([{ ...entry, resolution: 'overwrite' }]);
    expect(result.results[0].error).toBeUndefined();
    expect(mocks.files).toEqual(new Map([['mypart.psm', 'new bytes']]));
  });

  it.each(['move', 'registration', 'link', 'commit'])('preserves both original and uploaded bytes after %s failure during overwrite', async (failure) => {
    mocks.files.set('mypart.psm', 'original bytes');
    if (failure === 'move') mocks.fs.renameSync.mockImplementationOnce(() => { throw new Error('move failed'); });
    if (failure === 'registration') mocks.cad.registerCadFile.mockRejectedValueOnce(new Error('register failed'));
    if (failure === 'link') mocks.cad.linkCadFileToComponent.mockRejectedValueOnce(new Error('link failed'));
    if (failure === 'commit') {mocks.client.query.mockImplementation(async sql => {
      if (sql === 'COMMIT') throw new Error('commit failed');
      return { rows: [{ id: 'component-1', approval_status: 'new' }] };
    });}
    const result = await finalize([{ ...entry, resolution: 'overwrite' }], { componentId: 'component-1' });
    expect(result.results[0].error).toContain('retained for retry');
    expect(mocks.files).toEqual(new Map([[token, 'new bytes'], ['mypart.psm', 'original bytes']]));
    expect(mocks.client.release).toHaveBeenCalled();
  });

  it('reports a failed item, continues the batch, and allows retry of the retained token', async () => {
    mocks.files.set('100-200-next.pad', 'pad bytes');
    mocks.cad.registerCadFile.mockRejectedValueOnce(new Error('registration failed'));
    const result = await finalize([entry, { tempFilename: '100-200-next.pad', category: 'pad' }]);
    expect(result.results[0].error).toContain('retained for retry');
    expect(result.results[1]).toMatchObject({ filename: 'next.pad', cadFileId: 'cad-1' });
    expect(mocks.files).toEqual(new Map([[token, 'new bytes'], ['next.pad', 'pad bytes']]));
    const retry = await finalize();
    expect(retry.results[0].error).toBeUndefined();
    expect(mocks.files).toEqual(new Map([['mypart.psm', 'new bytes'], ['next.pad', 'pad bytes']]));
  });

  it('use_existing requires a real destination and retains the token when linking fails', async () => {
    const missing = await finalize([{ ...entry, resolution: 'use_existing' }]);
    expect(missing.results[0].error).toContain('not found');
    mocks.files.set('mypart.psm', 'original bytes');
    mocks.cad.linkCadFileToComponent.mockRejectedValueOnce(new Error('link failed'));
    const failed = await finalize([{ ...entry, resolution: 'use_existing' }], { mfgPartNumber: 'PART' });
    expect(failed.results[0].error).toContain('retained for retry');
    expect(mocks.files.has(token)).toBe(true);
    const retry = await finalize([{ ...entry, resolution: 'use_existing' }], { mfgPartNumber: 'PART' });
    expect(retry.results[0]).toMatchObject({ linked: true, collision: true });
    expect(mocks.files).toEqual(new Map([['mypart.psm', 'original bytes']]));
  });

  it('does not permit overwrite with ECO enabled, including requests without a component', async () => {
    vi.stubEnv('CONFIG_ECO', 'true');
    mocks.files.set('mypart.psm', 'original bytes');
    const result = await finalize([{ ...entry, resolution: 'overwrite' }]);
    expect(result.results[0].error).toContain('ECO enabled');
    expect(mocks.files.get('mypart.psm')).toBe('original bytes');
    expect(mocks.files.has(token)).toBe(true);
  });

  it.each(['reviewing', 'prototype', 'production', 'archived'])('rejects non-admin writes to a %s component before publishing', async approval_status => {
    vi.stubEnv('CONFIG_ECO', 'true');
    mocks.client.query.mockResolvedValue({ rows: [{ id: 'component-1', approval_status }] });
    const res = mockRes();
    await finalizeTempFile(mockReq({ user: { role: 'lab' }, body: { files: [entry], componentId: 'component-1' } }), res);
    expect(res.json.mock.calls[0][0].results[0].error).toContain('ECO approval');
    expect(mocks.files).toEqual(new Map([[token, 'new bytes']]));
    expect(mocks.cad.registerCadFile).not.toHaveBeenCalled();
  });

  it('restores through the same policy and never accepts overwrite from the restore payload', async () => {
    mocks.files.set('mypart.psm', 'original bytes');
    const res = mockRes();
    await restoreDeletedFile(mockReq({ body: { files: [{ ...entry, filename: 'mypart.psm', resolution: 'overwrite' }] } }), res);
    expect(res.json.mock.calls[0][0].results[0].error).toContain('already exists');
    expect(mocks.files.get('mypart.psm')).toBe('original bytes');
  });

  it('rejects illegal footprint names, invalid categories and path tokens without discarding files', async () => {
    mocks.files.set('100-200-My+Part.psm', 'invalid bytes');
    const result = await finalize([
      { ...entry, tempFilename: '100-200-My+Part.psm' },
      { ...entry, category: 'libraries' },
      { ...entry, tempFilename: '../' + token },
    ]);
    expect(result.results.map(item => item.error)).toEqual([
      expect.stringContaining('not allowed'), 'Invalid CAD category', 'Invalid tempFilename',
    ]);
    expect(mocks.files.size).toBe(2);
  });

  it('reports missing tokens and rejects empty batches', async () => {
    mocks.files.clear();
    expect((await finalize()).results[0].error).toBe('Temp file not found');
    const res = mockRes();
    await finalizeTempFile(mockReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
