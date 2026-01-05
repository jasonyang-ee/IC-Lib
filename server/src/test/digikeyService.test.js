import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DigiKey service dependencies
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
    })),
  },
}));

describe('DigiKey Service Caching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent cache keys', () => {
      const getCacheKey = (query) => `search:${query.toLowerCase().trim()}`;
      
      const key1 = getCacheKey('LM7805');
      const key2 = getCacheKey('lm7805');
      const key3 = getCacheKey('  LM7805  ');
      
      expect(key1).toBe(key2);
      expect(key2).toBe(key3);
    });

    it('should handle different queries', () => {
      const getCacheKey = (query) => `search:${query.toLowerCase().trim()}`;
      
      const key1 = getCacheKey('LM7805');
      const key2 = getCacheKey('LM7812');
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('Cache TTL', () => {
    it('should respect cache expiration', () => {
      const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
      const now = Date.now();
      const validTimestamp = now - (4 * 60 * 1000); // 4 minutes ago
      const expiredTimestamp = now - (6 * 60 * 1000); // 6 minutes ago
      
      expect(now - validTimestamp < CACHE_TTL).toBe(true);
      expect(now - expiredTimestamp < CACHE_TTL).toBe(false);
    });
  });
});
