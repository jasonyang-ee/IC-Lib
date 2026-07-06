import { logError, logInfo } from './logger.js';

/**
 * Drain on shutdown (SPEC §V31).
 *
 * Stop accepting new connections (`server.close`), let in-flight requests
 * finish within a bounded timeout, close the DB pool, then exit. A hung
 * request must not block a deploy indefinitely, so a timer force-exits if the
 * drain overruns.
 *
 * Reused for both signal-driven shutdown (SIGTERM/SIGINT -> exit 0) and fatal
 * faults (uncaughtException/unhandledRejection -> exit != 0). `exit` is
 * injectable so the drain sequence is testable without terminating the runner.
 *
 * @returns {Promise<void>} resolves once the exit callback has been invoked.
 */
export function gracefulShutdown({
  server,
  pool,
  signal,
  timeoutMs = 10000,
  exitCode = 0,
  exit = process.exit,
}) {
  logInfo('Server', `${signal} received - draining in-flight requests`);

  let done = false;
  return new Promise((resolve) => {
    const finish = async () => {
      if (done) {
        return;
      }
      done = true;
      clearTimeout(forceTimer);
      try {
        await pool.end();
      } catch (poolErr) {
        logError('Server', `Error closing DB pool: ${poolErr.message}`);
      }
      exit(exitCode);
      resolve();
    };

    // A stuck connection must never hold a deploy open forever: force exit once
    // the drain window elapses. A forced drain is a failure even under a clean
    // signal, so it exits non-zero.
    const forceTimer = setTimeout(() => {
      logError('Server', `Drain timed out after ${timeoutMs}ms - forcing exit`);
      if (done) {
        return;
      }
      done = true;
      exit(exitCode === 0 ? 1 : exitCode);
      resolve();
    }, timeoutMs);
    // Do not let the timer itself keep the event loop alive.
    forceTimer.unref?.();

    if (server && typeof server.close === 'function') {
      server.close((err) => {
        if (err) {
          logError('Server', `Error during server.close: ${err.message}`);
        }
        finish();
      });
    } else {
      // No live server handle (e.g. fault during startup): just close the pool.
      finish();
    }
  });
}
