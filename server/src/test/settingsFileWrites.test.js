import { beforeEach, expect, it, vi } from 'vitest';
const { disk } = vi.hoisted(() => ({ disk: { mkdir: vi.fn(), readFile: vi.fn(), writeFile: vi.fn(), rename: vi.fn(), rm: vi.fn() } }));
vi.mock('fs/promises', () => ({ default: disk }));
vi.mock('../config/database.js', () => ({ default: {} }));
vi.mock('../utils/logger.js', () => ({ logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn() }));
import { updateSettings } from '../controllers/settingsController.js';

let stored;
let staged;
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() });
beforeEach(() => {
  vi.resetAllMocks();
  stored = { partNumberConfigs: { old: { prefix: 'OLD' } }, bomDefaults: { columnIds: ['part_number'] } };
  staged = new Map();
  disk.mkdir.mockResolvedValue();
  disk.readFile.mockImplementation(async () => JSON.stringify(stored));
  disk.writeFile.mockImplementation(async (file, contents) => {
    if (file.endsWith('/settings.json')) throw Object.assign(new Error('exists'), { code: 'EEXIST' });
    staged.set(file, contents);
  });
  disk.rename.mockImplementation(async source => { stored = JSON.parse(staged.get(source)); });
  disk.rm.mockImplementation(async file => { staged.delete(file); });
});

it('preserves independent settings sections when their saves overlap', async () => {
  const first = response();
  const second = response();
  await Promise.all([
    updateSettings({ body: { partNumberConfigs: { fresh: { prefix: 'NEW' } } } }, first),
    updateSettings({ body: { bomDefaults: { columnIds: ['manufacturer_pn'] } } }, second),
  ]);
  expect(stored).toEqual({ partNumberConfigs: { old: { prefix: 'OLD' }, fresh: { prefix: 'NEW' } }, bomDefaults: { columnIds: ['manufacturer_pn'] } });
  expect(first.status).not.toHaveBeenCalled();
  expect(second.status).not.toHaveBeenCalled();
});

it('retains the saved file when publication fails and allows the next save to succeed', async () => {
  disk.rename.mockRejectedValueOnce(new Error('disk failure'));
  const failed = response();
  await updateSettings({ body: { bomDefaults: { columnIds: ['bad'] } } }, failed);
  expect(failed.status).toHaveBeenCalledWith(500);
  expect(stored.bomDefaults.columnIds).toEqual(['part_number']);
  expect(staged.size).toBe(0);
  const retry = response();
  await updateSettings({ body: { bomDefaults: { columnIds: ['good'] } } }, retry);
  expect(retry.status).not.toHaveBeenCalled();
  expect(stored.bomDefaults.columnIds).toEqual(['good']);
});
