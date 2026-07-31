import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// §V60: the SCIM feature is enabled only by a valid tenant GUID plus a token
// long enough to be worth calling a secret. A partial or invalid setting must
// stop the server rather than expose provisioning behind a weak credential,
// and the token value must never appear in an error, a log, or a response.

const VALID_TENANT = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const VALID_TOKEN = 'a'.repeat(48);

const {
  isScimEnabled,
  validateScimConfiguration,
  MIN_SCIM_TOKEN_LENGTH,
} = await import('../services/scimService.js');
const { authenticateScim } = await import('../middleware/scimAuth.js');

const configure = ({ tenant, token }) => {
  if (tenant === undefined) delete process.env.SCIM_TENANT_ID;
  else process.env.SCIM_TENANT_ID = tenant;
  if (token === undefined) delete process.env.SCIM_BEARER_TOKEN;
  else process.env.SCIM_BEARER_TOKEN = token;
};

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.type = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.set = vi.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => configure({}));
afterEach(() => configure({}));

describe('SCIM configuration (§V60)', () => {
  it('is disabled, not broken, when neither variable is set', () => {
    expect(validateScimConfiguration()).toEqual({ enabled: false, errors: [] });
    expect(isScimEnabled()).toBe(false);
  });

  it('is enabled by a tenant GUID and a long enough token', () => {
    configure({ tenant: VALID_TENANT, token: VALID_TOKEN });

    expect(validateScimConfiguration()).toEqual({ enabled: true, errors: [] });
    expect(isScimEnabled()).toBe(true);
  });

  it('refuses a half-configured feature', () => {
    configure({ tenant: VALID_TENANT });
    expect(validateScimConfiguration().errors).toHaveLength(1);

    configure({ token: VALID_TOKEN });
    expect(validateScimConfiguration().errors).toHaveLength(1);
  });

  it('refuses a tenant id that is not a GUID', () => {
    configure({ tenant: 'contoso.onmicrosoft.com', token: VALID_TOKEN });

    const { enabled, errors } = validateScimConfiguration();
    expect(enabled).toBe(false);
    expect(errors[0]).toMatch(/tenant GUID/);
  });

  it(`refuses a token shorter than ${MIN_SCIM_TOKEN_LENGTH} characters`, () => {
    configure({ tenant: VALID_TENANT, token: 'a'.repeat(MIN_SCIM_TOKEN_LENGTH - 1) });

    const { enabled, errors } = validateScimConfiguration();
    expect(enabled).toBe(false);
    expect(errors[0]).toMatch(/at least/);
  });

  it('never puts the token value in an error message', () => {
    configure({ tenant: VALID_TENANT, token: 'short-secret' });

    expect(validateScimConfiguration().errors.join(' ')).not.toContain('short-secret');
  });
});

describe('authenticateScim (§V27/§V60)', () => {
  const call = (headers = {}) => {
    const res = mockRes();
    const next = vi.fn();
    authenticateScim({ headers }, res, next);
    return { res, next };
  };

  it('admits the exact configured token', () => {
    configure({ tenant: VALID_TENANT, token: VALID_TOKEN });

    const { res, next } = call({ authorization: `Bearer ${VALID_TOKEN}` });

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects a wrong token of the same length', () => {
    configure({ tenant: VALID_TENANT, token: VALID_TOKEN });

    const { res, next } = call({ authorization: `Bearer ${'b'.repeat(48)}` });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects a token of a different length without throwing', () => {
    configure({ tenant: VALID_TENANT, token: VALID_TOKEN });

    const { res, next } = call({ authorization: 'Bearer short' });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects a missing header and asks for Bearer', () => {
    configure({ tenant: VALID_TENANT, token: VALID_TOKEN });

    const { res, next } = call();

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.set).toHaveBeenCalledWith('WWW-Authenticate', 'Bearer realm="scim"');
  });

  it('has no cookie fallback: a browser session cannot drive provisioning', () => {
    configure({ tenant: VALID_TENANT, token: VALID_TOKEN });

    const res = mockRes();
    const next = vi.fn();
    authenticateScim({ headers: {}, cookies: { token: VALID_TOKEN } }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('answers 404 while disabled, so the endpoint is not discoverable', () => {
    const { res, next } = call({ authorization: `Bearer ${VALID_TOKEN}` });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('replies in the SCIM media type and never echoes the token', () => {
    configure({ tenant: VALID_TENANT, token: VALID_TOKEN });

    const { res } = call({ authorization: 'Bearer wrong' });

    expect(res.type).toHaveBeenCalledWith('application/scim+json');
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain(VALID_TOKEN);
  });
});
