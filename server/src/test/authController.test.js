import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubEnv('JWT_SECRET', 'test-secret-key-minimum-32-chars-long');
vi.stubEnv('NODE_ENV', 'test');

const queryMock = vi.fn();
const compareMock = vi.fn();
const hashMock = vi.fn();

vi.mock('../config/database.js', () => ({
  default: {
    query: (...args) => queryMock(...args),
  },
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: (...args) => compareMock(...args),
    hash: (...args) => hashMock(...args),
  },
}));

vi.mock('../services/emailService.js', () => ({
  sendWelcomeEmail: vi.fn(),
}));

vi.mock('../services/ecoApprovalEligibilityService.js', () => ({
  canDelegateToRole: vi.fn(() => true),
}));

const { AUTH_COOKIE_NAME } = await import('../middleware/auth.js');
const {
  login,
  logout,
  changePassword,
  updateUser,
  deleteUser,
} = await import('../controllers/authController.js');

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
          auth_provider: 'local',
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

  // Regression: the login/logout audit writes are optional, but a catch
  // binding shadowing the imported `logError` used to throw a TypeError over
  // the rejection and abort the handler before the cookie work ran.
  it('still issues the auth cookie when the login audit write is rejected', async () => {
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
          auth_provider: 'local',
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValue(new Error('activity_log rejected'));

    const res = mockRes();

    await login(mockReq({ body: { username: 'tester', password: 'secret' } }), res);

    expect(res.cookie).toHaveBeenCalledWith(AUTH_COOKIE_NAME, expect.any(String), expect.any(Object));
    expect(res.json).toHaveBeenCalledWith({
      user: { id: 'user-1', username: 'tester', role: 'admin', displayName: 'Tester' },
    });
    expect(res.status).not.toHaveBeenCalledWith(500);
  });

  it('still clears the auth cookie when the logout audit write is rejected', async () => {
    queryMock.mockRejectedValue(new Error('activity_log rejected'));

    const res = mockRes();

    await logout(mockReq(), res);

    expect(res.clearCookie).toHaveBeenCalledWith(AUTH_COOKIE_NAME, expect.any(Object));
    expect(res.json).toHaveBeenCalledWith({ message: 'Logged out successfully' });
    expect(res.status).not.toHaveBeenCalledWith(500);
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

  it('rejects local login for SSO-only users (NULL password_hash) without calling bcrypt', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{
        id: 'user-2',
        username: 'sso.user',
        password_hash: null,
        role: 'read-only',
        is_active: true,
        display_name: 'SSO User',
        auth_provider: 'oidc',
      }],
    });

    const req = mockReq({ body: { username: 'sso.user', password: 'anything' } });
    const res = mockRes();

    await login(req, res);

    expect(compareMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid username or password' });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('rejects local login for an anomalous SSO hash without calling bcrypt', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{
        id: 'user-2',
        username: 'sso.user',
        password_hash: 'legacy-oidc-hash',
        role: 'read-only',
        is_active: true,
        display_name: 'SSO User',
        auth_provider: 'oidc',
      }],
    });

    const req = mockReq({ body: { username: 'sso.user', password: 'anything' } });
    const res = mockRes();

    await login(req, res);

    expect(compareMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid username or password' });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('rejects change-password for SSO-only users with a clear 400', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ password_hash: null, auth_provider: 'oidc' }] });

    const req = mockReq({ body: { currentPassword: 'x', newPassword: 'longenough' } });
    const res = mockRes();

    await changePassword(req, res);

    expect(compareMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'This account signs in through single sign-on and has no local password',
    });
  });

  it('rejects change-password for an anomalous SSO hash without calling bcrypt', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ password_hash: 'legacy-oidc-hash', auth_provider: 'oidc' }] });

    const req = mockReq({ body: { currentPassword: 'x', newPassword: 'longenough' } });
    const res = mockRes();

    await changePassword(req, res);

    expect(compareMock).not.toHaveBeenCalled();
    expect(hashMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'This account signs in through single sign-on and has no local password',
    });
  });

  it('changes a local user password after verifying the current password', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ password_hash: 'current-password-hash', auth_provider: 'local' }] })
      .mockResolvedValueOnce({ rows: [] });
    compareMock.mockResolvedValue(true);
    hashMock.mockResolvedValue('new-password-hash');
    const res = mockRes();

    await changePassword(mockReq({ body: { currentPassword: 'current-password', newPassword: 'new-password' } }), res);

    expect(compareMock).toHaveBeenCalledWith('current-password', 'current-password-hash');
    expect(hashMock).toHaveBeenCalledWith('new-password', 10);
    expect(queryMock.mock.calls[1]).toEqual([
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      ['new-password-hash', 'user-1'],
    ]);
    expect(res.json).toHaveBeenCalledWith({ message: 'Password changed successfully' });
  });
});

describe('authController local user authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("admin changes an OIDC user's local role and active state without changing identity", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: 'oidc-user', username: 'sso.user', auth_provider: 'oidc' }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 'oidc-user',
          username: 'sso.user',
          role: 'approver',
          is_active: false,
          auth_provider: 'oidc',
        }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const req = mockReq({
      params: { id: 'oidc-user' },
      body: { role: 'approver', is_active: false },
    });
    const res = mockRes();

    await updateUser(req, res);

    const [updateSql, updateValues] = queryMock.mock.calls[1];
    expect(updateSql).toContain('role = $1');
    expect(updateSql).toContain('is_active = $2');
    expect(updateSql).not.toMatch(/oidc_(?:issuer|sub|tenant_id|object_id)\s*=/);
    expect(updateSql).not.toContain('password_hash =');
    expect(updateValues).toEqual(['approver', false, 'oidc-user']);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      id: 'oidc-user',
      role: 'approver',
      is_active: false,
      auth_provider: 'oidc',
    }));
  });

  it('admin password set for an OIDC user returns 400 without bcrypt', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 'oidc-user', username: 'sso.user', auth_provider: 'oidc' }],
    });

    const req = mockReq({
      params: { id: 'oidc-user' },
      body: { password: 'new-password' },
    });
    const res = mockRes();

    await updateUser(req, res);

    expect(hashMock).not.toHaveBeenCalled();
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Single sign-on users cannot have a local password',
    });
  });

  it('admin password set rejects every non-local provider without bcrypt', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 'scim-user', username: 'scim.user', auth_provider: 'scim' }],
    });

    const req = mockReq({
      params: { id: 'scim-user' },
      body: { password: 'new-password' },
    });
    const res = mockRes();

    await updateUser(req, res);

    expect(hashMock).not.toHaveBeenCalled();
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Single sign-on users cannot have a local password',
    });
  });

  it.each([null, 'false', 0, {}])('rejects non-boolean is_active value %j before database work', async (is_active) => {
    const req = mockReq({
      params: { id: 'local-user' },
      body: { is_active },
    });
    const res = mockRes();

    await updateUser(req, res);

    expect(queryMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'is_active must be a boolean',
    });
  });

  it('delete user deactivates and retains the row', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ username: 'former.user', is_active: true }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const req = mockReq({ params: { id: 'former-user' } });
    const res = mockRes();

    await deleteUser(req, res);

    expect(queryMock.mock.calls.some(([sql]) => /DELETE\s+FROM\s+users/i.test(sql))).toBe(false);
    expect(queryMock.mock.calls[1]).toEqual([
      'UPDATE users SET is_active = false WHERE id = $1',
      ['former-user'],
    ]);
    expect(queryMock.mock.calls[2][1]).toEqual([
      'user_deactivated',
      'Deactivated user: former.user',
      'user-1',
    ]);
    expect(res.json).toHaveBeenCalledWith({ message: 'User deactivated successfully' });
  });

  it('repeating deactivation for an inactive user is a successful no-op', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ username: 'former.user', is_active: false }],
    });

    const req = mockReq({ params: { id: 'former-user' } });
    const res = mockRes();

    await deleteUser(req, res);

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ message: 'User deactivated successfully' });
  });

  it('local user password update remains supported', async () => {
    hashMock.mockResolvedValue('new-password-hash');
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: 'local-user', username: 'local.user', auth_provider: 'local' }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 'local-user',
          username: 'local.user',
          role: 'read-write',
          is_active: true,
          auth_provider: 'local',
        }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const req = mockReq({
      params: { id: 'local-user' },
      body: { password: 'new-password' },
    });
    const res = mockRes();

    await updateUser(req, res);

    expect(hashMock).toHaveBeenCalledWith('new-password', 10);
    expect(queryMock.mock.calls[1][0]).toContain('password_hash = $1');
    expect(queryMock.mock.calls[1][1]).toEqual(['new-password-hash', 'local-user']);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 'local-user' }));
  });

  it('does not update a password after a provider race', async () => {
    hashMock.mockResolvedValue('new-password-hash');
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: 'local-user', username: 'local.user', auth_provider: 'local' }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const req = mockReq({
      params: { id: 'local-user' },
      body: { password: 'new-password' },
    });
    const res = mockRes();

    await updateUser(req, res);

    expect(queryMock.mock.calls[1][0]).toContain("auth_provider = 'local'");
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'User is no longer eligible for a local password',
    });
  });
});
