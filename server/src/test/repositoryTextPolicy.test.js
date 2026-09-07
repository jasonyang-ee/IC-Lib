import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
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

const trackedShebangPaths = (root, readFile = fs.readFileSync) => {
  const list = (args) => execFileSync('git', ['ls-files', '-z', ...args], { cwd: root })
    .toString('utf8').split('\0').filter(Boolean);
  const deleted = new Set(list(['--deleted']));
  return list([]).filter((filePath) => !deleted.has(filePath))
    .filter((filePath) => readFile(path.join(root, filePath)).subarray(0, 2).toString() === '#!');
};

const expectLfShebang = (bytes) => {
  const end = bytes.indexOf(0x0a);
  expect([...bytes.subarray(0, end < 0 ? bytes.length : end)]).not.toContain(0x0d);
};

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
    const paths = trackedShebangPaths(repoRoot);
    expect(paths).toContain('docker/repair');

    for (const filePath of paths) {
      expectLfShebang(readRepoBytes(...filePath.split('/')));
    }

    const repairShebang = Buffer.from('#!/bin/sh\n');
    expect(readRepoBytes('docker', 'repair').subarray(0, repairShebang.length)).toEqual(
      repairShebang,
    );
  });

  it('excludes Git-deleted files while enforcing retained shebangs and read failures', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iclib-text-policy-'));
    try {
      execFileSync('git', ['init', '--quiet'], { cwd: root });
      fs.writeFileSync(path.join(root, 'deleted note.md'), 'tracked non-executable');
      fs.writeFileSync(path.join(root, 'retained script'), '#!/bin/sh\n');
      execFileSync('git', ['add', '--', 'deleted note.md', 'retained script'], { cwd: root });
      fs.unlinkSync(path.join(root, 'deleted note.md'));
      expect(trackedShebangPaths(root)).toEqual(['retained script']);
      expectLfShebang(fs.readFileSync(path.join(root, 'retained script')));
      fs.writeFileSync(path.join(root, 'retained script'), '#!/bin/sh\r\n');
      expect(trackedShebangPaths(root)).toEqual(['retained script']);
      expect(() => expectLfShebang(fs.readFileSync(path.join(root, 'retained script')))).toThrow();
      const unreadable = Object.assign(new Error('retained file unreadable'), { code: 'EACCES' });
      expect(() => trackedShebangPaths(root, () => { throw unreadable; })).toThrow(unreadable);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
