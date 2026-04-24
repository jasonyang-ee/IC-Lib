import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubEnv('JWT_SECRET', 'test-secret-key-minimum-32-chars-long');
vi.stubEnv('NODE_ENV', 'test');

const queryMock = vi.fn();
const compareMock = vi.fn();

vi.mock('../config/database.js', () => ({
  default: {
    query: (...args) => queryMock(...args),
  },
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: (...args) => compareMock(...args),
    hash: vi.fn(),
  },
}));

vi.mock('../services/emailService.js', () => ({
  sendWelcomeEmail: vi.fn(),
}));

vi.mock('../services/ecoApprovalEligibilityService.js', () => ({
  canDelegateToRole: vi.fn(() => true),
}));

const { AUTH_COOKIE_NAME } = await import('../middleware/auth.js');
const { login, logout } = await import('../controllers/authController.js');

const mockReq = (overrides = {}) => ({
  body: {},
  user: { id: 'user-1', userId: 'user-1', username: 'tester', role: 'admin' },
  ...overrides,
});

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.cookie = vi.fn().mockReturnValue(res);
  res.clearCookie = vi.fn().mockReturnValue(res);
  return res;
};

describe('authController cookie auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets an HttpOnly auth cookie on successful login and omits token from JSON', async () => {
    compareMock.mockResolvedValue(true);
    queryMock
      .mockResolvedValueOnce({
        rows: [{
          id: 'user-1',
          username: 'tester',
          password_hash: 'hashed-password',
          role: 'admin',
          is_active: true,
          display_name: 'Tester',
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const req = mockReq({
      body: {
        username: 'tester',
        password: 'secret',
      },
    });
    const res = mockRes();

    await login(req, res);

    expect(res.cookie).toHaveBeenCalledWith(
      AUTH_COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        path: '/',
      }),
    );
    expect(res.json).toHaveBeenCalledWith({
      user: {
        id: 'user-1',
        username: 'tester',
        role: 'admin',
        displayName: 'Tester',
      },
    });
  });

  it('clears the auth cookie on logout', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const req = mockReq();
    const res = mockRes();

    await logout(req, res);

    expect(res.clearCookie).toHaveBeenCalledWith(
      AUTH_COOKIE_NAME,
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        path: '/',
      }),
    );
    expect(res.json).toHaveBeenCalledWith({ message: 'Logged out successfully' });
  });
});