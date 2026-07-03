import { beforeEach, describe, expect, it } from 'vitest';
import {
  isString,
  loadSessionValue,
  loadViewPrefs,
  oneOf,
  saveSessionValue,
  saveViewPrefs,
  subsetOf,
} from '../utils/viewPrefs';

// In-memory Storage stand-in (the jsdom/node ambient localStorage is partial)
const memStorage = () => {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
  };
};

const VALIDATORS = {
  sortBy: oneOf(['part_number', 'updated_at']),
  sortOrder: oneOf(['asc', 'desc']),
  statuses: subsetOf(['new', 'production']),
  category: isString,
};

describe('viewPrefs', () => {
  let storage;

  beforeEach(() => {
    storage = memStorage();
  });

  it('round-trips valid prefs', () => {
    saveViewPrefs('viewPrefs:test', {
      sortBy: 'updated_at',
      sortOrder: 'desc',
      statuses: ['new'],
      category: 'abc-123',
    }, storage);

    expect(loadViewPrefs('viewPrefs:test', VALIDATORS, storage)).toEqual({
      sortBy: 'updated_at',
      sortOrder: 'desc',
      statuses: ['new'],
      category: 'abc-123',
    });
  });

  it('returns {} for missing or corrupt JSON', () => {
    expect(loadViewPrefs('viewPrefs:missing', VALIDATORS, storage)).toEqual({});

    storage.setItem('viewPrefs:test', '{not json');
    expect(loadViewPrefs('viewPrefs:test', VALIDATORS, storage)).toEqual({});

    storage.setItem('viewPrefs:test', '"a string"');
    expect(loadViewPrefs('viewPrefs:test', VALIDATORS, storage)).toEqual({});

    storage.setItem('viewPrefs:test', '[1,2]');
    expect(loadViewPrefs('viewPrefs:test', VALIDATORS, storage)).toEqual({});
  });

  it('drops non-whitelisted keys and invalid values', () => {
    storage.setItem('viewPrefs:test', JSON.stringify({
      sortBy: 'evil_column',
      sortOrder: 'desc',
      statuses: ['new', 'bogus'],
      category: 42,
      injected: 'x',
    }));

    expect(loadViewPrefs('viewPrefs:test', VALIDATORS, storage)).toEqual({ sortOrder: 'desc' });
  });

  it('survives a throwing storage backend', () => {
    const broken = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('quota'); },
    };

    expect(loadViewPrefs('viewPrefs:test', VALIDATORS, broken)).toEqual({});
    expect(() => saveViewPrefs('viewPrefs:test', { sortOrder: 'asc' }, broken)).not.toThrow();
    expect(loadSessionValue('k', broken)).toBe('');
    expect(() => saveSessionValue('k', 'v', broken)).not.toThrow();
  });

  it('round-trips session values and normalizes nullish to empty string', () => {
    saveSessionValue('viewPrefs:test:search', 'DS2431+', storage);
    expect(loadSessionValue('viewPrefs:test:search', storage)).toBe('DS2431+');

    saveSessionValue('viewPrefs:test:search', null, storage);
    expect(loadSessionValue('viewPrefs:test:search', storage)).toBe('');

    expect(loadSessionValue('viewPrefs:never-set', storage)).toBe('');
  });
});
