import rateLimit from 'express-rate-limit';
import { isPublicGlobalTarget } from '../constants/publicRoutes.js';

/**
 * Rate limiting (SPEC §V32). Three limiters, three independent budgets - each
 * `rateLimit()` call gets its own MemoryStore, so exhausting one cannot lock
 * out the others:
 *
 *  - login: failed `POST /api/auth/login` attempts, keyed by client IP.
 *  - change-password: failed change-password attempts, keyed by the
 *    authenticated `req.user.id`, so one operator's failures cannot lock out
 *    another operator behind the same NAT address.
 *  - global: a coarse per-IP ceiling over exactly the §V10 guest read surface
 *    plus the barcode lookup. Authenticated/private traffic never spends it.
 *
 * Only failed attempts count on the credential limiters
 * (`skipSuccessfulRequests`), so a legitimate operator is never locked out -
 * only a key that keeps failing is.
 *
 * IP keys use `req.ip`, which behind nginx is the real client address only
 * because index.js sets `trust proxy` (single proxy hop). All windows and
 * ceilings are env-tunable for ops.
 *
 * MemoryStore is process-local and resets on restart. That is sound for the
 * checked-in single-app-container deployment; a multi-process or multi-replica
 * deployment needs a shared external store before claiming uniform enforcement.
 */

const num = (value, fallback) => Number(value) || fallback;

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export function createLoginLimiter(overrides = {}) {
  return rateLimit({
    windowMs: overrides.windowMs ?? num(process.env.RATE_LIMIT_LOGIN_WINDOW_MS, FIFTEEN_MINUTES),
    limit: overrides.limit ?? num(process.env.RATE_LIMIT_LOGIN_MAX, 10),
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: 'Too many attempts. Please wait and try again.' },
  });
}

export function createChangePasswordLimiter(overrides = {}) {
  return rateLimit({
    windowMs: overrides.windowMs ?? num(process.env.RATE_LIMIT_CHANGE_PASSWORD_WINDOW_MS, FIFTEEN_MINUTES),
    limit: overrides.limit ?? num(process.env.RATE_LIMIT_CHANGE_PASSWORD_MAX, 10),
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    // Mounted after `authenticate`, so `req.user` is always present; the IP
    // fallback only covers a misordered mount.
    keyGenerator: (req) => req.user?.id || req.ip,
    message: { error: 'Too many attempts. Please wait and try again.' },
  });
}

export function createGlobalLimiter(overrides = {}) {
  return rateLimit({
    windowMs: overrides.windowMs ?? num(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS, FIFTEEN_MINUTES),
    limit: overrides.limit ?? num(process.env.RATE_LIMIT_GLOBAL_MAX, 1000),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
  });
}

/**
 * Mountable on all of `/api`, but only counts and throttles the §V10 public
 * targets. Anything else calls `next()` without touching the store, so a
 * signed-in user's traffic cannot exhaust the guest budget their office IP
 * shares - and cannot be throttled by it either.
 */
export function createPublicGlobalLimiter(overrides = {}) {
  const limiter = createGlobalLimiter(overrides);

  return function publicGlobalLimiter(req, res, next) {
    if (!isPublicGlobalTarget(req)) return next();
    return limiter(req, res, next);
  };
}

export const loginLimiter = createLoginLimiter();
export const changePasswordLimiter = createChangePasswordLimiter();
export const publicGlobalLimiter = createPublicGlobalLimiter();
