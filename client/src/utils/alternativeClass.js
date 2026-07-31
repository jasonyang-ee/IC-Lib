// §V59: the alternative criticality class is a nullable domain of A/B/C.
// The server stores and validates the bare letter and stays display-neutral
// (server/src/constants/alternativeClass.js); every human-facing label and
// description lives here so the UI reads the same everywhere.
//
// A select cannot hold null, so the unrated choice uses the empty string as
// its form value. Nothing outside this module should send that empty string
// to the API - `toAlternativeClassPayload` maps it back to null, which is
// what the server reads as "clear the stored class".

export const UNRATED_LABEL = 'Unrated';

export const ALTERNATIVE_CLASS_OPTIONS = Object.freeze([
  Object.freeze({
    value: '',
    label: UNRATED_LABEL,
    description: 'Not yet rated. Treated as Class A until a rating is assigned.',
  }),
  Object.freeze({
    value: 'A',
    label: 'Class A',
    description: 'Substitute only with direct approval.',
  }),
  Object.freeze({
    value: 'B',
    label: 'Class B',
    description: 'Substitute per drawing notes.',
  }),
  Object.freeze({
    value: 'C',
    label: 'Class C',
    description: 'Substitute by component value.',
  }),
]);

const optionFor = (value) => {
  if (typeof value !== 'string') return null;
  return ALTERNATIVE_CLASS_OPTIONS.find((option) => option.value === value.trim().toUpperCase()) || null;
};

/** Display label for a stored class. Anything unrecognised reads as Unrated. */
export const formatAlternativeClass = (value) => optionFor(value)?.label ?? UNRATED_LABEL;

/** Substitution rule behind a stored class, for tooltips and advisories. */
export const describeAlternativeClass = (value) => (
  optionFor(value)?.description ?? ALTERNATIVE_CLASS_OPTIONS[0].description
);

/** Form value for a stored class: '' for unrated/unknown, else the letter. */
export const toAlternativeClassValue = (value) => optionFor(value)?.value ?? '';

/** API payload for a form value: null clears the class, never an empty string. */
export const toAlternativeClassPayload = (value) => toAlternativeClassValue(value) || null;
