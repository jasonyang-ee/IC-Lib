import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockReq, mockRes, sqlDispatch, asClient } from './fixtures/controllerTestKit.js';

// §V15/§V59: a controlled component's alternative-class default changes
// through an ordinary ECO field change under the existing `spec` pipeline tag
// - no new tag, no new staging path. eco_changes stores values as text, so a
// cleared class arrives as '' and must reach the column as NULL; an
// out-of-domain letter must be rejected while the ECO is written rather than
// blowing up against the DB CHECK at apply time.

const poolMocks = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
}));

vi.mock('../config/database.js', () => ({
  default: {
    query: (...args) => poolMocks.query(...args),
    connect: (...args) => poolMocks.connect(...args),
  },
}));

vi.mock('../services/emailService.js', () => ({
  sendApprovedECODocumentControlNotification: vi.fn(),
  sendECONotification: vi.fn(() => Promise.resolve()),
}));
vi.mock('../services/ecoPdfService.js', () => ({
  generateECOPdf: vi.fn(),
  generateECOPdfBuffer: vi.fn(),
}));
vi.mock('../services/cadFileService.js', () => ({
  default: {},
  autoLinkRelatedCadFilesForComponent: vi.fn(),
  regenerateCadText: vi.fn(),
  syncFootprintRelatedCadFilesForComponent: vi.fn(),
}));

const { createECO } = await import('../controllers/ecoController.js');
const { VALID_COMPONENT_FIELDS } = await import('../constants/ecoFields.js');
const { detectEcoPipelineTypes } = await import('../services/ecoPipelineService.js');

// The DB conversation createECO holds before it reaches the change inserts.
const createEcoRoutes = () => [
  ['SELECT category_id, approval_status FROM components', { rows: [{ category_id: 'cat-1', approval_status: 'prototype' }] }],
  ['SELECT * FROM eco_settings', { rows: [{ id: 'set-1', prefix: 'ECO-', next_number: 7, leading_zeros: 1 }] }],
  ['UPDATE eco_settings', { rows: [] }],
  ['FROM eco_approval_stages', { rows: [{ stage_order: 1, pipeline_types: ['spec'] }] }],
  ['INSERT INTO eco_orders', { rows: [{ id: 'eco-1', eco_number: 'ECO-0007', component_id: 'comp-1' }] }],
  ['INSERT INTO eco_changes', { rows: [] }],
  ['INSERT INTO activity_log', { rows: [] }],
  ['FROM eco_orders', { rows: [{ id: 'eco-1' }] }],
];

const runCreate = async (changes) => {
  const query = sqlDispatch(createEcoRoutes(), { fallback: { rows: [] } });
  poolMocks.connect.mockResolvedValue(asClient(query));
  poolMocks.query.mockResolvedValue({ rows: [{ id: 'eco-1' }] });

  const res = mockRes();
  await createECO(
    mockReq({ body: { component_id: 'comp-1', part_number: 'IC-00001', changes } }),
    res,
  );
  return { query, res };
};

const changeInserts = (query) => query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO eco_changes'));

beforeEach(() => vi.clearAllMocks());

describe('alt_class as an ECO field (§V15/§V59)', () => {
  it('is a whitelisted component field', () => {
    expect(VALID_COMPONENT_FIELDS).toContain('alt_class');
  });

  it('routes a class change through the existing spec tag, adding no new one', () => {
    // Compared against an established spec field: a controlled part always
    // carries its lifecycle tag, so the meaningful claim is that alt_class
    // contributes exactly what description contributes and nothing more.
    const classTypes = detectEcoPipelineTypes({
      changes: [{ field_name: 'alt_class', old_value: 'C', new_value: 'A' }],
      currentApprovalStatus: 'prototype',
    });
    const descriptionTypes = detectEcoPipelineTypes({
      changes: [{ field_name: 'description', old_value: 'old', new_value: 'new' }],
      currentApprovalStatus: 'prototype',
    });

    expect(classTypes).toContain('spec');
    expect(classTypes).toEqual(descriptionTypes);
  });
});

describe('createECO alternative-class staging (§V59)', () => {
  it('stages a C -> A change', async () => {
    const { query, res } = await runCreate([
      { field_name: 'alt_class', old_value: 'C', new_value: 'A' },
    ]);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(changeInserts(query)).toHaveLength(1);
    expect(changeInserts(query)[0][1]).toEqual(['eco-1', 'alt_class', 'C', 'A']);
  });

  it('stages a clear to unrated', async () => {
    const { query, res } = await runCreate([
      { field_name: 'alt_class', old_value: 'B', new_value: '' },
    ]);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(changeInserts(query)[0][1]).toEqual(['eco-1', 'alt_class', 'B', '']);
  });

  it.each([
    ['old_value', { field_name: 'alt_class', new_value: 'A' }],
    ['new_value', { field_name: 'alt_class', old_value: 'A' }],
  ])('rejects an omitted %s before opening a connection', async (_field, change) => {
    const { query, res } = await runCreate([change]);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'alt_class must be A, B, or C, or null to clear it',
    });
    expect(poolMocks.connect).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects an out-of-domain new value before any change row is written', async () => {
    const { query, res } = await runCreate([
      { field_name: 'alt_class', old_value: 'A', new_value: 'D' },
    ]);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'alt_class must be A, B, or C, or null to clear it',
    });
    expect(poolMocks.connect).not.toHaveBeenCalled();
    expect(changeInserts(query)).toHaveLength(0);
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects an out-of-domain old value before opening a connection', async () => {
    const { query, res } = await runCreate([
      { field_name: 'alt_class', old_value: 'Class A', new_value: 'B' },
    ]);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(poolMocks.connect).not.toHaveBeenCalled();
    expect(changeInserts(query)).toHaveLength(0);
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects non-string values before opening a connection', async () => {
    const { query, res } = await runCreate([
      { field_name: 'alt_class', old_value: 'A', new_value: 1 },
    ]);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(poolMocks.connect).not.toHaveBeenCalled();
    expect(changeInserts(query)).toHaveLength(0);
    expect(query).not.toHaveBeenCalled();
  });
});
