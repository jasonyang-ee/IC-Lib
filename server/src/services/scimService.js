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

export const SCIM_USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';
const SCIM_LIST_RESPONSE_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Return the canonical lowercase form, or null for a non-GUID value. */
export const canonicalizeScimGuid = (value) => (
  typeof value === 'string' && GUID_PATTERN.test(value) ? value.toLowerCase() : null
);

const readSetting = (name) => {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
};

export const getScimTenantId = () => canonicalizeScimGuid(readSetting('SCIM_TENANT_ID'));
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
  const tenantRaw = readSetting('SCIM_TENANT_ID');
  const tenantId = canonicalizeScimGuid(tenantRaw);
  const token = getScimBearerToken();
  const errors = [];

  if (!tenantRaw && !token) {
    return { enabled: false, errors };
  }

  if (!tenantRaw) {
    errors.push('SCIM_BEARER_TOKEN is set but SCIM_TENANT_ID is missing');
  } else if (!tenantId) {
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

/** Local `users.id` values are UUIDs; anything else can never name a row. */
export const isUuid = value => Boolean(canonicalizeScimGuid(value));

/**
 * §V60: the SCIM representation of a linked user. `id` is the retained local
 * `users.id` and `externalId` is the immutable Entra `objectId` - the sole
 * matching property. Role, password and OIDC keys are local concerns and are
 * deliberately absent from the wire format. A deactivated user is still a user:
 * it is returned with `active: false`, never hidden.
 */
export const toScimUser = (row) => {
  const user = {
    schemas: [SCIM_USER_SCHEMA],
    id: row.id,
    externalId: canonicalizeScimGuid(row.oidc_object_id) || row.oidc_object_id,
    userName: row.username,
    active: row.is_active !== false,
    meta: {
      resourceType: 'User',
      location: `${SCIM_BASE_PATH}/Users/${row.id}`,
    },
  };

  if (row.display_name) {
    user.displayName = row.display_name;
    user.name = { formatted: row.display_name };
  }

  if (row.email) {
    user.emails = [{ value: row.email, type: 'work', primary: true }];
  }

  return user;
};

export const toScimListResponse = (resources) => ({
  schemas: [SCIM_LIST_RESPONSE_SCHEMA],
  totalResults: resources.length,
  itemsPerPage: resources.length,
  startIndex: 1,
  Resources: resources,
});

const EXTERNAL_ID_FILTER = /^externalId\s+eq\s+"([^"]*)"$/i;

/**
 * Entra's user lookup is always `externalId eq "<objectId>"`, and that is the
 * only filter this provider claims to support. Anything else - another
 * attribute, another operator, a missing filter - is refused rather than
 * silently widened into a query that could enumerate users.
 *
 * @returns {{externalId: string}|{error: string}}
 */
export const parseUserFilter = (filter) => {
  if (typeof filter !== 'string' || filter.trim() === '') {
    return { error: 'A filter is required: externalId eq "<objectId>"' };
  }

  const match = EXTERNAL_ID_FILTER.exec(filter.trim());
  if (!match) {
    return { error: 'Only the filter externalId eq "<objectId>" is supported' };
  }

  const externalId = canonicalizeScimGuid(match[1]);
  return externalId
    ? { externalId }
    : { error: 'The externalId filter must contain a GUID' };
};

/**
 * The only four columns SCIM may write (§V57/§V60). Role, password, auth
 * provider and the OIDC keys are locally owned and are refused rather than
 * ignored, so a mis-mapped attribute in Entra fails loudly instead of silently
 * doing nothing.
 */
const WRITABLE = new Map([
  ['username', 'username'],
  ['displayname', 'display_name'],
  ['name.formatted', 'display_name'],
  ['emails', 'email'],
  ['emails.value', 'email'],
  ['active', 'is_active'],
]);

const REFUSED = new Map([
  ['id', 'mutability'],
  ['externalid', 'mutability'],
  ['meta', 'mutability'],
]);

const POST_READ_ONLY = new Set(['id', 'meta']);
const SENSITIVE_FIRST_SEGMENTS = new Set([
  'role',
  'roles',
  'password',
  'password_hash',
  'authprovider',
  'auth_provider',
]);

const MAX_LENGTH = { username: 50, display_name: 100, email: 255 };

/** `emails[type eq "work"].value` and `emails.value` name the same column. */
const normalizeAttributePath = (path) => String(path).trim().replace(/\[[^\]]*\]/g, '').toLowerCase();

const refuse = (detail, scimType = 'invalidValue') => ({ error: { detail, scimType } });

export const getScimAttribute = (resource, name) => {
  if (!resource || typeof resource !== 'object' || Array.isArray(resource)) {
    return { present: false, value: undefined };
  }

  const attributes = new Set();
  for (const [attribute] of Object.entries(resource)) {
    const normalizedAttribute = attribute.toLowerCase();
    if (attributes.has(normalizedAttribute)) {
      return refuse(`Duplicate case variants for ${attribute}`);
    }
    attributes.add(normalizedAttribute);
  }

  const match = Object.entries(resource)
    .find(([attribute]) => attribute.toLowerCase() === name.toLowerCase());
  return match
    ? { present: true, value: match[1] }
    : { present: false, value: undefined };
};

const firstEmailValue = (value) => {
  if (!Array.isArray(value)) return { value };
  const emails = [];
  for (const entry of value) {
    const primary = getScimAttribute(entry, 'primary');
    const email = getScimAttribute(entry, 'value');
    if (primary.error || email.error) return primary.error ? primary : email;
    emails.push({ primary: primary.value === true, value: email.value });
  }
  const selected = emails.find(entry => entry.primary) || emails.find(entry => entry.value !== undefined);
  return { value: selected ? selected.value : null };
};

/**
 * Coerce one attribute into its column value, or explain why it cannot be.
 * `active` accepts Entra's string booleans; the nullable profile columns accept
 * an explicit null (that is how Remove clears them), and `username`/`active`
 * never may be null because the local row cannot serve without them.
 */
const coerce = (column, rawValue) => {
  const email = column === 'email' ? firstEmailValue(rawValue) : { value: rawValue };
  if (email.error) return email;
  const { value } = email;

  if (column === 'is_active') {
    if (typeof value === 'boolean') return { value };
    if (typeof value === 'string' && /^(true|false)$/i.test(value.trim())) {
      return { value: value.trim().toLowerCase() === 'true' };
    }
    return refuse('active must be a boolean');
  }

  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    if (column === 'username') return refuse('userName is required and cannot be cleared');
    return { value: null };
  }

  if (typeof value !== 'string') return refuse(`${column} must be a string`);

  const trimmed = value.trim();
  if (trimmed.length > MAX_LENGTH[column]) {
    return refuse(`${column} exceeds ${MAX_LENGTH[column]} characters`);
  }

  return { value: trimmed };
};

const assign = (changes, path, rawValue, mode = 'patch') => {
  const attribute = normalizeAttributePath(path);
  const firstSegment = attribute.split('.')[0];

  if (mode === 'post' && POST_READ_ONLY.has(attribute)) {
    return { changes };
  }

  if (firstSegment === 'externalid') {
    return refuse(`${path} is not writable through SCIM`, 'mutability');
  }

  if (mode === 'patch' && POST_READ_ONLY.has(firstSegment)) {
    return refuse(`${path} is not writable through SCIM`, 'mutability');
  }

  if (firstSegment.startsWith('oidc') || SENSITIVE_FIRST_SEGMENTS.has(firstSegment)) {
    return refuse('OIDC identity keys are owned by the application', 'invalidValue');
  }

  const refusedType = REFUSED.get(attribute);
  if (refusedType) {
    return refuse(`${path} is not writable through SCIM`, refusedType);
  }

  const column = WRITABLE.get(attribute);
  // Anything else is an attribute this provider does not store. Ignoring it
  // keeps Entra's default (broader) user mapping working; it can never reach a
  // column, because only WRITABLE names one.
  if (!column) return { changes };

  const coerced = coerce(column, rawValue);
  if (coerced.error) return coerced;

  return { changes: { ...changes, [column]: coerced.value } };
};

/** Attributes of a SCIM User resource (POST body) -> column changes. */
export const parseScimResource = (resource, mode = 'post') => {
  if (!resource || typeof resource !== 'object') {
    return refuse('A SCIM User resource is required');
  }

  let changes = {};
  const attributes = new Set();
  for (const [attribute, value] of Object.entries(resource)) {
    const normalizedAttribute = attribute.toLowerCase();
    if (attributes.has(normalizedAttribute)) {
      return refuse(`Duplicate case variants for ${attribute}`);
    }
    attributes.add(normalizedAttribute);
    if (normalizedAttribute === 'schemas') continue;
    if (mode === 'post' && normalizedAttribute === 'roles' && Array.isArray(value) && value.length === 0) {
      continue;
    }
    if (normalizedAttribute === 'name') {
      const formatted = getScimAttribute(value, 'formatted');
      if (formatted.error) return formatted;
      if (!formatted.present) continue;
      const step = assign(changes, 'name.formatted', formatted.value, mode);
      if (step.error) return step;
      changes = step.changes;
      continue;
    }
    const step = assign(changes, attribute, value, mode);
    if (step.error) return step;
    changes = step.changes;
  }

  return { changes };
};

/**
 * A PATCH body -> column changes. Operation names are case-insensitive, Add and
 * Replace behave identically on these single-valued attributes, and a pathless
 * operation carries an object of attributes. Remove clears a nullable profile
 * column and is refused for the required ones.
 */
export const parseScimPatch = (body) => {
  const operationsField = getScimAttribute(body, 'operations');
  if (operationsField.error) return operationsField;
  const operations = operationsField.value;
  if (!Array.isArray(operations) || operations.length === 0) {
    return refuse('A PATCH body must carry at least one operation', 'invalidSyntax');
  }

  let changes = {};
  for (const operation of operations) {
    const opField = getScimAttribute(operation, 'op');
    const pathField = getScimAttribute(operation, 'path');
    const valueField = getScimAttribute(operation, 'value');
    if (opField.error || pathField.error || valueField.error) {
      return opField.error ? opField : pathField.error ? pathField : valueField;
    }
    const op = String(opField.value ?? '').trim().toLowerCase();
    if (!['add', 'replace', 'remove'].includes(op)) {
      return refuse(`Unsupported PATCH operation "${operation?.op}"`, 'invalidSyntax');
    }

    if (op === 'remove') {
      if (!pathField.value) return refuse('Remove requires a path', 'invalidSyntax');
      const attribute = normalizeAttributePath(pathField.value);
      if (attribute === 'username' || attribute === 'active') {
        return refuse(`${pathField.value} is required and cannot be removed`);
      }
      const step = assign(changes, pathField.value, null);
      if (step.error) return step;
      changes = step.changes;
      continue;
    }

    if (!pathField.present || !pathField.value) {
      const step = parseScimResource(valueField.value, 'patch');
      if (step.error) return step;
      changes = { ...changes, ...step.changes };
      continue;
    }

    const step = assign(changes, pathField.value, valueField.value);
    if (step.error) return step;
    changes = step.changes;
  }

  return { changes };
};
