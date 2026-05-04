import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('../config/database.js', () => ({
  default: {
    query: (...args) => queryMock(...args),
  },
}));

vi.mock('../services/digikeyService.js', () => ({}));
vi.mock('../services/mouserService.js', () => ({}));
vi.mock('../services/cadFileService.js', () => ({
  default: {},
}));
vi.mock('../services/specificationService.js', () => ({
  getComponentCategoryId: vi.fn(),
  syncCategorySpecification: vi.fn(),
}));

const { createAlternative } = await import('../controllers/componentController.js');

const mockReq = (overrides = {}) => ({
  params: { id: 'component-1' },
  body: {},
  user: { id: 'user-1' },
  ...overrides,
});

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('componentController createAlternative', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a manufacturer by name and skips blank distributor UUIDs from vendor search', async () => {
    queryMock.mockImplementation(async (sql) => {
      if (sql === 'SELECT id FROM manufacturers WHERE LOWER(name) = LOWER($1)') {
        return { rows: [] };
      }

      if (sql === 'INSERT INTO manufacturers (name) VALUES ($1) RETURNING id') {
        return { rows: [{ id: 'manufacturer-1' }] };
      }

      if (sql === 'SELECT part_number FROM components WHERE id = $1') {
        return { rows: [{ part_number: 'RES-00001' }] };
      }

      if (typeof sql === 'string' && sql.includes('INSERT INTO components_alternative')) {
        return {
          rows: [{
            id: 'alternative-1',
            component_id: 'component-1',
            manufacturer_id: 'manufacturer-1',
            manufacturer_pn: 'AC0402FR-0713K3L',
          }],
        };
      }

      if (typeof sql === 'string' && sql.includes('INSERT INTO activity_log')) {
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    const req = mockReq({
      body: {
        manufacturer_id: '',
        manufacturer_name: 'YAGEO',
        manufacturer_pn: 'AC0402FR-0713K3L',
        distributors: [{
          distributor_id: '',
          sku: '603-AC0402FR-0713K3L',
          url: 'https://example.test/mouser',
        }],
      },
    });
    const res = mockRes();
    const next = vi.fn();

    await createAlternative(req, res, next);

    expect(queryMock.mock.calls).toContainEqual([
      'SELECT id FROM manufacturers WHERE LOWER(name) = LOWER($1)',
      ['YAGEO'],
    ]);
    expect(queryMock.mock.calls).toContainEqual([
      'INSERT INTO manufacturers (name) VALUES ($1) RETURNING id',
      ['YAGEO'],
    ]);
    expect(queryMock.mock.calls).toContainEqual([
      expect.stringContaining('INSERT INTO components_alternative'),
      ['component-1', 'manufacturer-1', 'AC0402FR-0713K3L'],
    ]);
    expect(queryMock.mock.calls.some(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO distributor_info'))).toBe(false);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      id: 'alternative-1',
      manufacturer_id: 'manufacturer-1',
    }));
    expect(next).not.toHaveBeenCalled();
  });
});