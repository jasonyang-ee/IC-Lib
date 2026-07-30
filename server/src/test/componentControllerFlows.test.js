import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asClient, mockReq, mockRes, sqlDispatch } from './fixtures/controllerTestKit.js';

const queryMock = vi.fn();

// create/update run their writes on a pooled client; the same dispatch mock
// backs both handles so assertions still see one ordered conversation.
vi.mock('../config/database.js', () => ({
  default: {
    query: (...args) => queryMock(...args),
    connect: vi.fn(async () => asClient((...args) => queryMock(...args))),
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

// factories: transformCadFields mutates rows in place, so every test needs
// its own copies
const createdRow = () => ({
  id: 'comp-1',
  category_id: 'cat-1',
  part_number: 'RES-00042',
  manufacturer_id: 'mfr-1',
  manufacturer_pn: 'RC0402FR-0710KL',
  description: '10k resistor',
  pcb_footprint: 'res0402',
  schematic: '',
  step_model: '',
  pspice: '',
  pad_file: '',
  approval_status: 'new',
});

const joinedRow = () => ({
  ...createdRow(),
  category_name: 'Resistors',
  category_prefix: 'RES',
  manufacturer_name: 'YAGEO',
  part_type: 'RES/THICK FILM',
  created_at: '2026-07-02T00:00:00.000Z',
});

describe('componentController create/update flows (T4, V7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('create writes the component, an activity_log row, and an inventory row, then returns the joined payload', async () => {
    queryMock.mockImplementation(sqlDispatch([
      ['INSERT INTO components', { rows: [createdRow()] }],
      ['SELECT name FROM component_categories', { rows: [{ name: 'Resistors' }] }],
      ['INSERT INTO activity_log', { rows: [] }],
      ['INSERT INTO inventory', { rows: [] }],
      ['LEFT JOIN component_categories cat', { rows: [joinedRow()] }],
    ]));

    const req = mockReq({
      body: {
        category_id: 'cat-1',
        part_number: 'RES-00042',
        manufacturer_id: 'mfr-1',
        manufacturer_part_number: 'RC0402FR-0710KL',
        description: '10k resistor',
        pcb_footprint: ['res0402'],
      },
    });
    const res = mockRes();
    const next = vi.fn();

    await createComponent(req, res, next);

    // V7: inventory row exists (backup insert is idempotent)
    const inventoryCall = queryMock.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO inventory'));
    expect(inventoryCall[0]).toContain('ON CONFLICT (component_id) DO NOTHING');
    expect(inventoryCall[1]).toEqual(['comp-1']);

    // V7: activity_log row exists with type 'added'
    const activityCall = queryMock.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO activity_log'));
    expect(activityCall[1][0]).toBe('comp-1');
    expect(activityCall[1][1]).toBe('user-1');
    expect(activityCall[1][2]).toBe('RES-00042');
    expect(activityCall[1][3]).toBe('added');

    // CAD TEXT fields sync through the service (V8 funnel)
    expect(syncCadFilesMock).toHaveBeenCalledWith('comp-1', expect.objectContaining({
      pcb_footprint: ['res0402'],
    }), expect.anything(), expect.anything());

    // V7: joined payload includes category/manufacturer/part_type/created_at
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      id: 'comp-1',
      category_name: 'Resistors',
      manufacturer_name: 'YAGEO',
      part_type: 'RES/THICK FILM',
      created_at: '2026-07-02T00:00:00.000Z',
      pcb_footprint: ['res0402'],
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('create rejects a missing category with 400 before touching the DB', async () => {
    queryMock.mockImplementation(sqlDispatch([]));
    const res = mockRes();

    await createComponent(mockReq({ body: { part_number: 'RES-00042' } }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'category_id is required' });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('update logs the changed fields and returns the joined payload', async () => {
    const updatedRow = { ...createdRow(), description: '10k 1% resistor' };
    queryMock.mockImplementation(sqlDispatch([
      ['SELECT id FROM components WHERE id = $1', { rows: [{ id: 'comp-1' }] }],
      ['UPDATE components SET', { rows: [updatedRow] }],
      ['SELECT name FROM component_categories', { rows: [{ name: 'Resistors' }] }],
      ['INSERT INTO activity_log', { rows: [] }],
      ['LEFT JOIN component_categories cat', { rows: [{ ...joinedRow(), description: '10k 1% resistor' }] }],
    ]));

    const req = mockReq({
      params: { id: 'comp-1' },
      body: { description: '10k 1% resistor', value: '10k' },
    });
    const res = mockRes();
    const next = vi.fn();

    await updateComponent(req, res, next);

    const activityCall = queryMock.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO activity_log'));
    expect(activityCall[1][3]).toBe('updated');
    expect(JSON.parse(activityCall[1][4]).updated_fields).toEqual(['description', 'value']);

    expect(syncCadFilesMock).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      description: '10k 1% resistor',
      category_name: 'Resistors',
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('update 404s for an unknown component without writing', async () => {
    queryMock.mockImplementation(sqlDispatch([
      ['SELECT id FROM components WHERE id = $1', { rows: [] }],
    ]));
    const res = mockRes();

    await updateComponent(mockReq({ params: { id: 'missing' }, body: {} }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(queryMock.mock.calls.some(([sql]) => typeof sql === 'string' && sql.includes('UPDATE components'))).toBe(false);
  });
});
