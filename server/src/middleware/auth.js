import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

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
  } catch (error) {
    return null;
  }
};

/**
 * Authentication middleware - verifies JWT token
 * Adds user info to req.user if token is valid
 */
export const authenticate = (req, res, next) => {
  try {
    // Get token from Authorization header or cookie
    let token = null;
    
    // Check Authorization header first (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    
    // Fallback to cookie if no Authorization header
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
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

    // Attach user info to request
    req.user = decoded;
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
 * Check if user can approve parts (approver or admin)
 */
export const canApprove = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required', 
    });
  }

  if (req.user.role !== 'approver' && req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'Approver or admin access required', 
    });
  }

  next();
};

/**
 * Check if user has write access (read-write, approver, or admin)
 */
export const canWrite = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required', 
    });
  }

  if (req.user.role === 'read-only') {
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'Write access required', 
    });
  }

  next();
};
