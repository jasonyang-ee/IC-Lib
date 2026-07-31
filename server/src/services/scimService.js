/**
 * §V60: optional Entra SCIM provisioning configuration.
 *
 * Two environment variables control the whole feature:
 *   SCIM_TENANT_ID    - the single Entra tenant GUID allowed to provision
 *   SCIM_BEARER_TOKEN - the shared secret Entra sends as its Secret Token
 *
 * Both absent means the feature is off. Anything in between - one set, a
 * malformed GUID, a token short enough to be guessable - is a misconfiguration
 * and must stop the server rather than quietly serve a provisioning endpoint
 * with a weak or ambiguous credential. The token value is never logged.
 */

export const SCIM_BASE_PATH = '/api/scim/v2';
export const SCIM_CONTENT_TYPE = 'application/scim+json';
export const MIN_SCIM_TOKEN_LENGTH = 32;

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const readSetting = (name) => {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
};

export const getScimTenantId = () => readSetting('SCIM_TENANT_ID');
export const getScimBearerToken = () => readSetting('SCIM_BEARER_TOKEN');

/** True only when both settings are present. Validity is a separate question. */
export const isScimEnabled = () => Boolean(getScimTenantId() && getScimBearerToken());

/**
 * Validate the configuration at startup.
 *
 * @returns {{enabled: boolean, errors: string[]}} errors is non-empty only for
 *          a partial or invalid configuration, never for a disabled one.
 */
export const validateScimConfiguration = () => {
  const tenantId = getScimTenantId();
  const token = getScimBearerToken();
  const errors = [];

  if (!tenantId && !token) {
    return { enabled: false, errors };
  }

  if (!tenantId) {
    errors.push('SCIM_BEARER_TOKEN is set but SCIM_TENANT_ID is missing');
  } else if (!GUID_PATTERN.test(tenantId)) {
    errors.push('SCIM_TENANT_ID must be a tenant GUID');
  }

  if (!token) {
    errors.push('SCIM_TENANT_ID is set but SCIM_BEARER_TOKEN is missing');
  } else if (token.length < MIN_SCIM_TOKEN_LENGTH) {
    // Length only - the value itself never appears in an error or a log.
    errors.push(`SCIM_BEARER_TOKEN must be at least ${MIN_SCIM_TOKEN_LENGTH} characters`);
  }

  return { enabled: errors.length === 0, errors };
};
