import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { asClient, mockReq, mockRes, sqlDispatch } from './fixtures/controllerTestKit.js';

const queryMock = vi.fn();
const poolMocks = vi.hoisted(() => ({ connect: vi.fn() }));

vi.mock('../config/database.js', () => ({
  default: {
    query: (...args) => queryMock(...args),
    connect: (...args) => poolMocks.connect(...args),
  },
}));
vi.mock('../services/digikeyService.js', () => ({}));
vi.mock('../services/mouserService.js', () => ({}));
vi.mock('../services/cadFileService.js', () => ({ default: {} }));
vi.mock('../services/specificationService.js', () => ({
  getComponentCategoryId: vi.fn(),
  syncCategorySpecification: vi.fn(),
}));

vi.stubEnv('JWT_SECRET', 'test-secret-key-minimum-32-chars-long');

const { bulkDeleteComponents, deleteComponent } = await import('../controllers/componentController.js');
const componentRoutes = (await import('../routes/components.js')).default;

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

const component = (overrides = {}) => ({
  id: ID_A,
  part_number: 'RES-00042',
  description: '10k resistor',
  approval_status: 'new',
  category_name: 'Resistors',
  ...overrides,
});

const deleteRoutes = (rows) => sqlDispatch([
  ['FOR UPDATE', { rows }],
  ['INSERT INTO activity_log', { rows: [] }],
  ['DELETE FROM component_specification_values', { rows: [] }],
  ['DELETE FROM distributor_info', { rows: [] }],
  ['DELETE FROM inventory', { rows: [] }],
  ['DELETE FROM footprint_sources', { rows: [] }],
  ['DELETE FROM components WHERE id = $1', { rows: [] }],
]);

const request = (overrides = {}) => mockReq({
  user: { id: 'user-1', userId: 'user-1', username: 'tester', role: 'read-write' },
  ...overrides,
});

describe('component deletion transaction boundary (F7, V15)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CONFIG_ECO;
    poolMocks.connect.mockImplementation(async () => asClient((...args) => queryMock(...args)));
  });

  afterEach(() => {
    delete process.env.CONFIG_ECO;
  });

  it('keeps the single-delete response while locking, deleting, and auditing in one transaction', async () => {
    queryMock.mockImplementation(deleteRoutes([component()]));
    const res = mockRes();
    const next = vi.fn();

    await deleteComponent(request({ params: { id: ID_A } }), res, next);

    const calls = queryMock.mock.calls.map(([sql]) => sql);
    expect(calls[0]).toBe('BEGIN');
    expect(calls.at(-1)).toBe('COMMIT');
    expect(calls.some(sql => sql.includes('FOR UPDATE'))).toBe(true);
    expect(calls.filter(sql => sql.includes('INSERT INTO activity_log'))).toHaveLength(1);
    expect(calls.filter(sql => sql.includes('DELETE FROM components WHERE id = $1'))).toHaveLength(1);
    expect(res.json).toHaveBeenCalledWith({ message: 'Component deleted successfully' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 from the locked lookup and performs no dependent delete', async () => {
    queryMock.mockImplementation(deleteRoutes([]));
    const res = mockRes();

    await deleteComponent(request({ params: { id: ID_A } }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(queryMock.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
    expect(queryMock.mock.calls.some(([sql]) => sql.includes('DELETE FROM inventory'))).toBe(false);
  });

  it('enforces the ECO policy within the locked single-delete transaction', async () => {
    process.env.CONFIG_ECO = 'true';
    queryMock.mockImplementation(deleteRoutes([component({ approval_status: 'production' })]));
    const res = mockRes();

    await deleteComponent(request({ params: { id: ID_A } }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(queryMock.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
    expect(queryMock.mock.calls.some(([sql]) => sql.includes('DELETE FROM components'))).toBe(false);
  });

  it('rolls back every single-delete write when the required audit fails', async () => {
    queryMock.mockImplementation(sqlDispatch([
      ['FOR UPDATE', { rows: [component()] }],
      ['INSERT INTO activity_log', () => { throw new Error('activity_log rejected'); }],
    ]));
    const next = vi.fn();

    await deleteComponent(request({ params: { id: ID_A } }), mockRes(), next);

    const calls = queryMock.mock.calls.map(([sql]) => sql);
    expect(calls).toContain('ROLLBACK');
    expect(calls).not.toContain('COMMIT');
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('locks every bulk target before deleting and returns the deleted ids', async () => {
    queryMock.mockImplementation(deleteRoutes([
      component({ id: ID_A }),
      component({ id: ID_B, part_number: 'CAP-00007' }),
    ]));
    const res = mockRes();

    await bulkDeleteComponents(request({ body: { component_ids: [ID_B, ID_A] } }), res, vi.fn());

    expect(queryMock.mock.calls.find(([sql]) => sql.includes('FOR UPDATE'))[1]).toEqual([[ID_B, ID_A]]);
    expect(queryMock.mock.calls.filter(([sql]) => sql.includes('INSERT INTO activity_log'))).toHaveLength(2);
    expect(res.json).toHaveBeenCalledWith({ deleted: 2, component_ids: [ID_A, ID_B] });
  });

  it.each([
    ['a missing id', [component({ id: ID_A })]],
    ['a controlled id', [component({ id: ID_A }), component({ id: ID_B, approval_status: 'production' })]],
  ])('rolls back the whole bulk delete when it contains %s', async (label, rows) => {
    if (label === 'a controlled id') process.env.CONFIG_ECO = 'true';
    queryMock.mockImplementation(deleteRoutes(rows));
    const res = mockRes();

    await bulkDeleteComponents(request({ body: { component_ids: [ID_A, ID_B] } }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(label === 'a missing id' ? 404 : 403);
    expect(queryMock.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
    expect(queryMock.mock.calls.some(([sql]) => sql.includes('DELETE FROM components'))).toBe(false);
  });

  it.each([
    ['an empty list', []],
    ['a duplicate id', [ID_A, ID_A]],
    ['a malformed id', ['not-a-uuid']],
    ['an oversized list', Array.from({ length: 101 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`)],
  ])('rejects %s without opening a transaction', async (_label, componentIds) => {
    const res = mockRes();

    await bulkDeleteComponents(request({ body: { component_ids: componentIds } }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(poolMocks.connect).not.toHaveBeenCalled();
  });

  it('mounts bulk delete ahead of /:id with only authenticate and canWrite guards', () => {
    const deleteLayers = componentRoutes.stack.filter(layer => layer.route?.methods?.delete);
    const bulkIndex = deleteLayers.findIndex(layer => layer.route.path === '/bulk');
    const idIndex = deleteLayers.findIndex(layer => layer.route.path === '/:id');

    expect(bulkIndex).toBeGreaterThanOrEqual(0);
    expect(bulkIndex).toBeLessThan(idIndex);
    expect(deleteLayers[bulkIndex].route.stack.map(entry => entry.handle.name))
      .toEqual(['authenticate', 'canWrite', 'bulkDeleteComponents']);
    expect(deleteLayers[idIndex].route.stack.map(entry => entry.handle.name))
      .toEqual(['authenticate', 'canWrite', 'deleteComponent']);
  });
});
