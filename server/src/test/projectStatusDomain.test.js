import { beforeEach, describe, expect, it, vi } from 'vitest';

// §V33: projects.status is a closed domain {active, completed, archived},
// rejected at the API boundary (400) and by a DB CHECK constraint; the
// dashboard active-count counts only 'active' (no phantom 'planning').

const queryMock = vi.fn();

vi.mock('../config/database.js', () => ({
  default: { query: (...args) => queryMock(...args) },
}));

vi.mock('../services/activityLogService.js', () => ({
  logActivity: vi.fn(),
}));

const { PROJECT_STATUSES, isValidProjectStatus } = await import('../constants/projectStatus.js');
const { createProject, updateProject } = await import('../controllers/projectController.js');
const { getExtendedDashboardStats } = await import('../controllers/dashboardController.js');

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('project status domain constant (§V33)', () => {
  it('is exactly {active, completed, archived}', () => {
    expect([...PROJECT_STATUSES]).toEqual(['active', 'completed', 'archived']);
  });

  it('accepts domain members and omission, rejects everything else', () => {
    expect(isValidProjectStatus('active')).toBe(true);
    expect(isValidProjectStatus('completed')).toBe(true);
    expect(isValidProjectStatus('archived')).toBe(true);
    expect(isValidProjectStatus(undefined)).toBe(true);
    expect(isValidProjectStatus(null)).toBe(true);
    expect(isValidProjectStatus('planning')).toBe(false);
    expect(isValidProjectStatus('deleted')).toBe(false);
    expect(isValidProjectStatus('')).toBe(false);
  });
});

describe('createProject status boundary (§V33 / B17)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects an out-of-domain status with 400 and never touches the DB', async () => {
    const res = mockRes();
    await createProject({ body: { name: 'X', status: 'planning' }, user: {} }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('inserts when the status is a domain member', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'p1', name: 'X', status: 'completed' }] });
    const res = mockRes();
    await createProject({ body: { name: 'X', status: 'completed' }, user: { id: 'u1' } }, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(queryMock).toHaveBeenCalledOnce();
  });

  it('defaults to active when status is omitted', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'p1', name: 'X', status: 'active' }] });
    const res = mockRes();
    await createProject({ body: { name: 'X' }, user: { id: 'u1' } }, res);

    expect(res.status).toHaveBeenCalledWith(201);
    // The INSERT's third parameter is the defaulted status.
    expect(queryMock.mock.calls[0][1][2]).toBe('active');
  });
});

describe('updateProject status boundary (§V33 / B17)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects an out-of-domain status with 400 and never touches the DB', async () => {
    const res = mockRes();
    await updateProject({ params: { id: 'p1' }, body: { status: 'bogus' }, user: {} }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('updates when status is omitted (no change)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'p1', name: 'New', status: 'active' }] });
    const res = mockRes();
    await updateProject({ params: { id: 'p1' }, body: { name: 'New' }, user: { id: 'u1' } }, res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(queryMock).toHaveBeenCalledOnce();
  });
});

describe('dashboard active-project count (§V33 / B18)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('counts only status = active and never references the phantom planning', async () => {
    queryMock.mockResolvedValue({ rows: [{ count: '0', avg: '0' }] });
    const res = mockRes();
    const next = vi.fn();

    await getExtendedDashboardStats({}, res, next);

    const sql = queryMock.mock.calls.map(call => call[0]).join('\n');
    expect(sql).not.toMatch(/planning/i);
    expect(sql).toMatch(/status = 'active'/);
    expect(next).not.toHaveBeenCalled();
  });
});
