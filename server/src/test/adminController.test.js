import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('../config/database.js', () => ({
  default: {
    query: (...args) => queryMock(...args),
    connect: vi.fn(),
  },
}));

const { getDatabaseStats } = await import('../controllers/adminController.js');

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('adminController getDatabaseStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('counts specifications from component_specification_values, not a phantom table (B7)', async () => {
    queryMock.mockImplementation(async (sql) => {
      if (typeof sql === 'string' && sql.includes('total_components')) {
        return { rows: [{ total_components: '3', total_specifications: '9' }] };
      }
      if (typeof sql === 'string' && sql.includes('c.sub_category1')) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    const res = mockRes();
    const next = vi.fn();

    await getDatabaseStats({}, res, next);

    const statsSql = queryMock.mock.calls
      .map(([sql]) => sql)
      .find((sql) => typeof sql === 'string' && sql.includes('total_components'));

    expect(statsSql).toContain('FROM component_specification_values');
    // Guard against regressing to the nonexistent table name.
    expect(statsSql).not.toMatch(/FROM component_specifications\)/);
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      summary: expect.objectContaining({ total_specifications: '9' }),
    }));
  });
});
