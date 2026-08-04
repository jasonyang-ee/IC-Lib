import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
const connectMock = vi.fn();

vi.mock('../config/database.js', () => ({
  default: {
    query: (...args) => queryMock(...args),
    connect: (...args) => connectMock(...args),
  },
}));

const { promoteAlias, resolvePackage } = await import('../services/packageService.js');

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

describe('packageService promoteAlias', () => {
  const makeClient = (responses) => ({
    query: vi.fn(async (text) => {
      const match = Object.keys(responses).find((fragment) => text.includes(fragment));
      return match ? responses[match] : { rows: [] };
    }),
    release: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('moves the canonical name onto the alias without rewriting any alias row', async () => {
    const client = makeClient({
      'FROM packages WHERE id = $1': { rows: [{ id: 'package-1', short_name: 'TO-236-3' }] },
      'FROM package_aliases': { rows: [{ alias: 'SOT-23-3' }] },
      'FROM packages WHERE lower(short_name)': { rows: [] },
    });
    connectMock.mockResolvedValue(client);
    queryMock.mockResolvedValue({ rows: [{ ...catalogPackage, short_name: 'SOT-23-3' }] });

    await expect(promoteAlias('package-1', 'SOT-23-3')).resolves.toMatchObject({ short_name: 'SOT-23-3' });

    const statements = client.query.mock.calls.map(([text]) => text);
    // Both names keep resolving: the promoted alias row stays, and the displaced
    // canonical is still an alias row of its own (SPEC V62).
    expect(statements).toContain('UPDATE packages SET short_name = $1 WHERE id = $2');
    expect(statements.some((text) => /(INSERT INTO|DELETE FROM|UPDATE) package_aliases/.test(text))).toBe(false);
    expect(statements).toContain('COMMIT');
  });

  it('rejects an alias that already serves as another package canonical name', async () => {
    const client = makeClient({
      'FROM packages WHERE id = $1': { rows: [{ id: 'package-1', short_name: 'TO-236-3' }] },
      'FROM package_aliases': { rows: [{ alias: 'SOT-23-3' }] },
      'FROM packages WHERE lower(short_name)': { rows: [{ id: 'package-2' }] },
    });
    connectMock.mockResolvedValue(client);

    await expect(promoteAlias('package-1', 'SOT-23-3'))
      .rejects.toThrow('Alias already serves as another package canonical name');
    expect(client.query.mock.calls.map(([text]) => text)).toContain('ROLLBACK');
  });
});
