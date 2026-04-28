import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import { canDirectEditComponentInEcoMode } from '../services/componentLifecycleService.js';
import { isEcoEnabled } from '../utils/featureFlags.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('\x1b[31m[FATAL]\x1b[0m \x1b[36m[Auth]\x1b[0m JWT_SECRET environment variable is not set. Server cannot start securely.');
  process.exit(1);
}
export const JWT_EXPIRES_IN = '24h';
export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'token';
const AUTH_COOKIE_MAX_AGE = 24 * 60 * 60 * 1000;
const FILE_LIBRARY_ACCESS_ROLES = new Set(['read-write', 'approver', 'admin']);

export const getAuthCookieOptions = ({ clear = false } = {}) => {
  const options = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };

  if (!clear) {
    options.maxAge = AUTH_COOKIE_MAX_AGE;
  }

  return options;
};

/**
 * Generate JWT token for authenticated user
 */
export const generateToken = (user) => {
  const payload = {
    userId: user.id,
    username: user.username,
    role: user.role,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Verify JWT token from request
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
};

/**
 * Authentication middleware - verifies JWT token
 * Adds user info to req.user if token is valid
 */
export const authenticate = (req, res, next) => {
  try {
    // Get token from cookie or Authorization header
    let token = null;

    if (req.cookies && req.cookies[AUTH_COOKIE_NAME]) {
      token = req.cookies[AUTH_COOKIE_NAME];
    }

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No token provided', 
      });
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Invalid or expired token', 
      });
    }

    // Attach user info to request (map userId to id for consistency)
    req.user = {
      ...decoded,
      id: decoded.userId,  // Map userId to id for compatibility
    };
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ 
      error: 'Authentication failed',
      message: 'Token verification failed', 
    });
  }
};

/**
 * Check if user is admin
 */
export const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required', 
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'Admin access required', 
    });
  }

  next();
};

/**
 * Check if user can participate in the approval workflow.
 * Stage-level role checks still happen inside the ECO controller.
 */
export const canApprove = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required', 
    });
  }

  if (req.user.role === 'read-only') {
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'Approval workflow access required', 
    });
  }

  next();
};

/**
 * Check if user has write access (lab, read-write, approver, or admin)
 */
export const canWrite = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required', 
    });
  }

  if (req.user.role === 'read-only' || req.user.role === 'reviewer') {
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'Write access required', 
    });
  }

  next();
};

/**
 * Only approver and admin can permanently delete files from the shared CAD library.
 */
export const canDeleteLibraryFiles = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  if (!['approver', 'admin'].includes(req.user.role)) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Library file delete access required',
    });
  }

  next();
};

export const canAccessFileLibrary = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  if (!FILE_LIBRARY_ACCESS_ROLES.has(req.user.role)) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'File Library access required',
    });
  }

  next();
};

const buildDirectComponentEditGuard = (getComponentId) => async (req, res, next) => {
  if (!isEcoEnabled() || req.user?.role === 'admin') {
    next();
    return;
  }

  const componentId = getComponentId(req);
  if (!componentId) {
    return res.status(400).json({
      error: 'Component ID is required',
    });
  }

  try {
    const componentResult = await pool.query(
      'SELECT approval_status FROM components WHERE id = $1',
      [componentId],
    );

    if (componentResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Component not found',
      });
    }

    const currentApprovalStatus = componentResult.rows[0].approval_status;
    const requestedApprovalStatus = req.body?.approval_status;

    if (!canDirectEditComponentInEcoMode({
      role: req.user?.role,
      currentApprovalStatus,
      requestedApprovalStatus,
    })) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Direct edits require ECO approval unless the part is still in new status',
      });
    }

    next();
  } catch (error) {
    console.error('Direct component edit policy error:', error);
    res.status(500).json({
      error: 'Failed to verify direct edit policy',
    });
  }
};

export const canDirectEditComponent = buildDirectComponentEditGuard((req) => req.params.id);
export const canDirectEditComponentByBody = buildDirectComponentEditGuard((req) => req.body?.componentId);
