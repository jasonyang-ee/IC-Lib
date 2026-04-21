import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubEnv('JWT_SECRET', 'test-secret-key-minimum-32-chars-long');
vi.stubEnv('NODE_ENV', 'test');

const { generateToken, verifyToken, authenticate, isAdmin, canWrite, canApprove } = await import('../middleware/auth.js');

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
    it('should extract Bearer token from Authorization header', () => {
      const user = { id: 'user-1', username: 'test', role: 'read-write' };
      const token = generateToken(user);
      const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
      const res = mockRes();
      const next = vi.fn();

      authenticate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('user-1');
      expect(req.user.username).toBe('test');
    });

    it('should extract token from cookie as fallback', () => {
      const user = { id: 'user-2', username: 'cookie', role: 'admin' };
      const token = generateToken(user);
      const req = mockReq({ cookies: { token } });
      const res = mockRes();
      const next = vi.fn();

      authenticate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.id).toBe('user-2');
    });

    it('should return 401 when no token is provided', () => {
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();

      authenticate(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'No token provided' }),
      );
    });

    it('should return 401 for an invalid token', () => {
      const req = mockReq({ headers: { authorization: 'Bearer bad-token' } });
      const res = mockRes();
      const next = vi.fn();

      authenticate(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
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
      for (const role of ['read-only', 'read-write', 'approver']) {
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
      for (const role of ['read-write', 'approver', 'admin']) {
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
      for (const role of ['reviewer', 'read-write', 'approver', 'admin']) {
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
});
