import path from 'path';
import { describe, expect, it } from 'vitest';
import { assertSafeLeafName, resolvePathWithinBase } from '../utils/safeFsPaths.js';

describe('safeFsPaths', () => {
  it('accepts regular file names', () => {
    expect(assertSafeLeafName('part-file.step')).toBe('part-file.step');
  });

  it('rejects traversal and nested paths', () => {
    expect(() => assertSafeLeafName('../secret.txt')).toThrow('Invalid filename');
    expect(() => assertSafeLeafName('nested/file.txt')).toThrow('Invalid filename');
    expect(() => assertSafeLeafName('nested\\file.txt')).toThrow('Invalid filename');
  });

  it('resolves paths only within the requested base directory', () => {
    const baseDir = path.join('tmp', 'library');

    expect(resolvePathWithinBase(baseDir, 'footprint', 'part-file.step')).toContain(path.join('tmp', 'library', 'footprint'));
    expect(() => resolvePathWithinBase(baseDir, '..', 'escape.txt')).toThrow('Resolved path escapes base directory');
  });
});