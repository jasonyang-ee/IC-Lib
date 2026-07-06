import { beforeEach, describe, expect, it, vi } from 'vitest';

// §V34: every outbound vendor HTTP call is bounded by a timeout so a hung
// upstream cannot hold the request open indefinitely.

const axiosMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('axios', () => ({ default: axiosMock }));

vi.stubEnv('DIGIKEY_CLIENT_ID', 'id');
vi.stubEnv('DIGIKEY_CLIENT_SECRET', 'secret');
vi.stubEnv('MOUSER_API_KEY', 'key');
vi.stubEnv('ULTRA_LIBRARIAN_TOKEN', 'ul-token');
vi.stubEnv('SNAPEDA_API_KEY', 'snap-key');

const digikey = await import('../services/digikeyService.js');
const mouser = await import('../services/mouserService.js');
const footprint = await import('../services/footprintService.js');
const { VENDOR_HTTP_TIMEOUT_MS } = await import('../constants/vendorHttp.js');

// The axios config object is always the last positional argument (get(url,cfg),
// post(url,body,cfg)).
const configsOf = mock => mock.mock.calls.map(call => call[call.length - 1]);

describe('vendor HTTP timeouts (§V34)', () => {
  beforeEach(() => {
    axiosMock.get.mockReset();
    axiosMock.post.mockReset();
    digikey.clearSearchCache();
    // Generic response satisfying every reader: token fields, empty product /
    // search sets, and no downloadUrl/results so footprint returns before any
    // file download (no disk writes in this test).
    axiosMock.post.mockResolvedValue({
      data: { access_token: 't', expires_in: 3600, Products: [], SearchResults: { Parts: [] } },
    });
    axiosMock.get.mockResolvedValue({ data: {} });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('digikey searchPart bounds its token + search calls', async () => {
    await digikey.searchPart('PART-DK');
    const configs = configsOf(axiosMock.post);
    expect(configs.length).toBeGreaterThan(0);
    configs.forEach(cfg => expect(cfg?.timeout).toBe(VENDOR_HTTP_TIMEOUT_MS));
  });

  it('digikey getPartDetails bounds its call', async () => {
    await digikey.getPartDetails('DK-123');
    const configs = configsOf(axiosMock.get);
    expect(configs.length).toBeGreaterThan(0);
    configs.forEach(cfg => expect(cfg?.timeout).toBe(VENDOR_HTTP_TIMEOUT_MS));
  });

  it('mouser searchPart bounds its call', async () => {
    await mouser.searchPart('PART-M');
    const configs = configsOf(axiosMock.post);
    expect(configs.length).toBeGreaterThan(0);
    configs.forEach(cfg => expect(cfg?.timeout).toBe(VENDOR_HTTP_TIMEOUT_MS));
  });

  it('mouser getPartByMouserPartNumber bounds its call', async () => {
    await mouser.getPartByMouserPartNumber('M-123');
    const configs = configsOf(axiosMock.get);
    expect(configs.length).toBeGreaterThan(0);
    configs.forEach(cfg => expect(cfg?.timeout).toBe(VENDOR_HTTP_TIMEOUT_MS));
  });

  it('footprint UL + SnapEDA search calls are bounded', async () => {
    await footprint.downloadFromUltraLibrarian('PART-UL');
    await footprint.downloadFromSnapEDA('PART-SNAP');
    const configs = configsOf(axiosMock.get);
    expect(configs.length).toBeGreaterThan(0);
    configs.forEach(cfg => expect(cfg?.timeout).toBe(VENDOR_HTTP_TIMEOUT_MS));
  });
});
