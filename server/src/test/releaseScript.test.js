import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Release planning runs in an isolated local repository. Git commit is stopped
// before tagging/pushing and gh never calls an external service.
describe.skipIf(process.platform === 'win32')('release script', () => {
  it('shows help without checking GitHub authentication', () => {
    withFixture(({ run, root }) => {
      fs.writeFileSync(path.join(root, 'bin/gh'), '#!/bin/sh\ntouch auth-attempt\nexit 1\n', { mode: 0o700 });
      const result = run(['--help']);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Usage:');
      expect(fs.existsSync(path.join(root, 'auth-attempt'))).toBe(false);
    });
  });

  it('honors --yes for branch and dirty-tree confirmations', () => {
    withFixture(({ run, root, git }) => {
      git(['checkout', '-b', 'release-fixture']);
      fs.appendFileSync(path.join(root, 'CHANGELOG.md'), '\n- Pending change.\n');
      expect(run(['--patch', '--yes']).status).toBe(23); // stops at fixture commit
    });
  });

  it.each([
    ['fix!: change contract', 'major'],
    ['fix(cad)!: change contract', 'major'],
    ['fix: change contract\n\nBREAKING CHANGE: changed records', 'major'],
    ['feat(cad): new feature', 'minor'],
    ['fix(cad): repair', 'patch'],
  ])('detects the release type for %s', (message, expected) => {
    withFixture(({ run, git }) => {
      git(['commit', '--allow-empty', '-m', message]);
      const result = run([], 'n\n');
      expect(result.stdout).toContain(`Release type (auto-detected): \u001b[1m${expected}`);
    });
  });

  it('stages the root manifest even without a root lockfile', () => {
    withFixture(({ run, git }) => {
      const result = run(['--patch', '--yes']);
      expect(result.status).toBe(23); // fixture stops at git commit
      expect(git(['diff', '--cached', '--name-only'])).toContain('package.json');
      expect(git(['diff', '--cached', '--', 'package.json'])).toContain('1.0.1');
    });
  });

  it('stops before commit if a package version update fails', () => {
    withFixture(({ run, root }) => {
      fs.writeFileSync(path.join(root, 'bin/npm'), '#!/bin/sh\nexit 17\n', { mode: 0o700 });
      expect(run(['--patch', '--yes']).status).toBe(17);
      expect(fs.existsSync(path.join(root, 'commit-attempt'))).toBe(false);
    });
  });
});

function withFixture(check) {
  const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iclib-release-'));
  const env = { ...process.env, GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
    PATH: `${path.join(root, 'bin')}:${path.dirname(process.execPath)}:${process.env.PATH}` };
  const git = args => execFileSync(realGit, args, { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    fs.mkdirSync(path.join(root, 'bin'));
    fs.copyFileSync(new URL('../../../release.sh', import.meta.url), path.join(root, 'release.sh'));
    fs.writeFileSync(path.join(root, 'package.json'), '{"name":"release-fixture","version":"1.0.0"}\n');
    fs.writeFileSync(path.join(root, 'CHANGELOG.md'), '# Changelog\n\n## [Unreleased]\n\n### Fixed\n\n- Fixture.\n');
    git(['init', '-b', 'main']);
    git(['add', 'package.json', 'CHANGELOG.md']);
    git(['commit', '-m', 'initial']);
    git(['tag', 'v1.0.0']);
    fs.writeFileSync(path.join(root, 'bin/gh'), '#!/bin/sh\n[ "$1" = auth ]\n', { mode: 0o700 });
    fs.writeFileSync(path.join(root, 'bin/git'), `#!/bin/sh
case "$1" in
  commit) touch commit-attempt; exit 23 ;;
  push|tag) exit 24 ;;
esac
exec '${realGit}' "$@"
`, { mode: 0o700 });
    check({ root, git, run: (args, input = '') => spawnSync('bash', ['release.sh', ...args], { cwd: root, env, input, encoding: 'utf8', timeout: 10000 }) });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
