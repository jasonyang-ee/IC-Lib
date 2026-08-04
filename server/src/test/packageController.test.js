import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('../config/database.js', () => ({
  default: {
    query: (...args) => queryMock(...args),
    connect: vi.fn(),
  },
}));

const { createPackage, getPackages } = await import('../controllers/packageController.js');

const mockResponse = () => {
  const response = {};
  response.status = vi.fn().mockReturnValue(response);
  response.json = vi.fn().mockReturnValue(response);
  return response;
};

describe('packageController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an invalid count_policy at the API boundary before database work', async () => {
    const response = mockResponse();
    const next = vi.fn();

    await createPackage({
      body: { short_name: 'TEST', count_policy: 'guessed' },
    }, response, next);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: 'count_policy must be chip, embedded, none, or append',
    });
    expect(queryMock).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns an unresolved package query as a sanitized pass-through value', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const response = mockResponse();
    const next = vi.fn();

    await getPackages({ query: { resolve: ' Box with Connector ' } }, response, next);

    expect(response.json).toHaveBeenCalledWith({
      input: 'Box with Connector',
      package: null,
      shortName: null,
      pinCount: null,
      density: null,
    });
    expect(next).not.toHaveBeenCalled();
  });
});
