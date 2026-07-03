/**
 * Single log surface for the server: `[LEVEL] [Service] Message` (ASCII),
 * with the same colors the hand-rolled call sites used to emit. Call sites
 * pass the service tag; nobody hand-rolls escape codes anymore.
 */

const LEVEL_COLORS = {
  INFO: '32', // green
  WARN: '33', // yellow
  ERROR: '31', // red
  FATAL: '31', // red
};

const prefix = (level, service) => `\x1b[${LEVEL_COLORS[level]}m[${level}]\x1b[0m \x1b[36m[${service}]\x1b[0m`;

export const logInfo = (service, ...args) => console.log(prefix('INFO', service), ...args);
export const logWarn = (service, ...args) => console.warn(prefix('WARN', service), ...args);
export const logError = (service, ...args) => console.error(prefix('ERROR', service), ...args);
export const logFatal = (service, ...args) => console.error(prefix('FATAL', service), ...args);
