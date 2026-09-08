import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('axios', () => ({ default: { post } }));
vi.mock('../utils/logger.js', () => ({ logInfo: vi.fn(), logError: vi.fn() }));
import { searchPart, clearSearchCache } from '../services/digikeyService.js';

describe('DigiKey service caching', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearSearchCache();
    post.mockReset().mockImplementation(async url => ({
      data: url.includes('oauth2') ? { access_token: 'test-token', expires_in: 3600 } : { Products: [] },
    }));
  });
  afterEach(() => vi.useRealTimers());
  const searches = () => post.mock.calls.filter(([url]) => url.includes('/search/keyword'));

  it('normalizes case and whitespace while separating different queries', async () => {
    await searchPart(' LM7805 ');
    await searchPart('lm7805');
    await searchPart('LM7812');
    expect(searches()).toHaveLength(2);
  });

  it('fetches again after the five-minute TTL', async () => {
    await searchPart('PART');
    vi.advanceTimersByTime(4 * 60 * 1000);
    await searchPart('PART');
    expect(searches()).toHaveLength(1);
    vi.advanceTimersByTime(60 * 1000);
    await searchPart('PART');
    expect(searches()).toHaveLength(2);
  });

  it('evicts the oldest entry when more than 100 fresh queries are cached', async () => {
    for (let index = 0; index <= 100; index++) await searchPart(`PART-${index}`);
    await searchPart('PART-100');
    expect(searches()).toHaveLength(101);
    await searchPart('PART-0');
    expect(searches()).toHaveLength(102);
  });

  it('deduplicates concurrent identical searches and releases failed requests for retry', async () => {
    post.mockRejectedValueOnce(new Error('temporary upstream failure'));
    await Promise.all([searchPart('SAME'), searchPart('same')]);
    post.mockResolvedValue({ data: { Products: [] } });
    const beforeRetry = post.mock.calls.length;
    await searchPart('SAME');
    expect(post.mock.calls.length).toBe(beforeRetry + 1);
  });
});
