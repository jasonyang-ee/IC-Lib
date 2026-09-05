import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { asClient, mockReq, mockRes, sqlDispatch } from './fixtures/controllerTestKit.js';

const queryMock = vi.fn();

// create/update/bulk all run their writes on a pooled client; the same
// dispatch mock backs both handles so assertions see one ordered conversation.
vi.mock('../config/database.js', () => ({
  default: {
    query: (...args) => queryMock(...args),
    connect: vi.fn(async () => asClient((...args) => queryMock(...args))),
  },
}));

vi.mock('../services/digikeyService.js', () => ({}));
vi.mock('../services/mouserService.js', () => ({}));

const cadServiceMocks = vi.hoisted(() => ({
  syncComponentCadFiles: vi.fn(),
  getCadFilesByIds: vi.fn(),
  linkCadFilesToComponentByIds: vi.fn(),
  autoLinkRelatedCadFilesForComponent: vi.fn(),
  regenerateAllCadText: vi.fn(),
  syncFootprintRelatedCadFilesForComponent: vi.fn(),
}));
vi.mock('../services/cadFileService.js', () => ({
  default: {
    syncComponentCadFiles: (...args) => cadServiceMocks.syncComponentCadFiles(...args),
    getCadFilesByIds: (...args) => cadServiceMocks.getCadFilesByIds(...args),
    linkCadFilesToComponentByIds: (...args) => cadServiceMocks.linkCadFilesToComponentByIds(...args),
    autoLinkRelatedCadFilesForComponent: (...args) => cadServiceMocks.autoLinkRelatedCadFilesForComponent(...args),
    regenerateAllCadText: (...args) => cadServiceMocks.regenerateAllCadText(...args),
    syncFootprintRelatedCadFilesForComponent: (...args) => cadServiceMocks.syncFootprintRelatedCadFilesForComponent(...args),
  },
}));
vi.mock('../services/specificationService.js', () => ({
  getComponentCategoryId: vi.fn(),
  syncCategorySpecification: vi.fn(),
}));

// the components router pulls in the auth middleware, which refuses to load
// without a secret
vi.stubEnv('JWT_SECRET', 'test-secret-key-minimum-32-chars-long');

const {
  bulkSetAlternativeClass,
  createComponent,
  updateComponent,
} = await import('../controllers/componentController.js');
const componentRoutes = (await import('../routes/components.js')).default;

const componentRow = (overrides = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  category_id: 'cat-1',
  part_number: 'RES-00042',
  manufacturer_pn: 'RC0402FR-0710KL',
  description: '10k resistor',
  pcb_footprint: '',
  schematic: '',
  step_model: '',
  pspice: '',
  pad_file: '',
  approval_status: 'new',
  alt_class: null,
  ...overrides,
});

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

const sqlOf = (needle) => queryMock.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes(needle));

describe('component alternative class writes (F7.T5, V59, V15)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cadServiceMocks.syncComponentCadFiles.mockResolvedValue(undefined);
    cadServiceMocks.getCadFilesByIds.mockResolvedValue([]);
    cadServiceMocks.linkCadFilesToComponentByIds.mockResolvedValue([]);
    cadServiceMocks.autoLinkRelatedCadFilesForComponent.mockResolvedValue([]);
    cadServiceMocks.regenerateAllCadText.mockResolvedValue(undefined);
    cadServiceMocks.syncFootprintRelatedCadFilesForComponent.mockResolvedValue([]);
    delete process.env.CONFIG_ECO;
  });

  afterEach(() => {
    delete process.env.CONFIG_ECO;
  });

  describe('createComponent', () => {
    const createRoutes = () => sqlDispatch([
      ['INSERT INTO components', { rows: [componentRow()] }],
      ['SELECT name FROM component_categories', { rows: [{ name: 'Resistors' }] }],
      ['INSERT INTO activity_log', { rows: [] }],
      ['INSERT INTO inventory', { rows: [] }],
      ['LEFT JOIN component_categories cat', { rows: [componentRow()] }],
    ]);

    it('stores a canonical class for a lowercase request value', async () => {
      queryMock.mockImplementation(createRoutes());
      const res = mockRes();
      const next = vi.fn();

      await createComponent(mockReq({ body: { category_id: 'cat-1', alt_class: 'b' } }), res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      const [, params] = sqlOf('INSERT INTO components');
      expect(params.at(-1)).toBe('B');
    });

    it('stores null when alt_class is omitted', async () => {
      queryMock.mockImplementation(createRoutes());

      await createComponent(mockReq({ body: { category_id: 'cat-1' } }), mockRes(), vi.fn());

      const [, params] = sqlOf('INSERT INTO components');
      expect(params.at(-1)).toBeNull();
    });

    it('rejects an out-of-domain class before any write', async () => {
      queryMock.mockImplementation(createRoutes());
      const res = mockRes();

      await createComponent(mockReq({ body: { category_id: 'cat-1', alt_class: 'D' } }), res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(queryMock).not.toHaveBeenCalled();
    });
  });

  describe('updateComponent', () => {
    const updateRoutes = () => sqlDispatch([
      ['SELECT id FROM components WHERE id', { rows: [{ id: ID_A }] }],
      ['UPDATE components SET', { rows: [componentRow()] }],
      ['SELECT name FROM component_categories', { rows: [{ name: 'Resistors' }] }],
      ['INSERT INTO activity_log', { rows: [] }],
      ['LEFT JOIN component_categories cat', { rows: [componentRow()] }],
    ]);

    const runUpdate = async (body) => {
      queryMock.mockImplementation(updateRoutes());
      await updateComponent(mockReq({ params: { id: ID_A }, body }), mockRes(), vi.fn());
      const [, params] = sqlOf('UPDATE components SET');
      return { provided: params.at(-2), value: params.at(-1) };
    };

    it('preserves the stored class when alt_class is omitted', async () => {
      expect(await runUpdate({ description: 'x' })).toEqual({ provided: false, value: null });
    });

    it('clears the stored class on an explicit null', async () => {
      expect(await runUpdate({ alt_class: null })).toEqual({ provided: true, value: null });
    });

    it('clears the stored class on a blank string from an emptied control', async () => {
      expect(await runUpdate({ alt_class: '' })).toEqual({ provided: true, value: null });
    });

    it('writes the canonical class on an explicit value', async () => {
      expect(await runUpdate({ alt_class: 'c' })).toEqual({ provided: true, value: 'C' });
    });

    it('rejects an out-of-domain class before any write', async () => {
      queryMock.mockImplementation(updateRoutes());
      const res = mockRes();

      await updateComponent(mockReq({ params: { id: ID_A }, body: { alt_class: 7 } }), res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(queryMock).not.toHaveBeenCalled();
    });
  });

  describe('bulkSetAlternativeClass', () => {
    const bulkRoutes = (rows) => sqlDispatch([
      ['FOR UPDATE', { rows }],
      ['UPDATE components SET alt_class', { rows: [] }],
      ['INSERT INTO activity_log', { rows: [] }],
    ]);

    const bulkReq = (body, role = 'admin') => mockReq({
      body,
      user: { id: 'user-1', userId: 'user-1', username: 'tester', role },
    });

    it('locks, updates, and audits every target in one transaction', async () => {
      queryMock.mockImplementation(bulkRoutes([
        componentRow({ id: ID_A }),
        componentRow({ id: ID_B, part_number: 'CAP-00007' }),
      ]));
      const res = mockRes();
      const next = vi.fn();

      await bulkSetAlternativeClass(bulkReq({ component_ids: [ID_A, ID_B, ID_A], alt_class: 'a' }), res, next);

      expect(next).not.toHaveBeenCalled();
      const calls = queryMock.mock.calls.map(([sql]) => sql);
      expect(calls[0]).toBe('BEGIN');
      expect(calls.at(-1)).toBe('COMMIT');
      expect(calls.filter(sql => sql.includes('INSERT INTO activity_log'))).toHaveLength(2);
      // de-duped before the lock, so a repeated id is not counted twice
      expect(sqlOf('FOR UPDATE')[1]).toEqual([[ID_A, ID_B]]);
      expect(sqlOf('UPDATE components SET alt_class')[1]).toEqual(['A', [ID_A, ID_B]]);
      expect(res.json).toHaveBeenCalledWith({
        updated: 2,
        component_ids: [ID_A, ID_B],
        alt_class: 'A',
      });
    });

    it('clears the class across the batch on an explicit null', async () => {
      queryMock.mockImplementation(bulkRoutes([componentRow({ id: ID_A })]));

      await bulkSetAlternativeClass(bulkReq({ component_ids: [ID_A], alt_class: null }), mockRes(), vi.fn());

      expect(sqlOf('UPDATE components SET alt_class')[1]).toEqual([null, [ID_A]]);
    });

    it('rejects the whole batch when one id is missing', async () => {
      queryMock.mockImplementation(bulkRoutes([componentRow({ id: ID_A })]));
      const res = mockRes();

      await bulkSetAlternativeClass(bulkReq({ component_ids: [ID_A, ID_B], alt_class: 'A' }), res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(404);
      expect(queryMock.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
      expect(sqlOf('UPDATE components SET alt_class')).toBeUndefined();
    });

    it('rejects a non-admin batch containing a controlled part when ECO is on', async () => {
      process.env.CONFIG_ECO = 'true';
      queryMock.mockImplementation(bulkRoutes([
        componentRow({ id: ID_A }),
        componentRow({ id: ID_B, approval_status: 'production' }),
      ]));
      const res = mockRes();

      await bulkSetAlternativeClass(bulkReq({ component_ids: [ID_A, ID_B], alt_class: 'A' }, 'read-write'), res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json.mock.calls[0][0].component_ids).toEqual([ID_B]);
      expect(sqlOf('UPDATE components SET alt_class')).toBeUndefined();
      expect(sqlOf('INSERT INTO activity_log')).toBeUndefined();
    });

    it('allows a non-admin batch of new parts when ECO is on', async () => {
      process.env.CONFIG_ECO = 'true';
      queryMock.mockImplementation(bulkRoutes([componentRow({ id: ID_A })]));
      const res = mockRes();

      await bulkSetAlternativeClass(bulkReq({ component_ids: [ID_A], alt_class: 'A' }, 'read-write'), res, vi.fn());

      expect(res.json).toHaveBeenCalledWith({ updated: 1, component_ids: [ID_A], alt_class: 'A' });
    });

    it('allows an admin batch of controlled parts when ECO is on', async () => {
      process.env.CONFIG_ECO = 'true';
      queryMock.mockImplementation(bulkRoutes([componentRow({ id: ID_A, approval_status: 'production' })]));
      const res = mockRes();

      await bulkSetAlternativeClass(bulkReq({ component_ids: [ID_A], alt_class: 'A' }), res, vi.fn());

      expect(res.json).toHaveBeenCalledWith({ updated: 1, component_ids: [ID_A], alt_class: 'A' });
    });

    it('allows a non-admin batch of controlled parts when ECO is off', async () => {
      queryMock.mockImplementation(bulkRoutes([componentRow({ id: ID_A, approval_status: 'production' })]));
      const res = mockRes();

      await bulkSetAlternativeClass(bulkReq({ component_ids: [ID_A], alt_class: 'A' }, 'read-write'), res, vi.fn());

      expect(res.json).toHaveBeenCalledWith({ updated: 1, component_ids: [ID_A], alt_class: 'A' });
    });

    it('rolls back the class change when the audit write is rejected', async () => {
      queryMock.mockImplementation(sqlDispatch([
        ['FOR UPDATE', { rows: [componentRow({ id: ID_A })] }],
        ['UPDATE components SET alt_class', { rows: [] }],
        ['INSERT INTO activity_log', () => { throw new Error('activity_log rejected'); }],
      ]));
      const res = mockRes();
      const next = vi.fn();

      await bulkSetAlternativeClass(bulkReq({ component_ids: [ID_A], alt_class: 'A' }), res, next);

      const calls = queryMock.mock.calls.map(([sql]) => sql);
      expect(calls).toContain('ROLLBACK');
      expect(calls).not.toContain('COMMIT');
      expect(res.json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it.each([
      ['an omitted class', { component_ids: [ID_A] }],
      ['an out-of-domain class', { component_ids: [ID_A], alt_class: 'D' }],
      ['an empty id list', { component_ids: [], alt_class: 'A' }],
      ['a non-array id list', { component_ids: ID_A, alt_class: 'A' }],
      ['a malformed id', { component_ids: ['not-a-uuid'], alt_class: 'A' }],
    ])('rejects %s without opening a transaction', async (_label, body) => {
      queryMock.mockImplementation(bulkRoutes([componentRow({ id: ID_A })]));
      const res = mockRes();

      await bulkSetAlternativeClass(bulkReq(body), res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(queryMock).not.toHaveBeenCalled();
    });
  });

  it('mounts the bulk route behind authenticate + canWrite, ahead of PUT /:id', () => {
    const putLayers = componentRoutes.stack.filter(layer => layer.route?.methods?.put);
    const bulkIndex = putLayers.findIndex(layer => layer.route.path === '/bulk/alternative-class');
    const idIndex = putLayers.findIndex(layer => layer.route.path === '/:id');

    expect(bulkIndex).toBeGreaterThanOrEqual(0);
    expect(bulkIndex).toBeLessThan(idIndex);
    expect(putLayers[bulkIndex].route.stack.map(entry => entry.handle.name))
      .toEqual(['authenticate', 'canWrite', 'bulkSetAlternativeClass']);
  });
});
