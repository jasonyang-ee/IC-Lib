import rateLimit from 'express-rate-limit';

/**
 * Rate limiting (SPEC §V32).
 *
 * `authLimiter` throttles credential endpoints per client IP so brute-force /
 * credential-stuffing gets a 429 instead of unbounded guesses. Only *failed*
 * attempts count (`skipSuccessfulRequests`), so a legitimate operator logging
 * in normally is never locked out - only an IP that keeps failing is.
 *
 * `globalLimiter` is a coarse per-IP ceiling that guards the unauthenticated
 * public-read surface (§V10) from scraping/abuse.
 *
 * Both are keyed on `req.ip`, which behind nginx is the real client address
 * only because index.js sets `trust proxy` (single proxy hop). All windows and
 * ceilings are env-tunable for ops.
 */

const num = (value, fallback) => Number(value) || fallback;

export function createAuthLimiter(overrides = {}) {
  return rateLimit({
    windowMs: overrides.windowMs ?? num(process.env.RATE_LIMIT_AUTH_WINDOW_MS, 15 * 60 * 1000),
    limit: overrides.limit ?? num(process.env.RATE_LIMIT_AUTH_MAX, 10),
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: 'Too many attempts. Please wait and try again.' },
  });
}

export function createGlobalLimiter(overrides = {}) {
  return rateLimit({
    windowMs: overrides.windowMs ?? num(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS, 15 * 60 * 1000),
    limit: overrides.limit ?? num(process.env.RATE_LIMIT_GLOBAL_MAX, 1000),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
  });
}

export const authLimiter = createAuthLimiter();
export const globalLimiter = createGlobalLimiter();
