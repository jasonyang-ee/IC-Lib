import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appBodyParsers } from '../middleware/bodyParsers.js';

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
const logWarnMock = vi.fn();
const logFatalMock = vi.fn();
vi.mock('../utils/logger.js', () => ({
  logError: (...args) => logErrorMock(...args),
  logWarn: (...args) => logWarnMock(...args),
  logFatal: (...args) => logFatalMock(...args),
}));

const logUserActivityMock = vi.fn();
vi.mock('../services/activityLogService.js', () => ({
  logUserActivity: (...args) => logUserActivityMock(...args),
}));

vi.stubEnv('JWT_SECRET', 'test-secret-key-minimum-32-chars-long');

const scimRoutes = (await import('../routes/scim.js')).default;
const { mountApiRoutes } = await import('../routes/registry.js');
const {
  SCIM_BASE_PATH,
  SCIM_CONTENT_TYPE,
  SCIM_USER_SCHEMA,
} = await import('../services/scimService.js');

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
  let origin;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SCIM_TENANT_ID = TENANT;
    process.env.SCIM_BEARER_TOKEN = TOKEN;

    const app = express();
    app.use(appBodyParsers);
    app.post('/parser-probe', (req, res) => res.json({ body: req.body ?? null }));
    app.post(`${SCIM_BASE_PATH}/parser-probe`, (req, res) => res.json({ body: req.body ?? null }));
    app.post(`${SCIM_BASE_PATH}x/parser-probe`, (req, res) => res.json({ body: req.body ?? null }));
    mountApiRoutes(app);
    server = app.listen(0);
    origin = `http://127.0.0.1:${server.address().port}`;
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

  const send = (method, path, body) => fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/scim+json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  /** SELECT of the linked row, then the UPDATE the handler may issue. */
  const stubUser = (row = linkedRow(), updated = row) => {
    queryMock.mockResolvedValueOnce({ rows: [row] });
    queryMock.mockResolvedValueOnce({ rows: [updated] });
  };

  const updateCall = () => queryMock.mock.calls.find(([sql]) => sql.includes('UPDATE users'));

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

    it('refuses every mutation without a bearer token', async () => {
      const mutations = [
        fetch(`${baseUrl}/Users`, { method: 'POST', body: '{}' }),
        fetch(`${baseUrl}/Users/${LOCAL_ID}`, { method: 'PATCH', body: '{}' }),
        fetch(`${baseUrl}/Users/${LOCAL_ID}`, { method: 'DELETE' }),
      ];

      for (const res of await Promise.all(mutations)) {
        expect(res.status).toBe(401);
      }
      expect(queryMock).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated malformed, oversized, JSON, and form bodies before parsing', async () => {
      const requests = [
        ['application/scim+json', '{'],
        ['application/scim+json', 'x'.repeat(70 * 1024)],
        ['application/json', '{}'],
        ['application/x-www-form-urlencoded', 'active=true'],
      ].map(([contentType, body]) => fetch(`${baseUrl}/Groups`, {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body,
      }));

      for (const res of await Promise.all(requests)) {
        expect(res.status).toBe(401);
        expect(res.headers.get('content-type')).toContain(SCIM_CONTENT_TYPE);
      }
      expect(queryMock).not.toHaveBeenCalled();
    });

    it('rejects a mixed-case malformed SCIM request before generic parsing', async () => {
      const res = await fetch(`${origin}/API/ScIm/V2/Groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/scim+json' },
        body: '{',
      });

      expect(res.status).toBe(401);
      expect(res.headers.get('content-type')).toContain(SCIM_CONTENT_TYPE);
      expect(queryMock).not.toHaveBeenCalled();
    });

    it('refuses a wrong bearer token', async () => {
      const res = await get('/ServiceProviderConfig', 'c'.repeat(48));

      expect(res.status).toBe(401);
      expect(await res.text()).not.toContain(TOKEN);
    });

    it('accepts the Bearer scheme case-insensitively', async () => {
      const res = await fetch(`${baseUrl}/ServiceProviderConfig`, {
        headers: { Authorization: `bearer ${TOKEN}` },
      });

      expect(res.status).toBe(200);
    });

    it('hides the whole surface while the feature is disabled', async () => {
      delete process.env.SCIM_TENANT_ID;
      delete process.env.SCIM_BEARER_TOKEN;

      const res = await get('/ServiceProviderConfig');

      expect(res.status).toBe(404);
    });

    it('answers an unsupported resource in the SCIM error shape', async () => {
      const res = await get('/Groups');
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(res.headers.get('content-type')).toContain(SCIM_CONTENT_TYPE);
      expect(body.schemas).toEqual(['urn:ietf:params:scim:api:messages:2.0:Error']);
    });

    it('mounts authenticateScim as the router-wide first handler', () => {
      const routes = scimRoutes.stack.filter(layer => layer.route);

      expect(routes).toHaveLength(10);
      expect(scimRoutes.stack[0].handle.name).toBe('authenticateScim');
    });
  });

  describe('ingress body boundary', () => {
    it('skips generic JSON and form parsing only for the case-insensitive SCIM subtree', async () => {
      const json = await fetch(`${origin}/parser-probe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }),
      });
      expect((await json.json()).body).toEqual({ active: true });

      const form = await fetch(`${origin}/parser-probe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'active=true',
      });
      expect((await form.json()).body).toEqual({ active: 'true' });

      const scimJson = await fetch(`${origin}${SCIM_BASE_PATH}/parser-probe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }),
      });
      expect((await scimJson.json()).body).toBeNull();

      const scimForm = await fetch(`${origin}${SCIM_BASE_PATH}/parser-probe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'active=true',
      });
      expect((await scimForm.json()).body).toBeNull();

      const mixedCaseScim = await fetch(`${origin}/API/ScIm/V2/parser-probe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }),
      });
      expect((await mixedCaseScim.json()).body).toBeNull();

      const nearPrefix = await fetch(`${origin}${SCIM_BASE_PATH}x/parser-probe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }),
      });
      expect((await nearPrefix.json()).body).toEqual({ active: true });
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
        .toEqual(['userName', 'externalId', 'displayName', 'active', 'emails']);
      expect(schemas.Resources[0].attributes.find(a => a.name === 'externalId').mutability)
        .toBe('immutable');
    });

    it('retrieves the advertised User ResourceType and Schema at their locations', async () => {
      const types = await (await get('/ResourceTypes')).json();
      const schemas = await (await get('/Schemas')).json();
      const type = await (await get('/ResourceTypes/User')).json();
      const schema = await (await get(`/Schemas/${encodeURIComponent(SCIM_USER_SCHEMA)}`)).json();

      expect(type).toEqual(types.Resources[0]);
      expect(schema).toEqual(schemas.Resources[0]);
      const typeFollow = await fetch(`${origin}${type.meta.location}`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      const schemaFollow = await fetch(`${origin}${schema.meta.location}`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      expect(await typeFollow.json()).toEqual(type);
      expect(await schemaFollow.json()).toEqual(schema);
      expect((await get('/ResourceTypes/Group')).status).toBe(404);
      expect((await get('/Schemas/unknown')).status).toBe(404);
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
      expect(sql).toContain('oidc_object_id = $1');
      expect(sql).toContain('oidc_tenant_id = $2');
      expect(params).toEqual([OBJECT_ID, TENANT]);
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

    it('canonicalizes uppercase tenant, filter, and replayed POST identities', async () => {
      process.env.SCIM_TENANT_ID = TENANT.toUpperCase();
      const post = externalId => ({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        externalId,
        userName: 'jsmith@contoso.com',
        active: true,
      });
      queryMock.mockResolvedValueOnce({ rows: [linkedRow()] });

      const first = await send('POST', '/Users', post(OBJECT_ID.toUpperCase()));
      const firstBody = await first.json();
      queryMock.mockResolvedValueOnce({ rows: [linkedRow()] });

      const replay = await send('POST', '/Users', post(OBJECT_ID));
      const replayBody = await replay.json();

      expect(first.status).toBe(201);
      expect(replay.status).toBe(201);
      expect(firstBody.externalId).toBe(OBJECT_ID);
      expect(replayBody.externalId).toBe(OBJECT_ID);
      expect(firstBody.meta.location).toBe(replayBody.meta.location);
      expect(queryMock.mock.calls[0][1]).toEqual([OBJECT_ID, TENANT]);
      expect(queryMock.mock.calls[1][1]).toEqual([OBJECT_ID, TENANT]);
    });

    it('returns a linked but deactivated user with active false', async () => {
      queryMock.mockResolvedValueOnce({ rows: [linkedRow({ is_active: false })] });

      const body = await (await get(filterFor(OBJECT_ID))).json();

      expect(body.totalResults).toBe(1);
      expect(body.Resources[0].active).toBe(false);
    });

    it('rejects an unsupported or malformed filter without querying', async () => {
      for (const filter of ['userName eq "jsmith"', 'externalId co "abc"', 'externalId eq abc', 'externalId eq "not-a-guid"', '']) {
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

    it('maps an unexpected authenticated controller failure to a SCIM 500', async () => {
      queryMock.mockResolvedValueOnce({ rows: null });

      const res = await get(filterFor(OBJECT_ID));

      expect(res.status).toBe(500);
      expect(res.headers.get('content-type')).toContain(SCIM_CONTENT_TYPE);
      expect((await res.json()).schemas).toEqual(['urn:ietf:params:scim:api:messages:2.0:Error']);
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

  describe('POST /Users', () => {
    const postBody = (extra = {}) => ({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      externalId: OBJECT_ID,
      userName: 'jsmith@contoso.com',
      active: true,
      ...extra,
    });

    it('refuses an unknown identity with 403 and creates nothing', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const res = await send('POST', '/Users', postBody());

      expect(res.status).toBe(403);
      expect(queryMock.mock.calls.every(([sql]) => sql.includes('SELECT'))).toBe(true);
      expect(logWarnMock).toHaveBeenCalled();
      expect(logUserActivityMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ typeName: 'scim_provisioning', userId: null }),
      );
    });

    it('updates and returns the already-linked user instead of creating one', async () => {
      stubUser(linkedRow({ display_name: 'Old Name' }), linkedRow({ display_name: 'J Smith' }));

      const res = await send('POST', '/Users', postBody({ displayName: 'J Smith' }));
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.id).toBe(LOCAL_ID);
      expect(body.displayName).toBe('J Smith');
      expect(res.headers.get('location')).toBe(body.meta.location);
      expect(updateCall()[0]).toContain('display_name = $1');
      expect(updateCall()[1]).toEqual(['J Smith', LOCAL_ID, TENANT, OBJECT_ID]);

      queryMock.mockResolvedValueOnce({ rows: [linkedRow({ display_name: 'J Smith' })] });
      const followed = await fetch(`${origin}${body.meta.location}`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      expect(followed.status).toBe(200);
      expect((await followed.json()).meta.location).toBe(body.meta.location);
    });

    it('is idempotent: a replay of the stored state writes nothing', async () => {
      queryMock.mockResolvedValueOnce({ rows: [linkedRow()] });

      const res = await send('POST', '/Users', postBody({
        displayName: 'J Smith',
        emails: [{ value: 'jsmith@contoso.com', type: 'work', primary: true }],
      }));
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(res.headers.get('location')).toBe(body.meta.location);
      expect(updateCall()).toBeUndefined();
    });

    it('does not report provisioning success when the linked identity changes after lookup', async () => {
      queryMock.mockResolvedValueOnce({ rows: [linkedRow({ display_name: 'Old Name' })] });
      queryMock.mockResolvedValueOnce({ rows: [] });

      const res = await send('POST', '/Users', postBody({ displayName: 'J Smith' }));

      expect(res.status).toBe(409);
      expect(res.headers.get('content-type')).toContain(SCIM_CONTENT_TYPE);
      expect(queryMock.mock.calls[1][1]).toEqual(['J Smith', LOCAL_ID, TENANT, OBJECT_ID]);
      expect(logUserActivityMock).not.toHaveBeenCalled();
    });

    it('accepts case variants for identity, profile, name, and email members', async () => {
      stubUser(
        linkedRow({ username: 'old', display_name: null, email: 'old@contoso.com' }),
        linkedRow({ username: 'jsmith@contoso.com', display_name: 'J Smith', email: 'new@contoso.com' }),
      );

      const res = await send('POST', '/Users', {
        SCHEMAS: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        EXTERNALID: OBJECT_ID.toUpperCase(),
        USERNAME: 'jsmith@contoso.com',
        NAME: { FORMATTED: 'J Smith' },
        EMAILS: [{ VALUE: 'new@contoso.com', PRIMARY: true }],
        ACTIVE: true,
      });

      expect(res.status).toBe(201);
      expect(queryMock.mock.calls[0][1]).toEqual([OBJECT_ID, TENANT]);
      expect(updateCall()[1]).toEqual(['jsmith@contoso.com', 'J Smith', 'new@contoso.com', LOCAL_ID, TENANT, OBJECT_ID]);
    });

    it('rejects duplicate case variants before looking up or writing a user', async () => {
      const attempts = [
        postBody({ EXTERNALID: OBJECT_ID }),
        postBody({ USERNAME: 'other@contoso.com' }),
        postBody({ name: { formatted: 'One', FORMATTED: 'Two' } }),
        postBody({ emails: [{ value: 'one@contoso.com', VALUE: 'two@contoso.com' }] }),
        postBody({ emails: [{ value: 'one@contoso.com', type: 'work', TYPE: 'home' }] }),
      ];

      for (const body of attempts) {
        const res = await send('POST', '/Users', body);
        expect(res.status).toBe(400);
        expect((await res.json()).scimType).toBe('invalidValue');
      }
      expect(queryMock).not.toHaveBeenCalled();
    });

    it('requires a GUID externalId and refuses locally owned attributes', async () => {
      expect((await send('POST', '/Users', postBody({ externalId: 'jsmith' }))).status).toBe(400);

      const roleAttempt = await send('POST', '/Users', postBody({ role: 'admin' }));
      expect(roleAttempt.status).toBe(400);
      expect((await roleAttempt.json()).scimType).toBe('invalidValue');
      expect(queryMock).not.toHaveBeenCalled();
    });

    it('ignores POST read-only fields and Entra empty roles, but refuses sensitive first segments', async () => {
      queryMock.mockResolvedValueOnce({ rows: [linkedRow()] });
      const tolerated = await send('POST', '/Users', postBody({
        id: 'ignored',
        meta: { created: 'ignored' },
        roles: [],
      }));
      expect(tolerated.status).toBe(201);
      expect(queryMock).toHaveBeenCalledTimes(1);

      queryMock.mockClear();
      const attempts = [
        { 'roles.value': 'admin' },
        { 'password_hash.value': 'secret' },
        { auth_provider: 'oidc' },
        { 'oidc_sub.value': 'foreign' },
        { 'externalId.value': OBJECT_ID },
      ];
      for (const attributes of attempts) {
        const res = await send('POST', '/Users', postBody(attributes));
        expect(res.status).toBe(400);
        expect((await res.json()).scimType).toMatch(/invalidValue|mutability/);
      }
      expect(queryMock).not.toHaveBeenCalled();
    });

    it('requires SCIM media, maps malformed JSON to 400, and caps the body at 64kb', async () => {
      const wrongMedia = await fetch(`${baseUrl}/Users`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(wrongMedia.status).toBe(415);
      expect((await wrongMedia.json()).schemas).toEqual(['urn:ietf:params:scim:api:messages:2.0:Error']);

      const malformed = await fetch(`${baseUrl}/Users`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': SCIM_CONTENT_TYPE },
        body: '{',
      });
      expect(malformed.status).toBe(400);
      expect((await malformed.json()).scimType).toBe('invalidSyntax');
      expect(queryMock).not.toHaveBeenCalled();

      const oversized = await fetch(`${baseUrl}/Users`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': SCIM_CONTENT_TYPE },
        body: JSON.stringify({ externalId: OBJECT_ID, userName: 'x'.repeat(70 * 1024) }),
      });
      expect(oversized.status).toBe(413);
      expect((await oversized.json()).schemas).toEqual(['urn:ietf:params:scim:api:messages:2.0:Error']);
      expect(queryMock).not.toHaveBeenCalled();
    });

    it('keeps authenticated charset and content-encoding parser errors SCIM-shaped', async () => {
      const requests = [
        fetch(`${baseUrl}/Users`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': `${SCIM_CONTENT_TYPE}; charset=unsupported` },
          body: '{}',
        }),
        fetch(`${baseUrl}/Users`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': SCIM_CONTENT_TYPE, 'Content-Encoding': 'br' },
          body: '{}',
        }),
      ];

      for (const res of await Promise.all(requests)) {
        expect(res.status).toBe(415);
        expect(res.headers.get('content-type')).toContain(SCIM_CONTENT_TYPE);
        expect((await res.json()).schemas).toEqual(['urn:ietf:params:scim:api:messages:2.0:Error']);
      }
      expect(queryMock).not.toHaveBeenCalled();
    });

    it('maps a duplicate username to 409 uniqueness', async () => {
      queryMock.mockResolvedValueOnce({ rows: [linkedRow()] });
      queryMock.mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }));

      const res = await send('POST', '/Users', postBody({ userName: 'taken' }));

      expect(res.status).toBe(409);
      expect((await res.json()).scimType).toBe('uniqueness');
    });
  });

  describe('PATCH /Users/:id', () => {
    const patch = (operations) => send('PATCH', `/Users/${LOCAL_ID}`, {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
      Operations: operations,
    });

    it('normalizes PATCH operation, member, and path casing', async () => {
      stubUser(
        linkedRow({ display_name: null, email: 'old@contoso.com', is_active: true }),
        linkedRow({ display_name: 'J Smith', email: 'new@contoso.com', is_active: false }),
      );

      const res = await send('PATCH', `/Users/${LOCAL_ID}`, {
        OPERATIONS: [
          { OP: 'Replace', VALUE: { NAME: { FORMATTED: 'J Smith' }, EMAILS: [{ VALUE: 'new@contoso.com' }] } },
          { OP: 'replace', PATH: 'AcTiVe', VALUE: false },
        ],
      });

      expect(res.status).toBe(200);
      expect(updateCall()[1]).toEqual(['J Smith', 'new@contoso.com', false, LOCAL_ID, TENANT, OBJECT_ID]);
    });

    it('rejects duplicate case variants in every PATCH operation member', async () => {
      const res = await patch([{
        op: 'replace',
        path: 'active',
        value: false,
        note: 'first',
        NOTE: 'second',
      }]);

      expect(res.status).toBe(400);
      expect((await res.json()).scimType).toBe('invalidValue');
      expect(queryMock).not.toHaveBeenCalled();
    });

    it('deactivates on a case-insensitive Replace and logs the lifecycle change', async () => {
      stubUser(linkedRow(), linkedRow({ is_active: false }));

      const body = await (await patch([{ op: 'Replace', path: 'active', value: false }])).json();

      expect(body.active).toBe(false);
      expect(updateCall()[1]).toEqual([false, LOCAL_ID, TENANT, OBJECT_ID]);
      expect(logUserActivityMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ userId: LOCAL_ID }),
      );
    });

    it('reactivates the same row, accepting Entra string booleans', async () => {
      stubUser(linkedRow({ is_active: false }), linkedRow({ is_active: true }));

      const body = await (await patch([{ op: 'replace', path: 'active', value: 'True' }])).json();

      expect(body.id).toBe(LOCAL_ID);
      expect(body.active).toBe(true);
    });

    it('accepts the pathless object form and a filtered email path', async () => {
      stubUser(linkedRow(), linkedRow({ display_name: 'New', email: 'new@contoso.com' }));

      await patch([
        { op: 'Add', value: { displayName: 'New' } },
        { op: 'replace', path: 'emails[type eq "work"].value', value: 'new@contoso.com' },
      ]);

      expect(updateCall()[0]).toContain('display_name');
      expect(updateCall()[0]).toContain('email');
      expect(updateCall()[1]).toEqual(['New', 'new@contoso.com', LOCAL_ID, TENANT, OBJECT_ID]);
    });

    it('clears a nullable profile field on Remove but refuses the required ones', async () => {
      stubUser(linkedRow(), linkedRow({ display_name: null }));
      const cleared = await (await patch([{ op: 'remove', path: 'displayName' }])).json();
      expect(cleared.displayName).toBeUndefined();
      expect(updateCall()[1]).toEqual([null, LOCAL_ID, TENANT, OBJECT_ID]);

      for (const path of ['userName', 'active']) {
        const res = await patch([{ op: 'remove', path }]);
        expect(res.status).toBe(400);
      }
    });

    it('refuses to move the identity keys or the local role', async () => {
      const attempts = [
        { op: 'replace', path: 'externalId', value: OBJECT_ID, scimType: 'mutability' },
        { op: 'replace', path: 'externalId.value', value: OBJECT_ID, scimType: 'mutability' },
        { op: 'replace', path: 'ExternalId', value: OBJECT_ID, scimType: 'mutability' },
        { op: 'replace', path: 'EXTERNALID.value', value: OBJECT_ID, scimType: 'mutability' },
        { op: 'replace', path: 'id.value', value: 'x', scimType: 'mutability' },
        { op: 'replace', path: 'meta.created', value: 'x', scimType: 'mutability' },
        { op: 'replace', path: 'oidc_sub', value: 'x', scimType: 'invalidValue' },
        { op: 'replace', path: 'oidc_sub.value', value: 'x', scimType: 'invalidValue' },
        { op: 'replace', path: 'password_hash.value', value: 'x', scimType: 'invalidValue' },
        { op: 'replace', path: 'roles[type eq "work"].value', value: ['admin'], scimType: 'invalidValue' },
        { op: 'replace', path: 'roles', value: ['admin'], scimType: 'invalidValue' },
      ];

      for (const { scimType, ...operation } of attempts) {
        const res = await patch([operation]);
        expect(res.status).toBe(400);
        expect((await res.json()).scimType).toBe(scimType);
      }
      expect(queryMock).not.toHaveBeenCalled();
    });

    it('answers 404 for an unknown user and still succeeds when the audit write fails', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });
      expect((await patch([{ op: 'replace', path: 'active', value: false }])).status).toBe(404);

      stubUser(linkedRow(), linkedRow({ is_active: false }));
      logUserActivityMock.mockRejectedValueOnce(new Error('audit table is read-only'));

      const res = await patch([{ op: 'replace', path: 'active', value: false }]);

      expect(res.status).toBe(200);
      expect(logErrorMock).toHaveBeenCalled();
    });

    it('does not report patch success when the linked identity changes after lookup', async () => {
      queryMock.mockResolvedValueOnce({ rows: [linkedRow({ is_active: true })] });
      queryMock.mockResolvedValueOnce({ rows: [] });

      const res = await patch([{ op: 'replace', path: 'active', value: false }]);

      expect(res.status).toBe(409);
      expect(res.headers.get('content-type')).toContain(SCIM_CONTENT_TYPE);
      expect(queryMock.mock.calls[1][1]).toEqual([false, LOCAL_ID, TENANT, OBJECT_ID]);
      expect(logUserActivityMock).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /Users/:id', () => {
    it('deactivates the row rather than deleting it, and repeats as 204', async () => {
      queryMock.mockResolvedValue({ rows: [linkedRow()] });

      expect((await send('DELETE', `/Users/${LOCAL_ID}`)).status).toBe(204);
      expect((await send('DELETE', `/Users/${LOCAL_ID}`)).status).toBe(204);

      const [sql, params] = updateCall();
      expect(sql).toContain('is_active = false');
      expect(params).toEqual([LOCAL_ID, TENANT, OBJECT_ID]);
      expect(sql).not.toContain('DELETE');
    });

    it('answers 404 for a user this tenant cannot see', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      expect((await send('DELETE', `/Users/${LOCAL_ID}`)).status).toBe(404);
    });

    it('does not report deactivation success when the linked identity changes after lookup', async () => {
      queryMock.mockResolvedValueOnce({ rows: [linkedRow()] });
      queryMock.mockResolvedValueOnce({ rows: [] });

      const res = await send('DELETE', `/Users/${LOCAL_ID}`);

      expect(res.status).toBe(409);
      expect(res.headers.get('content-type')).toContain(SCIM_CONTENT_TYPE);
      expect(queryMock.mock.calls[1][1]).toEqual([LOCAL_ID, TENANT, OBJECT_ID]);
      expect(logUserActivityMock).not.toHaveBeenCalled();
    });
  });
});
