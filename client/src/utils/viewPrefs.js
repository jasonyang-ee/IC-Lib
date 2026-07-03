/**
 * Per-browser persistence for page view preferences (sort, filters) around
 * localStorage, plus a per-tab sessionStorage helper for search terms.
 *
 * Stored values are never trusted: loadViewPrefs runs each stored key through
 * a caller-supplied validator and silently drops anything unknown or invalid,
 * so a corrupt or legacy blob can never break a page — the page just falls
 * back to its defaults.
 */

// Validator builders
export const oneOf = (values) => (value) => values.includes(value);
export const subsetOf = (values) => (value) =>
  Array.isArray(value) && value.every((entry) => values.includes(entry));
export const isString = (value) => typeof value === 'string';

const safeParseObject = (json) => {
  try {
    const value = JSON.parse(json);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
};

/**
 * Load persisted prefs for `key`. `validators` maps pref name -> predicate;
 * only entries present in the map AND passing their predicate are returned.
 */
export const loadViewPrefs = (key, validators, storage = window.localStorage) => {
  let stored = null;
  try {
    stored = safeParseObject(storage.getItem(key));
  } catch {
    return {};
  }
  if (!stored) return {};

  const prefs = {};
  for (const [name, isValid] of Object.entries(validators)) {
    if (name in stored && isValid(stored[name])) {
      prefs[name] = stored[name];
    }
  }
  return prefs;
};

export const saveViewPrefs = (key, prefs, storage = window.localStorage) => {
  try {
    storage.setItem(key, JSON.stringify(prefs));
  } catch {
    // Quota exceeded / private mode: prefs simply don't persist
  }
};

/** Per-tab string value (e.g. a search term that should survive navigation). */
export const loadSessionValue = (key, storage = window.sessionStorage) => {
  try {
    return storage.getItem(key) ?? '';
  } catch {
    return '';
  }
};

export const saveSessionValue = (key, value, storage = window.sessionStorage) => {
  try {
    storage.setItem(key, String(value ?? ''));
  } catch {
    // Best-effort only
  }
};
