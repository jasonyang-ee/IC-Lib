import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const readRepoBytes = (...segments) => fs.readFileSync(path.join(repoRoot, ...segments));

const trackedShebangPaths = execFileSync('git', ['ls-files', '-z'], {
  cwd: repoRoot,
})
  .toString('utf8')
  .split('\0')
  .filter(Boolean)
  .filter((filePath) => readRepoBytes(...filePath.split('/')).subarray(0, 2).toString() === '#!');

describe('repository text policy', () => {
  it('declares LF text, binary families, and executable entrypoints', () => {
    const attributes = readRepoBytes('.gitattributes').toString('utf8');

    expect(attributes).toContain('* text=auto eol=lf\n');
    expect(attributes).toContain('*.msi binary\n');
    expect(attributes).toContain('*.reg binary\n');
    expect(attributes).toContain('*.sh text eol=lf\n');
    expect(attributes).toContain('docker/repair text eol=lf\n');
    expect(attributes).toContain('Dockerfile text eol=lf\n');
  });

  it('keeps every executable shebang free of CR and repair starts with LF shebang', () => {
    expect(trackedShebangPaths).toContain('docker/repair');

    for (const filePath of trackedShebangPaths) {
      const bytes = readRepoBytes(...filePath.split('/'));
      const firstLine = bytes.subarray(0, bytes.indexOf(0x0a));
      expect([...firstLine]).not.toContain(0x0d);
    }

    const repairShebang = Buffer.from('#!/bin/sh\n');
    expect(readRepoBytes('docker', 'repair').subarray(0, repairShebang.length)).toEqual(
      repairShebang,
    );
  });
});
