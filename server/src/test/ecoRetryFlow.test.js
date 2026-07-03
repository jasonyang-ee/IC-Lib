import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockReq, mockRes, sqlDispatch, asClient } from './fixtures/controllerTestKit.js';

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
  sendECONotification: vi.fn(),
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

const { getLastRejectedECOByComponent } = await import('../controllers/ecoController.js');

// A rejected ECO that is itself a retry (parent_eco_id set) with one delta of
// every kind, so the endpoint proves the whole change-set reloads (V14).
const REJECTED_ECO = {
  id: 'eco-2',
  eco_number: 'ECO-0007',
  parent_eco_id: 'eco-1',
  status: 'rejected',
  component_id: 'comp-1',
  initiated_by: 'user-1',
  component_part_number: 'RES-00042',
  component_description: '10k resistor',
};

const buildRetryClient = () => asClient(sqlDispatch([
  ["eo.status = 'rejected'", { rows: [REJECTED_ECO] }],
  ['FROM eco_approval_stages', { rows: [] }],
  ['GROUP BY eco_id, stage_id', { rows: [] }],
  ['FROM eco_changes', {
    rows: [{ id: 'chg-1', eco_id: 'eco-2', field_name: 'description', old_value: '10k resistor', new_value: '10k 1% resistor' }],
  }],
  ['FROM eco_specifications', {
    rows: [{ id: 'spec-1', eco_id: 'eco-2', category_spec_id: 'cs-1', spec_name: 'Tolerance', old_value: '5%', new_value: '1%' }],
  }],
  ['FROM eco_approvals ea', {
    rows: [{ id: 'app-1', eco_id: 'eco-2', decision: 'rejected', user_name: 'Approver A', stage_name: 'Engineering' }],
  }],
  ['FROM eco_alternative_parts ea', {
    rows: [{ id: 'alt-1', eco_id: 'eco-2', action: 'add', manufacturer_pn: 'ALT-PN-1', distributors: [] }],
  }],
  ['FROM eco_distributors ed', {
    rows: [{ id: 'dist-1', eco_id: 'eco-2', distributor_id: 'd-1', distributor_name: 'Digikey', action: 'add' }],
  }],
  ['FROM eco_cad_files ecf', {
    rows: [{ id: 'cad-1', eco_id: 'eco-2', action: 'link', cad_file_id: 'cf-1', existing_file_name: 'res0402.psm' }],
  }],
]));

describe('ECO retry from rejected lineage (T4, V14)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reloads the full rejected change-set (field/spec/distributor/alt/CAD) with its lineage', async () => {
    const client = buildRetryClient();
    poolMocks.connect.mockResolvedValue(client);

    const req = mockReq({ params: { componentId: 'comp-1' } });
    const res = mockRes();

    await getLastRejectedECOByComponent(req, res);

    // the rejected-ECO lookup keys on the component and rejected status
    const lookupCall = client.query.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes("eo.status = 'rejected'"));
    expect(lookupCall[1]).toEqual(['comp-1']);
    expect(lookupCall[0]).toContain('ORDER BY eo.id DESC');

    const payload = res.json.mock.calls[0][0];
    // V14: lineage is preserved so the retry stays in the same ECO chain
    expect(payload).toMatchObject({
      id: 'eco-2',
      eco_number: 'ECO-0007',
      parent_eco_id: 'eco-1',
      status: 'rejected',
    });
    // every delta kind rides along for the retry preload
    expect(payload.changes).toEqual([expect.objectContaining({ field_name: 'description', new_value: '10k 1% resistor' })]);
    expect(payload.specifications).toEqual([expect.objectContaining({ spec_name: 'Tolerance', new_value: '1%' })]);
    expect(payload.approvals).toEqual([expect.objectContaining({ decision: 'rejected', stage_name: 'Engineering' })]);
    expect(payload.alternatives).toEqual([expect.objectContaining({ manufacturer_pn: 'ALT-PN-1', action: 'add' })]);
    expect(payload.distributors).toEqual([expect.objectContaining({ distributor_name: 'Digikey' })]);
    expect(payload.cad_files).toEqual([expect.objectContaining({ existing_file_name: 'res0402.psm', action: 'link' })]);

    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('returns null (not 404) when the component has no rejected ECO', async () => {
    const client = asClient(sqlDispatch([
      ["eo.status = 'rejected'", { rows: [] }],
    ]));
    poolMocks.connect.mockResolvedValue(client);

    const res = mockRes();
    await getLastRejectedECOByComponent(mockReq({ params: { componentId: 'comp-9' } }), res);

    expect(res.json).toHaveBeenCalledWith(null);
    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
