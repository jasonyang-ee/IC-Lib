import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  queryMock,
  digikeySearchPartMock,
  mouserSearchPartMock,
} = vi.hoisted(() => ({
  queryMock: vi.fn(),
  digikeySearchPartMock: vi.fn(),
  mouserSearchPartMock: vi.fn(),
}));

vi.mock('../config/database.js', () => ({
  default: {
    query: (...args) => queryMock(...args),
  },
}));

vi.mock('../services/digikeyService.js', () => ({
  searchPart: digikeySearchPartMock,
}));

vi.mock('../services/mouserService.js', () => ({
  searchPart: mouserSearchPartMock,
}));

vi.mock('../services/cadFileService.js', () => ({
  default: {},
}));

vi.mock('../services/specificationService.js', () => ({
  getComponentCategoryId: vi.fn(),
  syncCategorySpecification: vi.fn(),
}));

const { bulkUpdateStock, bulkUpdateSpecifications } = await import('../controllers/componentController.js');

const mockReq = (query = {}) => ({ query });

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('bulk vendor refresh queues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(global, 'setTimeout').mockImplementation((callback) => {
      if (typeof callback === 'function') {
        callback();
      }

      return 0;
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('bulkUpdateStock keeps skipped supported rows moving through last_vendor_sync_at', async () => {
    queryMock.mockImplementation(async (sql) => {
      if (typeof sql === 'string' && sql.includes('FROM distributor_info di')) {
        return {
          rows: [{
            id: 'dist-1',
            sku: 'DK-123',
            distributor_name: 'Digikey',
            part_number: 'RES-00001',
            component_id: 'component-1',
          }],
        };
      }

      if (sql === 'UPDATE distributor_info SET last_vendor_sync_at = CURRENT_TIMESTAMP WHERE id = $1') {
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    digikeySearchPartMock.mockResolvedValue({ results: [] });

    const res = mockRes();
    const next = vi.fn();

    await bulkUpdateStock(mockReq(), res, next);

    expect(queryMock.mock.calls[0][0]).toContain('ORDER BY di.last_vendor_sync_at ASC NULLS FIRST');
    expect(queryMock.mock.calls[0][0]).toContain('LOWER(d.name) = ANY($1::text[])');
    expect(queryMock).toHaveBeenCalledWith(
      'UPDATE distributor_info SET last_vendor_sync_at = CURRENT_TIMESTAMP WHERE id = $1',
      ['dist-1'],
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      updatedCount: 0,
      skippedCount: 1,
      totalChecked: 1,
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('bulkUpdateStock aborts immediately on daily vendor rate limit', async () => {
    queryMock.mockResolvedValue({
      rows: [{
        id: 'dist-2',
        sku: 'MOU-123',
        distributor_name: 'Mouser',
        part_number: 'CAP-00001',
        component_id: 'component-2',
      }],
    });

    const rateLimitError = new Error('RATE_LIMIT_EXCEEDED');
    rateLimitError.vendorMessage = 'Daily rate limit exceeded';
    mouserSearchPartMock.mockRejectedValue(rateLimitError);

    const res = mockRes();
    const next = vi.fn();

    await bulkUpdateStock(mockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('bulkUpdateSpecifications advances last_specs_refresh_at for skipped components', async () => {
    queryMock.mockImplementation(async (sql) => {
      if (typeof sql === 'string' && sql.includes('FROM components c')) {
        return {
          rows: [{
            component_id: 'component-3',
            part_number: 'IC-00001',
            category_id: 'category-1',
            sku: 'DK-IC-1',
            distributor_name: 'Digikey',
            last_specs_refresh_at: null,
          }],
        };
      }

      if (sql === 'UPDATE components SET last_specs_refresh_at = CURRENT_TIMESTAMP WHERE id = $1') {
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    digikeySearchPartMock.mockResolvedValue({ results: [] });

    const res = mockRes();
    const next = vi.fn();

    await bulkUpdateSpecifications(mockReq(), res, next);

    expect(queryMock.mock.calls[0][0]).toContain('ORDER BY c.last_specs_refresh_at ASC NULLS FIRST');
    expect(queryMock).toHaveBeenCalledWith(
      'UPDATE components SET last_specs_refresh_at = CURRENT_TIMESTAMP WHERE id = $1',
      ['component-3'],
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      updatedCount: 0,
      skippedCount: 1,
      totalChecked: 1,
    }));
    expect(next).not.toHaveBeenCalled();
  });
});