import { describe, expect, it, vi } from 'vitest';

import { gracefulShutdown } from '../utils/gracefulShutdown.js';

// §V31: SIGTERM/SIGINT drain in-flight requests then exit 0; a fatal fault
// exits non-zero; a hung drain force-exits at the timeout; a fault before the
// server exists still closes the pool. `exit` is injected so the sequence runs
// without terminating the test runner.

describe('gracefulShutdown (§V31)', () => {
  it('drains (server.close) then closes the pool then exits 0 on SIGTERM', async () => {
    const order = [];
    const server = { close: vi.fn((cb) => { order.push('close'); cb(); }) };
    const pool = { end: vi.fn(async () => { order.push('pool.end'); }) };
    const exit = vi.fn(() => { order.push('exit'); });

    await gracefulShutdown({ server, pool, signal: 'SIGTERM', exit });

    expect(server.close).toHaveBeenCalledOnce();
    expect(pool.end).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(0);
    // Sequencing matters: stop accepting -> drain -> close pool -> exit.
    expect(order).toEqual(['close', 'pool.end', 'exit']);
  });

  it('exits non-zero for a fatal fault', async () => {
    const server = { close: vi.fn((cb) => cb()) };
    const pool = { end: vi.fn(async () => {}) };
    const exit = vi.fn();

    await gracefulShutdown({
      server, pool, signal: 'Uncaught Exception', exitCode: 1, exit,
    });

    expect(exit).toHaveBeenCalledWith(1);
  });

  it('force-exits non-zero when the drain overruns the timeout', async () => {
    vi.useFakeTimers();
    try {
      // server.close never invokes its callback: a hung in-flight request.
      const server = { close: vi.fn(() => {}) };
      const pool = { end: vi.fn(async () => {}) };
      const exit = vi.fn();

      gracefulShutdown({ server, pool, signal: 'SIGTERM', timeoutMs: 5000, exit });

      expect(exit).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(5000);
      // A forced drain is a failure even under a clean signal -> non-zero.
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('closes the pool and exits even with no server handle (fault before listen)', async () => {
    const pool = { end: vi.fn(async () => {}) };
    const exit = vi.fn();

    await gracefulShutdown({ server: undefined, pool, signal: 'FATAL', exitCode: 1, exit });

    expect(pool.end).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(1);
  });
});
