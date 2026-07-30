// §V59: the alternative criticality class is a nullable closed domain. This
// list is the single source of truth for the API boundary check; the DB CHECK
// constraints (migration 18 + init-schema.sql) mirror it and are the backstop.
// Values are stored display-neutral - the client owns the human labels
// ("Class A", "Unrated", and the substitution rules behind them).
export const ALTERNATIVE_CLASSES = Object.freeze(['A', 'B', 'C']);

export const ALTERNATIVE_CLASS_ERROR_MESSAGE =
  'alt_class must be A, B, or C, or null to clear it';

/**
 * Normalize a caller-supplied alternative class.
 *
 * Omission and an explicit null are deliberately distinguished: on update,
 * an absent field preserves the stored value while an explicit null (or a
 * blank string, which is what an emptied form control sends) clears it.
 * Callers branch on `provided` to tell those apart.
 *
 * @returns {{ok: true, provided: boolean, value: string|null}
 *          |{ok: false, message: string}}
 */
export function normalizeAlternativeClass(rawValue) {
  if (rawValue === undefined) {
    return { ok: true, provided: false, value: null };
  }

  if (rawValue === null) {
    return { ok: true, provided: true, value: null };
  }

  if (typeof rawValue !== 'string') {
    return { ok: false, message: ALTERNATIVE_CLASS_ERROR_MESSAGE };
  }

  const trimmed = rawValue.trim();
  if (trimmed === '') {
    return { ok: true, provided: true, value: null };
  }

  const canonical = trimmed.toUpperCase();
  if (!ALTERNATIVE_CLASSES.includes(canonical)) {
    return { ok: false, message: ALTERNATIVE_CLASS_ERROR_MESSAGE };
  }

  return { ok: true, provided: true, value: canonical };
}
