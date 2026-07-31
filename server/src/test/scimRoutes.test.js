import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// §V60/§I12: the SCIM read surface. Every route is bearer-only, answers
// `application/scim+json`, and can see a user only through the configured
// tenant plus the immutable Entra object id. An unknown identity is an empty
// 200 ListResponse - Entra's Test Connection probes with a random GUID and
// treats anything else as a broken endpoint.
//
// Driven over a real listener (this repo has no supertest) so the router's
// media type, status and header behaviour are exercised end-to-end.

const queryMock = vi.fn();
vi.mock('../config/database.js', () => ({
  default: { query: (...args) => queryMock(...args) },
}));

const logErrorMock = vi.fn();
vi.mock('../utils/logger.js', () => ({
  logError: (...args) => logErrorMock(...args),
}));

const scimRoutes = (await import('../routes/scim.js')).default;
const { SCIM_BASE_PATH, SCIM_CONTENT_TYPE } = await import('../services/scimService.js');

const TENANT = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const TOKEN = 'b'.repeat(48);
const OBJECT_ID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
const LOCAL_ID = '018f2a1b-2c3d-7e4f-8a9b-0c1d2e3f4a5b';

const linkedRow = (overrides = {}) => ({
  id: LOCAL_ID,
  username: 'jsmith@contoso.com',
  display_name: 'J Smith',
  email: 'jsmith@contoso.com',
  is_active: true,
  oidc_object_id: OBJECT_ID,
  ...overrides,
});

describe('SCIM discovery and lookup (§V60)', () => {
  let server;
  let baseUrl;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SCIM_TENANT_ID = TENANT;
    process.env.SCIM_BEARER_TOKEN = TOKEN;

    const app = express();
    app.use(SCIM_BASE_PATH, scimRoutes);
    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${server.address().port}${SCIM_BASE_PATH}`;
  });

  afterEach(() => new Promise((resolve) => {
    delete process.env.SCIM_TENANT_ID;
    delete process.env.SCIM_BEARER_TOKEN;
    server.close(resolve);
  }));

  const get = (path, token = TOKEN) => fetch(`${baseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  describe('authentication', () => {
    const paths = ['/ServiceProviderConfig', '/ResourceTypes', '/Schemas', `/Users?filter=externalId eq "${OBJECT_ID}"`, `/Users/${LOCAL_ID}`];

    it('refuses every route without a bearer token', async () => {
      for (const path of paths) {
        const res = await get(path, null);
        expect(res.status).toBe(401);
        expect(res.headers.get('www-authenticate')).toBe('Bearer realm="scim"');
      }
      expect(queryMock).not.toHaveBeenCalled();
    });

    it('refuses a wrong bearer token', async () => {
      const res = await get('/ServiceProviderConfig', 'c'.repeat(48));

      expect(res.status).toBe(401);
      expect(await res.text()).not.toContain(TOKEN);
    });

    it('hides the whole surface while the feature is disabled', async () => {
      delete process.env.SCIM_TENANT_ID;
      delete process.env.SCIM_BEARER_TOKEN;

      const res = await get('/ServiceProviderConfig');

      expect(res.status).toBe(404);
    });

    it('mounts authenticateScim as the first handler of every route', () => {
      const routes = scimRoutes.stack.filter(layer => layer.route);

      expect(routes).toHaveLength(5);
      for (const layer of routes) {
        expect(layer.route.stack[0].handle.name).toBe('authenticateScim');
      }
    });
  });

  describe('discovery', () => {
    it('advertises patch and filter, and refuses bulk, sort, etag and password change', async () => {
      const res = await get('/ServiceProviderConfig');
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain(SCIM_CONTENT_TYPE);
      expect(body.patch.supported).toBe(true);
      expect(body.filter.supported).toBe(true);
      expect(body.bulk.supported).toBe(false);
      expect(body.changePassword.supported).toBe(false);
      expect(body.sort.supported).toBe(false);
      expect(body.etag.supported).toBe(false);
    });

    it('offers the User resource type only, matching the advertised schema', async () => {
      const types = await (await get('/ResourceTypes')).json();
      const schemas = await (await get('/Schemas')).json();

      expect(types.Resources).toHaveLength(1);
      expect(types.Resources[0]).toMatchObject({ id: 'User', endpoint: '/Users' });
      expect(schemas.Resources).toHaveLength(1);
      expect(schemas.Resources[0].id).toBe(types.Resources[0].schema);
      expect(schemas.Resources[0].attributes.map(a => a.name))
        .toEqual(['userName', 'displayName', 'active', 'emails']);
    });
  });

  describe('GET /Users', () => {
    const filterFor = (guid) => `/Users?filter=${encodeURIComponent(`externalId eq "${guid}"`)}`;

    it('answers an unknown object id with an empty ListResponse, not an error', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const res = await get(filterFor('11111111-2222-3333-4444-555555555555'));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.totalResults).toBe(0);
      expect(body.Resources).toEqual([]);
      expect(body.schemas).toEqual(['urn:ietf:params:scim:api:messages:2.0:ListResponse']);
    });

    it('scopes the lookup to the configured tenant and the object id', async () => {
      queryMock.mockResolvedValueOnce({ rows: [linkedRow()] });

      const body = await (await get(filterFor(OBJECT_ID))).json();

      const [sql, params] = queryMock.mock.calls[0];
      expect(sql).toContain('oidc_tenant_id = $1');
      expect(sql).toContain('oidc_object_id = $2');
      expect(params).toEqual([TENANT, OBJECT_ID]);
      expect(body.Resources[0]).toMatchObject({
        id: LOCAL_ID,
        externalId: OBJECT_ID,
        userName: 'jsmith@contoso.com',
        displayName: 'J Smith',
        active: true,
      });
      expect(body.Resources[0].emails).toEqual([
        { value: 'jsmith@contoso.com', type: 'work', primary: true },
      ]);
    });

    it('returns a linked but deactivated user with active false', async () => {
      queryMock.mockResolvedValueOnce({ rows: [linkedRow({ is_active: false })] });

      const body = await (await get(filterFor(OBJECT_ID))).json();

      expect(body.totalResults).toBe(1);
      expect(body.Resources[0].active).toBe(false);
    });

    it('rejects an unsupported or malformed filter without querying', async () => {
      for (const filter of ['userName eq "jsmith"', 'externalId co "abc"', 'externalId eq abc', '']) {
        const res = await fetch(`${baseUrl}/Users?filter=${encodeURIComponent(filter)}`, {
          headers: { Authorization: `Bearer ${TOKEN}` },
        });

        expect(res.status).toBe(400);
        expect((await res.json()).scimType).toBe('invalidFilter');
      }

      const missing = await get('/Users');
      expect(missing.status).toBe(400);
      expect(queryMock).not.toHaveBeenCalled();
    });

    it('reports a database failure as a generic SCIM 500', async () => {
      queryMock.mockRejectedValueOnce(new Error('connection terminated: iclib@flat'));

      const res = await get(filterFor(OBJECT_ID));

      expect(res.status).toBe(500);
      expect(await res.text()).not.toContain('flat');
      expect(logErrorMock).toHaveBeenCalled();
    });
  });

  describe('GET /Users/:id', () => {
    it('returns the user addressed by its retained local id', async () => {
      queryMock.mockResolvedValueOnce({ rows: [linkedRow()] });

      const res = await get(`/Users/${LOCAL_ID}`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(queryMock.mock.calls[0][1]).toEqual([LOCAL_ID, TENANT]);
      expect(body.id).toBe(LOCAL_ID);
      expect(body.meta.location).toBe(`${SCIM_BASE_PATH}/Users/${LOCAL_ID}`);
    });

    it('answers 404 for an unknown id and for one that is not a UUID', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });
      expect((await get(`/Users/${LOCAL_ID}`)).status).toBe(404);

      expect((await get('/Users/not-a-uuid')).status).toBe(404);
      expect(queryMock).toHaveBeenCalledTimes(1);
    });
  });
});
