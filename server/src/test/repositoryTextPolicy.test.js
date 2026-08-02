import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const readRepoBytes = (...segments) => fs.readFileSync(path.join(repoRoot, ...segments));
const readAttributes = (filePath) => {
  const fields = execFileSync('git', ['check-attr', '-z', '--all', '--', filePath], { cwd: repoRoot })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
  return Object.fromEntries(fields.reduce((entries, field, index) => {
    if (index % 3 === 0) entries.push([fields[index + 1], fields[index + 2]]);
    return entries;
  }, []));
};

const trackedShebangPaths = execFileSync('git', ['ls-files', '-z'], {
  cwd: repoRoot,
})
  .toString('utf8')
  .split('\0')
  .filter(Boolean)
  .filter((filePath) => readRepoBytes(...filePath.split('/')).subarray(0, 2).toString() === '#!');

describe('repository text policy', () => {
  it('applies effective LF text and binary attributes to every declared family', () => {
    expect(readAttributes('image/example.png')).toMatchObject({ binary: 'set', diff: 'unset', merge: 'unset', text: 'unset', eol: 'lf' });
    expect(readAttributes('release/example.msi')).toMatchObject({ binary: 'set', diff: 'unset', merge: 'unset', text: 'unset', eol: 'lf' });
    expect(readAttributes('design/example.psd')).toMatchObject({ binary: 'set', diff: 'unset', merge: 'unset', text: 'unset', eol: 'lf' });
    expect(readAttributes('docs/example.doc')).toMatchObject({ binary: 'set', diff: 'unset', merge: 'unset', text: 'unset', eol: 'lf' });
    expect(readAttributes('library/example.DBC')).toMatchObject({ binary: 'set', diff: 'unset', merge: 'unset', text: 'unset', eol: 'lf' });
    expect(readAttributes('windows/example.reg')).toMatchObject({ binary: 'set', diff: 'unset', merge: 'unset', text: 'unset', eol: 'lf' });
    expect(readAttributes('start.sh')).toMatchObject({ text: 'set', eol: 'lf' });
    expect(readAttributes('docker/repair')).toMatchObject({ text: 'set', eol: 'lf' });
    expect(readAttributes('Dockerfile')).toMatchObject({ text: 'set', eol: 'lf' });
    expect(readAttributes('README.md')).toMatchObject({ text: 'auto', eol: 'lf' });
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
