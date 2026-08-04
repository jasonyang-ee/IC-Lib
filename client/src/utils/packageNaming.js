/**
 * Package naming rules (mirror of server `utils/packageNaming.js`): catalog
 * aliases resolve case- and separator-insensitively; IPC density letters map
 * M=A, N=B, L=C; canonical count handling comes from each catalog row.
 *
 * What must match the server is the behaviour at every supported user input
 * boundary (§V61/§V62), not the helper algorithm. The client has no database,
 * so callers supply catalog rows while server callers obtain them from storage.
 */
const COUNT_POLICIES = new Set(['chip', 'embedded', 'none', 'append']);
const DENSITY_SUFFIX_PATTERN = /^(.*?)(?:[_-])([ABCMLN])$/i;
const IPC_DIMENSIONAL_PATTERN = /^([A-Za-z]{3,6})\d+P\d+(?:X\d+)+-(\d+)([MNL])?$/i;
const IPC_UNSUPPORTED_VARIANT_PATTERN = /^[A-Za-z]{3,6}\d+P\d+(?:X\d+)+-(?:\d+_\d+|\d+R)[MNL]$/i;
const DIMENSIONAL_NOTE_PATTERN = /\s*\((?=[^)]*(?:mm|cm|mil|inch|inches|width|height|length|pitch|dia|diameter|body|thick|od|id|["']))[^)]*\)\s*$/i;
const PACKAGE_ALIAS_SEPARATOR = /[;,]/;
const MODIFIER_STOPLIST = ['exposed pad', 'e-pad', 'ep', 'thin', 'wide', 'narrow', 'shrink'];

/** Fold catalog aliases exactly as PostgreSQL's generated `alias_key` does. */
export const foldAliasKey = (value) => String(value || '').trim().replace(/[^A-Za-z0-9]/g, '').toLowerCase();

/**
 * IPC-7351B material-condition letters are semantic, not alphabetic: M=A,
 * N=B, L=C (SPEC R18).
 */
export const remapDensity = (letter) => {
  const normalized = String(letter || '').trim().toUpperCase();
  return ({ M: 'A', N: 'B', L: 'C', A: 'A', B: 'B', C: 'C' })[normalized] || null;
};

export const buildCanonicalName = ({ shortName, pinCount, density, countPolicy }) => {
  const normalizedShortName = String(shortName || '').trim();
  if (!normalizedShortName || !COUNT_POLICIES.has(countPolicy)) return null;

  let baseName = normalizedShortName;
  if (countPolicy === 'append') {
    const normalizedPinCount = String(pinCount || '').trim();
    if (!/^\d+$/.test(normalizedPinCount)) return null;
    baseName = `${normalizedShortName}-${normalizedPinCount}`;
  }

  const normalizedDensity = remapDensity(density);
  return normalizedDensity ? `${baseName}_${normalizedDensity}` : baseName;
};

const embeddedPinCount = (shortName) => shortName.match(/-(\d+)$/)?.[1] || null;

const sanitizePackageInput = (raw) => {
  let value = String(raw || '').trim();
  while (DIMENSIONAL_NOTE_PATTERN.test(value)) {
    value = value.replace(DIMENSIONAL_NOTE_PATTERN, '').trim();
  }
  return value;
};

const createAliasIndex = (catalog) => {
  const aliases = new Map();
  for (const packageRow of Array.isArray(catalog) ? catalog : []) {
    for (const alias of [packageRow?.short_name, ...(packageRow?.aliases || []).map(entry => entry?.alias || entry)]) {
      const aliasKey = foldAliasKey(alias);
      if (aliasKey) aliases.set(aliasKey, packageRow);
    }
  }
  return aliases;
};

const packageResult = (packageRow, pinCount, matchedAliasKey, modifiers = []) => ({
  shortName: packageRow.short_name,
  pinCount: pinCount || (packageRow.count_policy === 'embedded' ? embeddedPinCount(packageRow.short_name) : null),
  modifiers,
  matchedAliasKey,
});

const resolveAliasCandidate = (token, aliases, allowModifier = true) => {
  const directKey = foldAliasKey(token);
  const direct = aliases.get(directKey);
  if (direct) return packageResult(direct, null, directKey);

  const leadingCount = token.match(/^(\d+)[-\s](.+)$/);
  if (leadingCount) {
    const aliasKey = foldAliasKey(leadingCount[2]);
    const packageRow = aliases.get(aliasKey);
    if (packageRow) return packageResult(packageRow, leadingCount[1], aliasKey);
  }

  // The separator is optional: filenames drop it (`soic8`) where vendor
  // strings keep it (`SOIC-8`).
  const trailingCount = token.match(/^(.+?)-?(\d+)$/);
  if (trailingCount) {
    const aliasKey = foldAliasKey(trailingCount[1]);
    const packageRow = aliases.get(aliasKey);
    if (packageRow) return packageResult(packageRow, trailingCount[2], aliasKey);
  }

  if (allowModifier) {
    const modifier = MODIFIER_STOPLIST.find(entry => new RegExp(`\\s+${entry.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i').test(token));
    if (modifier) {
      const stripped = token.replace(new RegExp(`\\s+${modifier.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i'), '').trim();
      const resolved = resolveAliasCandidate(stripped, aliases, false);
      if (resolved) return { ...resolved, modifiers: [modifier] };
    }
  }

  return null;
};

/**
 * Extract package identity tokens without catalog or database access. Catalog
 * resolution stays with the caller; this utility only exposes a folded lookup
 * key for the parsed short name.
 */
export const parsePackageInput = (raw, catalog = []) => {
  const input = sanitizePackageInput(raw);
  if (!input || input.toUpperCase() === 'N/A') return null;

  const aliases = createAliasIndex(catalog);
  for (const token of input.split(PACKAGE_ALIAS_SEPARATOR).map(value => value.trim()).filter(Boolean)) {
    if (IPC_UNSUPPORTED_VARIANT_PATTERN.test(token)) return null;

    let value = token;
    let density = null;
    const densityMatch = value.match(DENSITY_SUFFIX_PATTERN);
    if (densityMatch) {
      value = densityMatch[1].trim();
      density = remapDensity(densityMatch[2]);
    }

    const resolved = resolveAliasCandidate(value, aliases);
    if (resolved) return { ...resolved, density };

    const ipcMatch = token.match(IPC_DIMENSIONAL_PATTERN);
    if (ipcMatch && (ipcMatch[1].toUpperCase() === 'BGA' || ipcMatch[3])) {
      const shortName = ipcMatch[1].toUpperCase();
      return {
        shortName,
        pinCount: ipcMatch[2],
        density: remapDensity(ipcMatch[3]),
        modifiers: [],
        matchedAliasKey: foldAliasKey(shortName),
      };
    }
  }

  const densityMatch = input.match(DENSITY_SUFFIX_PATTERN);
  const value = densityMatch ? densityMatch[1].trim() : input;
  const trailingCount = value.match(/^(.+?)-(\d+)$/);
  const shortName = (trailingCount ? trailingCount[1] : value).trim();
  return {
    shortName,
    pinCount: trailingCount ? trailingCount[2] : null,
    density: densityMatch ? remapDensity(densityMatch[2]) : null,
    modifiers: [],
    matchedAliasKey: foldAliasKey(shortName),
  };
};
