import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('../config/database.js', () => ({
  default: {
    query: (...args) => queryMock(...args),
    connect: vi.fn(),
  },
}));

const { resolvePackage } = await import('../services/packageService.js');

const catalogPackage = {
  id: 'package-1',
  short_name: 'SOT-23-3',
  family: 'SOT',
  mount: 'SMT',
  count_policy: 'embedded',
  is_builtin: true,
  is_active: true,
  display_order: null,
};

describe('packageService resolvePackage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['TO-236-3', 'to2363'],
    ['SC-59A', 'sc59a'],
    ['SOT-23-3', 'sot233'],
  ])('resolves %s to its canonical package', async (input, aliasKey) => {
    queryMock.mockImplementation(async (_sql, [key]) => ({
      rows: key === aliasKey ? [catalogPackage] : [],
    }));

    await expect(resolvePackage(input)).resolves.toMatchObject({
      input,
      package: catalogPackage,
      shortName: 'SOT-23-3',
      pinCount: 3,
    });
  });

  it.each(['TO236_3', 'to 236 3'])('folds case and separators for %s', async (input) => {
    queryMock.mockResolvedValue({ rows: [catalogPackage] });

    await expect(resolvePackage(input)).resolves.toMatchObject({
      package: catalogPackage,
      shortName: 'SOT-23-3',
    });
    expect(queryMock).toHaveBeenCalledWith(expect.any(String), ['to2363']);
  });

  it('returns sanitized unresolved input instead of throwing', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    await expect(resolvePackage(' Box with Connector ')).resolves.toEqual({
      input: 'Box with Connector',
      package: null,
      shortName: null,
      pinCount: null,
      density: null,
    });
  });
});
