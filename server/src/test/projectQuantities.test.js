import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, connect, logActivity } = vi.hoisted(() => ({
  query: vi.fn(), connect: vi.fn(), logActivity: vi.fn(),
}));
vi.mock('../config/database.js', () => ({ default: { query, connect } }));
vi.mock('../services/activityLogService.js', () => ({ logActivity }));
vi.mock('../utils/logger.js', () => ({ logError: vi.fn() }));

import { addComponentToProject, updateProjectComponent, consumeProjectComponents } from '../controllers/projectController.js';

const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });
const request = (body = {}) => ({
  params: { id: 'p1', projectId: 'p1', componentId: 'pc1' },
  body, user: { id: 'u1' },
});

beforeEach(() => vi.resetAllMocks());

describe.each([
  ['add', addComponentToProject], ['update', updateProjectComponent],
])('%s quantity validation', (_name, handler) => {
  it.each([-1, 0, 1.5, 2147483648, '', 'bad', true, [], {}, null])('rejects invalid quantity %j before database access', async (quantity) => {
    const res = response();
    await handler(request({ component_id: 'c1', quantity }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(query).not.toHaveBeenCalled();
    expect(logActivity).not.toHaveBeenCalled();
  });
});

it.each([1, 2147483647, '2', undefined])('adds a valid quantity %j with an omitted default of one', async (quantity) => {
  const expected = quantity === undefined ? 1 : Number(quantity);
  query.mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{ id: 'pc1', quantity: expected }] })
    .mockResolvedValue({ rows: [{ name: 'Project', part_number: 'PN' }] });
  const res = response();
  await addComponentToProject(request({ component_id: 'c1', quantity }), res);
  expect(res.status).toHaveBeenCalledWith(201);
  expect(query.mock.calls[1][1][3]).toBe(expected);
  expect(logActivity.mock.calls[0][1].details.quantity).toBe(expected);
});

it('preserves quantity on a notes-only update', async () => {
  query.mockResolvedValueOnce({ rows: [{ id: 'pc1', quantity: 3 }] })
    .mockResolvedValue({ rows: [{ name: 'Project' }] });
  const res = response();
  await updateProjectComponent(request({ notes: 'Revised' }), res);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ quantity: 3 }));
  expect(query.mock.calls[0][1][0]).toBeUndefined();
});

it('returns an error response when consuming cannot acquire a database connection', async () => {
  connect.mockRejectedValue(new Error('connection unavailable'));
  const res = response();
  await expect(consumeProjectComponents(request(), res)).resolves.toBeUndefined();
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json).toHaveBeenCalledWith({ error: 'Failed to consume project components' });
});

it('returns a safe failure and discards the client when rollback fails', async () => {
  const dbError = new Error('private database failure');
  const rollbackError = new Error('connection lost');
  const client = { query: vi.fn(), release: vi.fn() };
  connect.mockResolvedValue(client);
  client.query.mockResolvedValueOnce({ rows: [] })
    .mockRejectedValueOnce(dbError)
    .mockRejectedValueOnce(rollbackError);
  const res = response();
  await expect(consumeProjectComponents(request(), res)).resolves.toBeUndefined();
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json).toHaveBeenCalledWith({ error: 'Failed to consume project components' });
  expect(client.release).toHaveBeenCalledWith(rollbackError);
});
