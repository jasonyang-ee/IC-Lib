import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockReq, mockRes } from './fixtures/controllerTestKit.js';

const state = vi.hoisted(() => ({ tempDir: '', failWrite: null, failUnlink: null, descriptors: new Map() }));
// Keep archive parsing and disk I/O real, but redirect library/temp into scratch.
vi.mock('fs', async () => {
  const actual = await vi.importActual('node:fs');
  const target = (name) => String(name).replace(/^.*[\\/]library[\\/]temp(?=[\\/]|$)/, state.tempDir);
  return { default: {
    ...actual,
    existsSync: (name) => actual.existsSync(target(name)),
    mkdirSync: (name, options) => actual.mkdirSync(target(name), options),
    statSync: (name) => actual.statSync(target(name)),
    chmodSync: (name, mode) => actual.chmodSync(target(name), mode),
    utimesSync: (name, ...args) => actual.utimesSync(target(name), ...args),
    openSync: (name, flags) => {
      const descriptor = actual.openSync(target(name), flags);
      state.descriptors.set(descriptor, String(name));
      return descriptor;
    },
    writeFileSync: (name, ...args) => {
      const filename = typeof name === 'number' ? state.descriptors.get(name) : String(name);
      if (state.failWrite && filename.includes(state.failWrite)) {
        actual.writeFileSync(name, 'partial');
        throw new Error('Injected disk failure');
      }
      return actual.writeFileSync(typeof name === 'number' ? name : target(name), ...args);
    },
    unlinkSync: (name) => {
      if (state.failUnlink && String(name).endsWith(state.failUnlink)) throw new Error('Injected cleanup failure');
      return actual.unlinkSync(target(name));
    },
  } };
});
vi.mock('adm-zip', async () => {
  const { default: ActualZip } = await vi.importActual('adm-zip');
  const { default: redirectedFs } = await import('fs');
  return { default: class extends ActualZip {
    constructor(input, options) {
      super(input, { ...options, fs: redirectedFs });
    }
  } };
});
vi.mock('../services/packageService.js', () => ({ listPackages: vi.fn(async () => []) }));
vi.mock('../constants/cadArchiveLimits.js', () => ({ MAX_CAD_ARCHIVE_BYTES: 1024, MAX_CAD_ARCHIVE_ENTRIES: 4 }));

const { uploadTempFile } = await import('../controllers/fileUploadController.js');
let scratch;

function archive(entries, mutate) {
  const zip = new AdmZip();
  for (const [name, contents] of entries) zip.addFile(name, Buffer.from(contents));
  const data = zip.toBuffer();
  if (mutate) mutate(data);
  const archivePath = path.join(scratch, 'upload.zip');
  fs.writeFileSync(archivePath, data);
  return { originalname: 'upload.zip', path: archivePath };
}

async function uploadArchive(file) {
  const res = mockRes();
  await uploadTempFile(mockReq({ files: [file] }), res);
  return res.json.mock.calls[0][0].results[0];
}

describe('CAD archive bounds and recovery with real ZIP bytes', () => {
  beforeEach(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'iclib-zip-'));
    state.tempDir = path.join(scratch, 'temp');
    fs.mkdirSync(state.tempDir);
    state.failWrite = null;
    state.failUnlink = null;
    state.descriptors.clear();
  });
  afterEach(() => {
    if (path.dirname(path.resolve(scratch)) !== path.resolve(os.tmpdir()) || !path.basename(scratch).startsWith('iclib-zip-')) {
      throw new Error('Refusing to remove a directory outside the scratch fixture');
    }
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  it('stages flattened canonical names, deduplicates, skips nested archives and preserves bytes', async () => {
    const file = archive([['vendor/a.PSM', 'footprint'], ['duplicate/a.psm', 'footprint'], ['vendor/p.PAD', 'pad'], ['nested.zip', 'not extracted']]);
    const result = await uploadArchive(file);
    expect(result.filesExtracted).toBe(2);
    expect(result.extracted.map(entry => entry.filename)).toEqual(['a.psm', 'p.pad']);
    expect(fs.readFileSync(path.join(state.tempDir, result.extracted[0].tempFilename), 'utf8')).toBe('footprint');
    expect(fs.existsSync(file.path)).toBe(false);
  });

  it.each([
    ['expanded bytes', [['a.psm', 'a'.repeat(600)], ['b.pad', 'b'.repeat(600)]]],
    ['entry count', Array.from({ length: 5 }, (_, i) => [`${i}.pad`, 'x'])],
  ])('rejects excess %s before publishing files', async (_label, entries) => {
    const file = archive(entries);
    const result = await uploadArchive(file);
    expect(result.error).toMatch(/limit/i);
    expect(fs.readdirSync(state.tempDir)).toEqual([]);
    expect(fs.existsSync(file.path)).toBe(false);
  });

  it.each([0, 1, 2147483647])('rejects a forged expanded size of %i without publishing truncated data', async (size) => {
    const file = archive([['a.psm', 'payload'.repeat(50)]], data => {
      const central = data.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
      data.writeUInt32LE(size, central + 24);
    });
    const result = await uploadArchive(file);
    expect(result.error).toBeTruthy();
    expect(fs.readdirSync(state.tempDir)).toEqual([]);
  });

  it('removes earlier extracted files when a later entry has a bad checksum', async () => {
    const file = archive([['a.psm', 'first'], ['z.pad', 'last']], data => {
      const first = data.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
      const last = data.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), first + 4);
      const local = data.readUInt32LE(last + 42);
      data.writeUInt32LE(123, last + 16);
      data.writeUInt32LE(123, local + 14);
    });
    const result = await uploadArchive(file);
    expect(result.error).toBeTruthy();
    expect(fs.readdirSync(state.tempDir)).toEqual([]);
    expect(fs.existsSync(file.path)).toBe(false);
  });

  it('rejects a malformed archive and removes the uploaded archive', async () => {
    const file = archive([]);
    fs.writeFileSync(file.path, 'invalid ZIP');
    const result = await uploadArchive(file);
    expect(result.error).toBeTruthy();
    expect(fs.existsSync(file.path)).toBe(false);
    expect(fs.readdirSync(state.tempDir)).toEqual([]);
  });

  it('accepts the expanded-byte boundary and empty stored entries', async () => {
    const result = await uploadArchive(archive([['a.psm', 'x'.repeat(1024)], ['empty.pad', '']]));
    expect(result.filesExtracted).toBe(2);
    expect(fs.statSync(path.join(state.tempDir, result.extracted[0].tempFilename)).size).toBe(1024);
    expect(fs.statSync(path.join(state.tempDir, result.extracted[1].tempFilename)).size).toBe(0);
  });

  it('reads data-descriptor entries using the authoritative central size and checksum', async () => {
    const file = archive([['a.psm', 'payload']], data => {
      const central = data.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
      const local = data.readUInt32LE(central + 42);
      data.writeUInt16LE(data.readUInt16LE(central + 8) | 8, central + 8);
      data.writeUInt16LE(data.readUInt16LE(local + 6) | 8, local + 6);
      data.fill(0, local + 14, local + 26);
    });
    const result = await uploadArchive(file);
    expect(result.filesExtracted).toBe(1);
    expect(fs.readFileSync(path.join(state.tempDir, result.extracted[0].tempFilename), 'utf8')).toBe('payload');
  });

  it('cleans both earlier output and a partially written entry after disk failure', async () => {
    state.failWrite = 'z.pad';
    const result = await uploadArchive(archive([['a.psm', 'first'], ['z.pad', 'last']]));
    expect(result.error).toBeTruthy();
    expect(fs.readdirSync(state.tempDir)).toEqual([]);
  });

  it('reports cleanup failure and continues processing other files in the upload', async () => {
    state.failWrite = 'z.pad';
    state.failUnlink = 'a.psm';
    const file = archive([['a.psm', 'first'], ['z.pad', 'last']]);
    const regular = path.join(state.tempDir, 'regular.pad');
    fs.writeFileSync(regular, 'retained');
    const res = mockRes();
    await uploadTempFile(mockReq({ files: [file, { originalname: 'regular.pad', path: regular }] }), res);
    const { results } = res.json.mock.calls[0][0];
    expect(results[0].error).toMatch(/cleanup incomplete/);
    expect(results[1]).toMatchObject({ filename: 'regular.pad', tempFilename: 'regular.pad' });
    expect(fs.readFileSync(regular, 'utf8')).toBe('retained');
    expect(fs.readdirSync(state.tempDir).filter(name => name.endsWith('a.psm'))).toHaveLength(1);
  });
});
