import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database pool
vi.mock('../config/database.js', () => ({
  default: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

describe('Database Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports a pool object', async () => {
    const { default: pool } = await import('../config/database.js');
    expect(pool).toBeDefined();
    expect(pool.query).toBeDefined();
  });
});
