import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockReq, mockRes, sqlDispatch } from './fixtures/controllerTestKit.js';

/**
 * Audit / atomicity regressions (§V7, §V8, §R9).
 *
 * Before this suite, create and update swallowed a failed `logActivity` in a
 * catch clause whose binding shadowed the imported `logError`, so the handler
 * threw a TypeError instead of logging - and create could persist a component
 * row while skipping its inventory and CAD junction writes. Reverting either
 * fix fails a case here.
 */

const queryMock = vi.fn();
const releaseMock = vi.fn();

vi.mock('../config/database.js', () => ({
  default: {
    query: (...args) => queryMock(...args),
    connect: vi.fn(async () => ({
      query: (...args) => queryMock(...args),
      release: releaseMock,
    })),
  },
}));

vi.mock('../services/digikeyService.js', () => ({}));
vi.mock('../services/mouserService.js', () => ({}));

const syncCadFilesMock = vi.hoisted(() => vi.fn());
vi.mock('../services/cadFileService.js', () => ({
  default: { syncComponentCadFiles: (...args) => syncCadFilesMock(...args) },
}));
vi.mock('../services/specificationService.js', () => ({
  getComponentCategoryId: vi.fn(),
  syncCategorySpecification: vi.fn(),
}));

const { createComponent, updateComponent } = await import('../controllers/componentController.js');

const createdRow = () => ({
  id: 'comp-1',
  category_id: 'cat-1',
  part_number: 'RES-00042',
  manufacturer_pn: 'RC0402FR-0710KL',
  description: '10k resistor',
  pcb_footprint: 'res0402',
  schematic: '',
  step_model: '',
  pspice: '',
  pad_file: '',
  approval_status: 'new',
});

const joinedRow = () => ({ ...createdRow(), category_name: 'Resistors' });

const createBody = {
  category_id: 'cat-1',
  part_number: 'RES-00042',
  description: '10k resistor',
  pcb_footprint: ['res0402'],
};

const createRoutes = (overrides = {}) => [
  ['INSERT INTO components', overrides.component ?? { rows: [createdRow()] }],
  ['SELECT name FROM component_categories', { rows: [{ name: 'Resistors' }] }],
  ['INSERT INTO activity_log', overrides.activity ?? { rows: [] }],
  ['INSERT INTO inventory', overrides.inventory ?? { rows: [] }],
  ['LEFT JOIN component_categories cat', { rows: [joinedRow()] }],
];

const reject = (message) => () => { throw new Error(message); };

const txnCommands = () => queryMock.mock.calls
  .map(([sql]) => sql)
  .filter((sql) => sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK');

describe('createComponent atomicity (V7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syncCadFilesMock.mockResolvedValue(undefined);
  });

  it('commits once and returns 201 when every write succeeds', async () => {
    queryMock.mockImplementation(sqlDispatch(createRoutes()));
    const res = mockRes();
    const next = vi.fn();

    await createComponent(mockReq({ body: createBody }), res, next);

    expect(txnCommands()).toEqual(['BEGIN', 'COMMIT']);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it('rolls back and never answers 201 when the required audit row is rejected', async () => {
    queryMock.mockImplementation(sqlDispatch(createRoutes({ activity: reject('activity_log rejected') })));
    const res = mockRes();
    const next = vi.fn();

    await createComponent(mockReq({ body: createBody }), res, next);

    expect(txnCommands()).toEqual(['BEGIN', 'ROLLBACK']);
    expect(res.status).not.toHaveBeenCalledWith(201);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'activity_log rejected' }));
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it('rolls back when the inventory row cannot be created', async () => {
    queryMock.mockImplementation(sqlDispatch(createRoutes({ inventory: reject('inventory rejected') })));
    const res = mockRes();
    const next = vi.fn();

    await createComponent(mockReq({ body: createBody }), res, next);

    expect(txnCommands()).toEqual(['BEGIN', 'ROLLBACK']);
    expect(res.status).not.toHaveBeenCalledWith(201);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'inventory rejected' }));
  });

  it('rolls back when the CAD sync fails, so no component survives without its junction rows', async () => {
    queryMock.mockImplementation(sqlDispatch(createRoutes()));
    syncCadFilesMock.mockRejectedValue(new Error('cad sync rejected'));
    const res = mockRes();
    const next = vi.fn();

    await createComponent(mockReq({ body: createBody }), res, next);

    expect(txnCommands()).toEqual(['BEGIN', 'ROLLBACK']);
    expect(res.status).not.toHaveBeenCalledWith(201);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'cad sync rejected' }));
  });

  it('runs the audit, inventory and CAD writes on the transaction client', async () => {
    queryMock.mockImplementation(sqlDispatch(createRoutes()));

    await createComponent(mockReq({ body: createBody }), mockRes(), vi.fn());

    expect(syncCadFilesMock).toHaveBeenCalledWith(
      'comp-1',
      expect.any(Object),
      expect.objectContaining({ query: expect.any(Function), release: releaseMock }),
      expect.objectContaining({ allowFootprintAutoLink: true }),
    );
  });
});

describe('updateComponent atomicity (V8)', () => {
  const updateRoutes = (overrides = {}) => [
    ['SELECT id FROM components WHERE id = $1', { rows: [{ id: 'comp-1' }] }],
    ['UPDATE components SET', { rows: [createdRow()] }],
    ['SELECT name FROM component_categories', { rows: [{ name: 'Resistors' }] }],
    ['INSERT INTO activity_log', overrides.activity ?? { rows: [] }],
    ['LEFT JOIN component_categories cat', { rows: [joinedRow()] }],
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    syncCadFilesMock.mockResolvedValue(undefined);
  });

  it('rolls back the TEXT update when the CAD sync fails', async () => {
    queryMock.mockImplementation(sqlDispatch(updateRoutes()));
    syncCadFilesMock.mockRejectedValue(new Error('cad sync rejected'));
    const res = mockRes();
    const next = vi.fn();

    await updateComponent(mockReq({ params: { id: 'comp-1' }, body: { description: 'x' } }), res, next);

    expect(txnCommands()).toEqual(['BEGIN', 'ROLLBACK']);
    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'cad sync rejected' }));
  });

  it('still returns the committed component when the optional audit row is rejected', async () => {
    queryMock.mockImplementation(sqlDispatch(updateRoutes({ activity: reject('activity_log rejected') })));
    const res = mockRes();
    const next = vi.fn();

    await updateComponent(mockReq({ params: { id: 'comp-1' }, body: { description: 'x' } }), res, next);

    expect(txnCommands()).toEqual(['BEGIN', 'COMMIT']);
    expect(syncCadFilesMock).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 'comp-1' }));
    expect(next).not.toHaveBeenCalled();
  });
});
