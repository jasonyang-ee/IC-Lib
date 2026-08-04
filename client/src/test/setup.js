/* eslint-disable no-undef */
import '@testing-library/jest-dom';

// View preferences (category, sort, status filters) persist to localStorage via
// src/utils/viewPrefs.js, so a filter toggled in one test is restored by the
// next page render and silently changes what the list contains. Node >=22 also
// injects a partially implemented global localStorage that shadows jsdom's, so
// the same leak shows up on CI (Node 20) but not on a newer local Node. Install
// one deterministic in-memory store for both, fresh per test.
const createTestStorage = () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(String(key)) ? store.get(String(key)) : null),
    setItem: (key, value) => { store.set(String(key), String(value)); },
    removeItem: (key) => { store.delete(String(key)); },
    clear: () => { store.clear(); },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  };
};

beforeEach(() => {
  for (const name of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(window, name, {
      configurable: true,
      writable: true,
      value: createTestStorage(),
    });
  }
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
