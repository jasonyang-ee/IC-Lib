import { describe, expect, it } from 'vitest';
import {
  ALTERNATIVE_CLASSES,
  ALTERNATIVE_CLASS_ERROR_MESSAGE,
  normalizeAlternativeClass,
} from '../constants/alternativeClass.js';

describe('normalizeAlternativeClass (§V59)', () => {
  it('exposes exactly the A/B/C domain, frozen', () => {
    expect(ALTERNATIVE_CLASSES).toEqual(['A', 'B', 'C']);
    expect(Object.isFrozen(ALTERNATIVE_CLASSES)).toBe(true);
  });

  it('treats an omitted field as "no change"', () => {
    expect(normalizeAlternativeClass(undefined)).toEqual({
      ok: true,
      provided: false,
      value: null,
    });
  });

  it.each([
    ['explicit null', null],
    ['empty string', ''],
    ['whitespace only', '   '],
  ])('treats %s as an explicit clear', (_label, input) => {
    expect(normalizeAlternativeClass(input)).toEqual({
      ok: true,
      provided: true,
      value: null,
    });
  });

  it.each(['A', 'B', 'C'])('accepts canonical %s', (input) => {
    expect(normalizeAlternativeClass(input)).toEqual({
      ok: true,
      provided: true,
      value: input,
    });
  });

  it.each([
    ['a', 'A'],
    ['b', 'B'],
    ['c', 'C'],
    ['  a  ', 'A'],
  ])('canonicalizes %s to %s', (input, expected) => {
    expect(normalizeAlternativeClass(input)).toEqual({
      ok: true,
      provided: true,
      value: expected,
    });
  });

  it.each([
    ['out-of-domain letter', 'D'],
    ['multi-character', 'AB'],
    ['label rather than value', 'Class A'],
    ['display fallback', 'Unrated'],
    ['number', 1],
    ['boolean', true],
    ['array', ['A']],
    ['object', { value: 'A' }],
  ])('rejects %s', (_label, input) => {
    expect(normalizeAlternativeClass(input)).toEqual({
      ok: false,
      message: ALTERNATIVE_CLASS_ERROR_MESSAGE,
    });
  });

  it('never returns a value outside the domain when it succeeds', () => {
    const corpus = [undefined, null, '', ' ', 'a', 'A', 'b', 'B', 'c', 'C', 'D', 'AB', 7, {}];

    const acceptedValues = corpus
      .map(input => normalizeAlternativeClass(input))
      .filter(result => result.ok)
      .map(result => result.value);

    expect(acceptedValues.length).toBeGreaterThan(0);
    expect(acceptedValues.filter(value => value !== null && !ALTERNATIVE_CLASSES.includes(value)))
      .toEqual([]);
  });
});
