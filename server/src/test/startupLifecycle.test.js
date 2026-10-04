import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';

const isRunning = (pid) => {
  try { process.kill(pid, 0); return true; } catch { return false; }
};

// Real npm -> shell -> Node descendants reproduce leaked development servers.
// All processes, env and files belong to a temporary fixture, never the app DB.
describe.skipIf(process.platform === 'win32')('development startup lifecycle', () => {
  it.each(['signal', 'build failure', 'service failure'])('stops npm descendants after %s', async (mode) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'iclib-startup-'));
    let starter;
    const servicePids = [];
    let output = '';
    const waitFor = async (predicate) => {
      for (let attempt = 0; attempt < 200; attempt++) {
        if (predicate()) return;
        await delay(50);
      }
      throw new Error(`Startup fixture timed out: ${output}`);
    };
    try {
      fs.copyFileSync(new URL('../../../start.sh', import.meta.url), path.join(directory, 'start.sh'));
      for (const service of ['server', 'client']) {
        const serviceDirectory = path.join(directory, service);
        fs.mkdirSync(path.join(serviceDirectory, 'node_modules'), { recursive: true });
        fs.writeFileSync(path.join(serviceDirectory, 'package.json'), JSON.stringify({
          scripts: { dev: 'node service.cjs', build: `node -e "process.exit(${mode === 'build failure' ? 9 : 0})"` },
        }));
        fs.writeFileSync(path.join(serviceDirectory, 'service.cjs'), `
          const fs = require('node:fs');
          fs.writeFileSync('service.pid', String(process.pid));
          setInterval(() => { if (fs.existsSync('fail')) process.exit(7); }, 50);
        `);
      }
      starter = spawn('bash', ['start.sh'], {
        cwd: directory, detached: true,
        env: { ...process.env, NODE_ENV: 'development', DB_HOST: '127.0.0.1', DB_PORT: '1',
          DB_USER: 'fixture', DB_PASSWORD: 'fixture', DB_NAME: 'fixture', JWT_SECRET: 'fixture',
          PATH: `${path.dirname(process.execPath)}:${process.env.PATH}` },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      starter.stdout.on('data', data => { output += data; });
      starter.stderr.on('data', data => { output += data; });
      const exited = once(starter, 'exit');
      await waitFor(() => mode === 'build failure' ? starter.exitCode !== null : output.includes('Servers running:'));
      for (const service of ['server', 'client']) {
        const pidFile = path.join(directory, service, 'service.pid');
        if (fs.existsSync(pidFile)) servicePids.push(Number(fs.readFileSync(pidFile, 'utf8')));
      }
      if (mode === 'signal') starter.kill('SIGTERM');
      if (mode === 'service failure') fs.writeFileSync(path.join(directory, 'client', 'fail'), '');
      const [exitCode] = await exited;
      expect(exitCode).toBe(mode === 'signal' ? 0 : mode === 'build failure' ? 9 : 7);
      await delay(200);
      expect(servicePids.length).toBeGreaterThan(0);
      expect(servicePids.filter(isRunning)).toEqual([]);
    } finally {
      for (const service of ['server', 'client']) {
        const pidFile = path.join(directory, service, 'service.pid');
        if (fs.existsSync(pidFile)) servicePids.push(Number(fs.readFileSync(pidFile, 'utf8')));
      }
      for (const pid of new Set(servicePids)) {
        try { process.kill(pid, 'SIGKILL'); } catch { /* Already exited. */ }
      }
      if (starter?.pid) {
        try { process.kill(-starter.pid, 'SIGKILL'); } catch { /* Already exited. */ }
      }
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }, 15000);
});
