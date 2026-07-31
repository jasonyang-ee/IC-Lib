import { beforeEach, describe, expect, it, vi } from 'vitest';

// §V59/§V17: project_components.alt_class is a nullable per-BOM-line override
// of the parent component default. The API boundary rejects out-of-domain
// values, an omitted override preserves the stored one on update, an explicit
// null clears it, and project detail resolves
// COALESCE(line override, parent default) for direct and alternative lines.

const queryMock = vi.fn();

vi.mock('../config/database.js', () => ({
  default: { query: (...args) => queryMock(...args) },
}));

const logActivityMock = vi.fn();
vi.mock('../services/activityLogService.js', () => ({
  logActivity: (...args) => logActivityMock(...args),
}));

const {
  getProjectById,
  addComponentToProject,
  updateProjectComponent,
} = await import('../controllers/projectController.js');

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const mockReq = (overrides = {}) => ({
  params: {},
  body: {},
  user: { id: 'user-1' },
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());

describe('addComponentToProject alternative-class override (§V59)', () => {
  const addBody = (extra) => ({ component_id: 'c1', quantity: 2, ...extra });

  const stubAddQueries = (storedClass) => {
    queryMock
      // duplicate check
      .mockResolvedValueOnce({ rows: [] })
      // insert
      .mockResolvedValueOnce({ rows: [{ id: 'pc1', component_id: 'c1', alt_class: storedClass }] })
      // project name
      .mockResolvedValueOnce({ rows: [{ name: 'Proj' }] })
      // component info
      .mockResolvedValueOnce({ rows: [{ part_number: 'PN-1', description: 'd' }] });
  };

  it('stores an explicit class on the new line', async () => {
    stubAddQueries('B');
    const res = mockRes();

    await addComponentToProject(
      mockReq({ params: { projectId: 'p1' }, body: addBody({ alt_class: 'b' }) }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    const insertCall = queryMock.mock.calls.find(([sql]) => sql.includes('INSERT INTO project_components'));
    expect(insertCall[1][5]).toBe('B');
  });

  it('stores NULL when the override is omitted so the parent default resolves', async () => {
    stubAddQueries(null);
    const res = mockRes();

    await addComponentToProject(
      mockReq({ params: { projectId: 'p1' }, body: addBody() }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    const insertCall = queryMock.mock.calls.find(([sql]) => sql.includes('INSERT INTO project_components'));
    expect(insertCall[1][5]).toBeNull();
  });

  it('rejects an out-of-domain override with 400 and never touches the DB', async () => {
    const res = mockRes();

    await addComponentToProject(
      mockReq({ params: { projectId: 'p1' }, body: addBody({ alt_class: 'D' }) }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('rejects a non-string override with 400', async () => {
    const res = mockRes();

    await addComponentToProject(
      mockReq({ params: { projectId: 'p1' }, body: addBody({ alt_class: 3 }) }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('records the stored override in the audit details', async () => {
    stubAddQueries('A');
    const res = mockRes();

    await addComponentToProject(
      mockReq({ params: { projectId: 'p1' }, body: addBody({ alt_class: 'A' }) }),
      res,
    );

    expect(logActivityMock.mock.calls[0][1].details.alt_class).toBe('A');
  });
});

describe('updateProjectComponent alternative-class override (§V59)', () => {
  const stubUpdateQueries = (storedClass) => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: 'pc1', component_id: 'c1', quantity: 5, alt_class: storedClass }] })
      .mockResolvedValueOnce({ rows: [{ name: 'Proj' }] });
  };

  const updateParams = { params: { projectId: 'p1', componentId: 'pc1' } };

  const updateCall = () => queryMock.mock.calls.find(([sql]) => sql.includes('UPDATE project_components'));

  it('writes the new class when one is supplied', async () => {
    stubUpdateQueries('C');
    const res = mockRes();

    await updateProjectComponent(mockReq({ ...updateParams, body: { alt_class: 'C' } }), res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    // $5 = provided flag, $6 = value.
    expect(updateCall()[1][4]).toBe(true);
    expect(updateCall()[1][5]).toBe('C');
  });

  it('preserves the stored override when the field is omitted', async () => {
    stubUpdateQueries('A');
    const res = mockRes();

    await updateProjectComponent(mockReq({ ...updateParams, body: { quantity: 5 } }), res);

    expect(updateCall()[1][4]).toBe(false);
  });

  it('clears the override on an explicit null', async () => {
    stubUpdateQueries(null);
    const res = mockRes();

    await updateProjectComponent(mockReq({ ...updateParams, body: { alt_class: null } }), res);

    expect(updateCall()[1][4]).toBe(true);
    expect(updateCall()[1][5]).toBeNull();
  });

  it('clears the override on a blank string from an emptied control', async () => {
    stubUpdateQueries(null);
    const res = mockRes();

    await updateProjectComponent(mockReq({ ...updateParams, body: { alt_class: '' } }), res);

    expect(updateCall()[1][4]).toBe(true);
    expect(updateCall()[1][5]).toBeNull();
  });

  it('rejects an out-of-domain override with 400 and never touches the DB', async () => {
    const res = mockRes();

    await updateProjectComponent(mockReq({ ...updateParams, body: { alt_class: 'Z' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('logs the override only when this request changed it', async () => {
    stubUpdateQueries('B');
    const res = mockRes();

    await updateProjectComponent(mockReq({ ...updateParams, body: { alt_class: 'B' } }), res);
    expect(logActivityMock.mock.calls[0][1].details.alt_class).toBe('B');

    vi.clearAllMocks();
    stubUpdateQueries('B');
    await updateProjectComponent(mockReq({ ...updateParams, body: { quantity: 9 } }), mockRes());
    expect(logActivityMock.mock.calls[0][1].details).not.toHaveProperty('alt_class');
  });
});

describe('project detail class resolution (§V17/§V59)', () => {
  it('returns the raw override, the parent default and the resolved class', async () => {
    const rows = [
      // direct line falling back to the parent default
      { id: 'pc1', type: 'component', alt_class: null, component_alt_class: 'B', resolved_alt_class: 'B' },
      // alternative line overriding its parent
      { id: 'pc2', type: 'alternative', alt_class: 'A', component_alt_class: 'C', resolved_alt_class: 'A' },
      // neither rated: stays NULL, which the client displays as Unrated
      { id: 'pc3', type: 'component', alt_class: null, component_alt_class: null, resolved_alt_class: null },
    ];
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: 'p1', name: 'Proj' }] })
      .mockResolvedValueOnce({ rows });
    const res = mockRes();

    await getProjectById(mockReq({ params: { id: 'p1' } }), res);

    const detailSql = queryMock.mock.calls[1][0];
    expect(detailSql).toContain('pc.alt_class');
    expect(detailSql).toContain('base_component.alt_class as component_alt_class');
    expect(detailSql).toContain('COALESCE(pc.alt_class, base_component.alt_class) as resolved_alt_class');
    expect(res.json.mock.calls[0][0].components).toEqual(rows);
  });
});
