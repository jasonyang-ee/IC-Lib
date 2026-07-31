import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubEnv('JWT_SECRET', 'test-secret-key-minimum-32-chars-long');
vi.stubEnv('NODE_ENV', 'test');

// V1: authenticate now reads the current active state on every protected
// request, so every case here has to answer that one query.
const queryMock = vi.hoisted(() => vi.fn());

vi.mock('../config/database.js', () => ({
  default: { query: (...args) => queryMock(...args) },
}));

const activeUser = () => queryMock.mockResolvedValue({ rows: [{ is_active: true }] });

const {
  canAccessFileLibrary,
  canDeleteLibraryFiles,
  canApprove,
  canWrite,
  generateToken,
  verifyToken,
  authenticate,
  isAdmin,
} = await import('../middleware/auth.js');

// Helper to create mock Express req/res/next
const mockReq = (overrides = {}) => ({
  headers: {},
  cookies: {},
  ...overrides,
});

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateToken / verifyToken', () => {
    it('should generate a valid JWT and verify it', () => {
      const user = { id: 'user-123', username: 'testuser', role: 'admin' };
      const token = generateToken(user);

      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(3);

      const decoded = verifyToken(token);
      expect(decoded.userId).toBe('user-123');
      expect(decoded.username).toBe('testuser');
      expect(decoded.role).toBe('admin');
    });

    it('should reject an invalid token', () => {
      const decoded = verifyToken('invalid.token.string');
      expect(decoded).toBeNull();
    });

    it('should reject a tampered token', () => {
      const token = generateToken({ id: '1', username: 'a', role: 'admin' });
      const tampered = token.slice(0, -5) + 'XXXXX';
      expect(verifyToken(tampered)).toBeNull();
    });
  });

  describe('authenticate', () => {
    it('should extract Bearer token from Authorization header', async () => {
      activeUser();
      const user = { id: 'user-1', username: 'test', role: 'read-write' };
      const token = generateToken(user);
      const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
      const res = mockRes();
      const next = vi.fn();

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('user-1');
      expect(req.user.username).toBe('test');
    });

    it('should extract token from cookie as fallback', async () => {
      activeUser();
      const user = { id: 'user-2', username: 'cookie', role: 'admin' };
      const token = generateToken(user);
      const req = mockReq({ cookies: { token } });
      const res = mockRes();
      const next = vi.fn();

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.id).toBe('user-2');
    });

    it('should return 401 when no token is provided', async () => {
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();

      await authenticate(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'No token provided' }),
      );
      expect(queryMock).not.toHaveBeenCalled();
    });

    it('should return 401 for an invalid token', async () => {
      const req = mockReq({ headers: { authorization: 'Bearer bad-token' } });
      const res = mockRes();
      const next = vi.fn();

      await authenticate(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(queryMock).not.toHaveBeenCalled();
    });
  });

  // V1: deactivating an account stops an already-issued JWT on its next
  // protected request. The token itself stays cryptographically valid, so
  // only the live check can end the session.
  describe('authenticate active-state check', () => {
    const requestWithValidToken = () => {
      const token = generateToken({ id: 'user-9', username: 'gone', role: 'admin' });
      return mockReq({ headers: { authorization: `Bearer ${token}` } });
    };

    it('reads the current active state exactly once per valid token', async () => {
      activeUser();
      const res = mockRes();
      const next = vi.fn();

      await authenticate(requestWithValidToken(), res, next);

      expect(next).toHaveBeenCalled();
      expect(queryMock).toHaveBeenCalledTimes(1);
      expect(queryMock).toHaveBeenCalledWith(
        'SELECT is_active FROM users WHERE id = $1',
        ['user-9'],
      );
    });

    it('rejects a deactivated user and never populates req.user', async () => {
      queryMock.mockResolvedValue({ rows: [{ is_active: false }] });
      const req = requestWithValidToken();
      const res = mockRes();
      const next = vi.fn();

      await authenticate(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('rejects a token whose user row no longer exists', async () => {
      queryMock.mockResolvedValue({ rows: [] });
      const req = requestWithValidToken();
      const res = mockRes();
      const next = vi.fn();

      await authenticate(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('says nothing about why: a disabled account looks like a bad token', async () => {
      queryMock.mockResolvedValue({ rows: [{ is_active: false }] });
      const res = mockRes();

      await authenticate(requestWithValidToken(), res, vi.fn());

      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication failed',
        message: 'Invalid or expired token',
      });
    });

    it('fails closed with 503 when the active check cannot run', async () => {
      queryMock.mockRejectedValue(new Error('connection terminated'));
      const req = requestWithValidToken();
      const res = mockRes();
      const next = vi.fn();

      await authenticate(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.status).not.toHaveBeenCalledWith(401);
    });

    it('leaves a downstream role guard unreachable once authenticate fails', async () => {
      queryMock.mockResolvedValue({ rows: [{ is_active: false }] });
      const req = requestWithValidToken();
      const res = mockRes();
      const next = vi.fn();

      await authenticate(req, res, next);

      // The guard only runs via next(); prove it is never reached and that
      // the request was left without an identity for it to trust.
      expect(next).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });
  });

  describe('isAdmin', () => {
    it('should pass for admin role', () => {
      const req = mockReq({ user: { role: 'admin' } });
      const res = mockRes();
      const next = vi.fn();

      isAdmin(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should reject non-admin roles', () => {
      for (const role of ['read-only', 'reviewer', 'lab', 'read-write', 'approver']) {
        const req = mockReq({ user: { role } });
        const res = mockRes();
        const next = vi.fn();

        isAdmin(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
      }
    });

    it('should return 401 when user is not set', () => {
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();

      isAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('canWrite', () => {
    it('should pass for write-capable roles', () => {
      for (const role of ['lab', 'read-write', 'approver', 'admin']) {
        const req = mockReq({ user: { role } });
        const res = mockRes();
        const next = vi.fn();

        canWrite(req, res, next);
        expect(next).toHaveBeenCalled();
      }
    });

    it('should reject read-only role', () => {
      const req = mockReq({ user: { role: 'read-only' } });
      const res = mockRes();
      const next = vi.fn();

      canWrite(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('canApprove', () => {
    it('should pass for approval workflow roles', () => {
      for (const role of ['reviewer', 'lab', 'read-write', 'approver', 'admin']) {
        const req = mockReq({ user: { role } });
        const res = mockRes();
        const next = vi.fn();

        canApprove(req, res, next);
        expect(next).toHaveBeenCalled();
      }
    });

    it('should reject read-only role', () => {
      const req = mockReq({ user: { role: 'read-only' } });
      const res = mockRes();
      const next = vi.fn();

      canApprove(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('canDeleteLibraryFiles', () => {
    it('should pass for approver and admin roles', () => {
      for (const role of ['approver', 'admin']) {
        const req = mockReq({ user: { role } });
        const res = mockRes();
        const next = vi.fn();

        canDeleteLibraryFiles(req, res, next);
        expect(next).toHaveBeenCalled();
      }
    });

    it('should reject read-write, reviewer, and read-only roles', () => {
      for (const role of ['lab', 'read-write', 'reviewer', 'read-only']) {
        const req = mockReq({ user: { role } });
        const res = mockRes();
        const next = vi.fn();

        canDeleteLibraryFiles(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
      }
    });
  });

  describe('canAccessFileLibrary', () => {
    it('should pass for read-write, approver, and admin roles', () => {
      for (const role of ['read-write', 'approver', 'admin']) {
        const req = mockReq({ user: { role } });
        const res = mockRes();
        const next = vi.fn();

        canAccessFileLibrary(req, res, next);
        expect(next).toHaveBeenCalled();
      }
    });

    it('should reject lab, reviewer, and read-only roles', () => {
      for (const role of ['lab', 'reviewer', 'read-only']) {
        const req = mockReq({ user: { role } });
        const res = mockRes();
        const next = vi.fn();

        canAccessFileLibrary(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
      }
    });
  });
});
