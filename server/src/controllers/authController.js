import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import pool from '../config/database.js';
import { AUTH_COOKIE_NAME, generateToken, getAuthCookieOptions } from '../middleware/auth.js';
import { sendWelcomeEmail } from '../services/emailService.js';
import { canDelegateToRole } from '../services/ecoApprovalEligibilityService.js';

const SALT_ROUNDS = 10;
const ECO_NOTIFICATION_FIELDS = [
  'notify_eco_created',
  'notify_eco_approved',
  'notify_eco_rejected',
  'notify_eco_pending_approval',
  'notify_eco_stage_advanced',
];
const ECO_NOTIFICATION_DEFAULTS = {
  notify_eco_created: false,
  notify_eco_approved: false,
  notify_eco_rejected: false,
  notify_eco_pending_approval: false,
  notify_eco_stage_advanced: false,
};
const VALID_USER_ROLES = Object.freeze([
  'read-only',
  'reviewer',
  'lab',
  'read-write',
  'approver',
  'admin',
]);

const pickEcoNotificationPreferences = (row = {}) => ECO_NOTIFICATION_FIELDS.reduce(
  (preferences, key) => ({
    ...preferences,
    [key]: row[key] ?? ECO_NOTIFICATION_DEFAULTS[key],
  }),
  { ...ECO_NOTIFICATION_DEFAULTS },
);

/**
 * Login - Authenticate user and set JWT cookie
 */
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username and password are required', 
      });
    }

    // Find user by username
    const result = await pool.query(
      'SELECT id, username, password_hash, role, is_active, display_name FROM users WHERE username = $1',
      [username],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Invalid username or password', 
      });
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({ 
        error: 'Account is disabled', 
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ 
        error: 'Invalid username or password', 
      });
    }

    // Update last login timestamp
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id],
    );

    // Log activity
    try {
      await pool.query(
        `INSERT INTO user_activity_log (type_name, description, user_id)
         VALUES ('user_login', $1, $2)`,
        [`User ${username} logged in`, user.id],
      );
      await pool.query(
        `INSERT INTO activity_log (component_id, user_id, part_number, activity_type, details)
         VALUES (NULL, $1, '', 'user_login', $2)`,
        [user.id, JSON.stringify({ username: user.username, role: user.role })],
      );
    } catch (logError) {
      console.error('Failed to log login activity:', logError);
    }

    // Generate JWT token
    const token = generateToken(user);

    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

    // Return user info only; JWT stays in the HttpOnly cookie
    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        displayName: user.display_name,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

/**
 * Verify - Check if current token is valid
 */
export const verify = async (req, res) => {
  try {
    // User is already authenticated by middleware
    // Fetch fresh user data to ensure account is still active
    const result = await pool.query(
      'SELECT id, username, role, is_active, display_name FROM users WHERE id = $1',
      [req.user.userId],
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(401).json({ 
        error: 'User account not found or disabled', 
      });
    }

    const user = result.rows[0];

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        displayName: user.display_name,
      },
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
};

/**
 * Logout - Clear JWT cookie and log activity
 */
export const logout = async (req, res) => {
  try {
    // Log activity
    if (req.user) {
      try {
        await pool.query(
          `INSERT INTO user_activity_log (type_name, description, user_id)
           VALUES ('user_logout', $1, $2)`,
          [`User ${req.user.username} logged out`, req.user.userId],
        );
        await pool.query(
          `INSERT INTO activity_log (component_id, user_id, part_number, activity_type, details)
           VALUES (NULL, $1, '', 'user_logout', $2)`,
          [req.user.userId, JSON.stringify({ username: req.user.username })],
        );
      } catch (logError) {
        console.error('Failed to log logout activity:', logError);
      }
    }

    res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieOptions({ clear: true }));

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
};

/**
 * Get all users (Admin only)
 */
export const getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.username,
        u.role,
        created_at(u.id) as created_at,
        u.last_login,
        u.is_active,
        creator.username as created_by_username
      FROM users u
      LEFT JOIN users creator ON u.created_by = creator.id
      ORDER BY u.id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

/**
 * Create new user (Admin only)
 */
export const createUser = async (req, res) => {
  try {
    const { username, password, role, display_name, email } = req.body;

    // Validation
    if (!username || !role) {
      return res.status(400).json({ 
        error: 'Username and role are required', 
      });
    }

    if (!VALID_USER_ROLES.includes(role)) {
      return res.status(400).json({
        error: 'Invalid role. Must be: read-only, reviewer, lab, read-write, approver, or admin',
      });
    }

    if (username.length < 3 || username.length > 50) {
      return res.status(400).json({ 
        error: 'Username must be between 3 and 50 characters', 
      });
    }

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format', 
      });
    }

    // Generate password if not provided, otherwise validate length
    let userPassword = password;
    let passwordWasGenerated = false;
    if (!password) {
      // Generate random 8 character alphanumeric password
      userPassword = crypto.randomBytes(6).toString('base64').slice(0, 8);
      passwordWasGenerated = true;
    } else if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters', 
      });
    }

    // Check if username already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username],
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Username already exists', 
      });
    }

    // Hash password
    const password_hash = await bcrypt.hash(userPassword, SALT_ROUNDS);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, role, display_name, email, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, role, display_name, email, created_at(id) as created_at, is_active`,
      [username, password_hash, role, display_name || null, email || null, req.user.userId],
    );

    const newUser = result.rows[0];

    // Log activity
    try {
      await pool.query(
        `INSERT INTO user_activity_log (type_name, description, user_id)
         VALUES ('user_created', $1, $2)`,
        [`Created user: ${username} with role: ${role}`, req.user.userId],
      );
    } catch (logError) {
      console.error('Failed to log user creation:', logError);
    }

    const shouldSendWelcomeEmail = email && role !== 'read-only';

    // Send welcome email if email is provided for eligible roles
    if (shouldSendWelcomeEmail) {
      try {
        await sendWelcomeEmail({
          to: email,
          username,
          role,
          displayName: display_name,
          password: userPassword,
          passwordWasGenerated,
        });
        console.log(`\x1b[32m[INFO]\x1b[0m \x1b[36m[AuthController]\x1b[0m Welcome email sent to ${email}`);
      } catch (emailError) {
        console.error(`\x1b[33m[WARN]\x1b[0m \x1b[36m[AuthController]\x1b[0m Failed to send welcome email: ${emailError.message}`);
        // Don't fail the request if email fails
      }
    }

    res.status(201).json({
      ...newUser,
      passwordGenerated: passwordWasGenerated,
      emailSent: !!shouldSendWelcomeEmail,
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

/**
 * Update user (Admin only)
 */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, role, is_active } = req.body;

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id, username FROM users WHERE id = $1',
      [id],
    );

    if (existingUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (username !== undefined) {
      // Check if new username is taken
      if (username !== existingUser.rows[0].username) {
        const duplicateCheck = await pool.query(
          'SELECT id FROM users WHERE username = $1 AND id != $2',
          [username, id],
        );
        if (duplicateCheck.rows.length > 0) {
          return res.status(409).json({ error: 'Username already exists' });
        }
      }
      updates.push(`username = $${paramCount++}`);
      values.push(username);
    }

    if (password !== undefined && password.length > 0) {
      if (password.length < 6) {
        return res.status(400).json({ 
          error: 'Password must be at least 6 characters', 
        });
      }
      const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
      updates.push(`password_hash = $${paramCount++}`);
      values.push(password_hash);
    }

    if (role !== undefined) {
      if (!VALID_USER_ROLES.includes(role)) {
        return res.status(400).json({
          error: 'Invalid role',
        });
      }
      updates.push(`role = $${paramCount++}`);
      values.push(role);
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE users 
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, username, role, is_active, created_at(id) as created_at, last_login`,
      values,
    );

    // Log activity
    try {
      await pool.query(
        `INSERT INTO user_activity_log (type_name, description, user_id)
         VALUES ('user_updated', $1, $2)`,
        [`Updated user: ${result.rows[0].username}`, req.user.userId],
      );
    } catch (logError) {
      console.error('Failed to log user update:', logError);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

/**
 * Delete user (Admin only)
 */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (id === req.user.userId) {
      return res.status(400).json({ 
        error: 'Cannot delete your own account', 
      });
    }

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT username FROM users WHERE id = $1',
      [id],
    );

    if (existingUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const username = existingUser.rows[0].username;

    // Delete user
    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    // Log activity
    try {
      await pool.query(
        `INSERT INTO user_activity_log (type_name, description, user_id)
         VALUES ('user_deleted', $1, $2)`,
        [`Deleted user: ${username}`, req.user.userId],
      );
    } catch (logError) {
      console.error('Failed to log user deletion:', logError);
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

/**
 * Change own password
 */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Current password and new password are required', 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: 'New password must be at least 6 characters', 
      });
    }

    // Get current user's password hash
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(
      currentPassword, 
      result.rows[0].password_hash,
    );

    if (!isValidPassword) {
      return res.status(401).json({ 
        error: 'Current password is incorrect', 
      });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, req.user.userId],
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
};

/**
 * Get current user profile
 */
export const getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, role, email, display_name, notification_preferences, file_storage_path,
              created_at(id) as created_at, last_login, is_active
       FROM users WHERE id = $1`,
      [req.user.userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      email: user.email,
      displayName: user.display_name,
      fileStoragePath: user.file_storage_path || '',
      notificationPreferences: user.notification_preferences || {
        eco_submitted: true,
        eco_approved: true,
        eco_rejected: true,
        eco_assigned: true,
        component_updated: false,
        low_stock: false,
      },
      createdAt: user.created_at,
      lastLogin: user.last_login,
      isActive: user.is_active,
    });
  } catch (error) {
    console.error('[error] [Auth] Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

/**
 * Update current user profile (email, display name)
 */
export const updateProfile = async (req, res) => {
  try {
    const { email, displayName, fileStoragePath } = req.body;

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate display name length if provided
    if (displayName && displayName.length > 100) {
      return res.status(400).json({ error: 'Display name must be 100 characters or less' });
    }

    // Update profile
    const result = await pool.query(
      `UPDATE users
       SET email = $1, display_name = $2, file_storage_path = $3
       WHERE id = $4
       RETURNING id, username, email, display_name, file_storage_path`,
      [email || null, displayName || null, fileStoragePath || null, req.user.userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Log activity
    try {
      await pool.query(
        `INSERT INTO user_activity_log (type_name, description, user_id)
         VALUES ('profile_updated', $1, $2)`,
        [`User ${req.user.username} updated their profile`, req.user.userId],
      );
    } catch (logError) {
      console.error('[error] [Auth] Failed to log profile update:', logError);
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: result.rows[0].id,
        username: result.rows[0].username,
        email: result.rows[0].email,
        displayName: result.rows[0].display_name,
        fileStoragePath: result.rows[0].file_storage_path || '',
      },
    });
  } catch (error) {
    console.error('[error] [Auth] Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

/**
 * Get effective file storage path for current user
 */
export const getFileStoragePath = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT file_storage_path FROM users WHERE id = $1',
      [req.user.userId],
    );

    const userPath = result.rows[0]?.file_storage_path || '';
    res.json({ path: userPath || process.env.FILE_STORAGE_PATH || '' });
  } catch (error) {
    console.error('[error] [Auth] Get file storage path error:', error);
    res.status(500).json({ error: 'Failed to fetch file storage path' });
  }
};

/**
 * Get notification preferences
 */
export const getNotificationPreferences = async (req, res) => {
  try {
    const [preferencesResult, delegatesResult] = await Promise.all([
      pool.query(`
        SELECT
          u.delegation,
          enp.notify_eco_created,
          enp.notify_eco_approved,
          enp.notify_eco_rejected,
          enp.notify_eco_pending_approval,
          enp.notify_eco_stage_advanced
        FROM users u
        LEFT JOIN email_notification_preferences enp ON enp.user_id = u.id
        WHERE u.id = $1
      `, [req.user.userId]),
      pool.query(`
        SELECT id, username, display_name, role
        FROM users
        WHERE is_active = true AND id <> $1
        ORDER BY COALESCE(NULLIF(BTRIM(display_name), ''), username), username
      `, [req.user.userId]),
    ]);

    if (preferencesResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const preferencesRow = preferencesResult.rows[0];
    const eligibleDelegates = delegatesResult.rows.filter((delegate) => canDelegateToRole(req.user.role, delegate.role));

    res.json({
      ...pickEcoNotificationPreferences(preferencesRow),
      delegation: preferencesRow.delegation || null,
      availableDelegates: eligibleDelegates,
    });
  } catch (error) {
    console.error('[error] [Auth] Get notification preferences error:', error);
    res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
};

/**
 * Update notification preferences
 */
export const updateNotificationPreferences = async (req, res) => {
  try {
    const { delegation, ...preferences } = req.body || {};
    const invalidKeys = Object.keys(preferences).filter((key) => !ECO_NOTIFICATION_FIELDS.includes(key));

    if (invalidKeys.length > 0) {
      return res.status(400).json({
        error: `Invalid preference keys: ${invalidKeys.join(', ')}. Valid keys are: ${ECO_NOTIFICATION_FIELDS.join(', ')}`,
      });
    }

    for (const [key, value] of Object.entries(preferences)) {
      if (typeof value !== 'boolean') {
        return res.status(400).json({
          error: `Preference "${key}" must be a boolean value`,
        });
      }
    }

    const nextDelegation = delegation === '' ? null : delegation ?? null;

    if (nextDelegation !== null && typeof nextDelegation !== 'string') {
      return res.status(400).json({ error: 'Delegation must be a user ID or null' });
    }

    if (nextDelegation === req.user.userId) {
      return res.status(400).json({ error: 'Delegation cannot target your own account' });
    }

    const [currentResult, delegateResult] = await Promise.all([
      pool.query(`
        SELECT
          u.id,
          enp.notify_eco_created,
          enp.notify_eco_approved,
          enp.notify_eco_rejected,
          enp.notify_eco_pending_approval,
          enp.notify_eco_stage_advanced
        FROM users u
        LEFT JOIN email_notification_preferences enp ON enp.user_id = u.id
        WHERE u.id = $1
      `, [req.user.userId]),
      nextDelegation === null
        ? Promise.resolve({ rows: [{ id: null }] })
        : pool.query(
          'SELECT id, role FROM users WHERE id = $1 AND is_active = true',
          [nextDelegation],
        ),
    ]);

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (delegateResult.rows.length === 0) {
      return res.status(400).json({ error: 'Delegation must target an active user' });
    }

    if (nextDelegation !== null && !canDelegateToRole(req.user.role, delegateResult.rows[0].role)) {
      return res.status(400).json({ error: 'Delegation must target a user with the same or higher role' });
    }

    const currentPreferences = pickEcoNotificationPreferences(currentResult.rows[0]);
    const mergedPreferences = { ...currentPreferences, ...preferences };
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await client.query(
        'UPDATE users SET delegation = $1 WHERE id = $2',
        [nextDelegation, req.user.userId],
      );

      await client.query(`
        INSERT INTO email_notification_preferences (
          user_id,
          notify_eco_created,
          notify_eco_approved,
          notify_eco_rejected,
          notify_eco_pending_approval,
          notify_eco_stage_advanced
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id) DO UPDATE SET
          notify_eco_created = EXCLUDED.notify_eco_created,
          notify_eco_approved = EXCLUDED.notify_eco_approved,
          notify_eco_rejected = EXCLUDED.notify_eco_rejected,
          notify_eco_pending_approval = EXCLUDED.notify_eco_pending_approval,
          notify_eco_stage_advanced = EXCLUDED.notify_eco_stage_advanced,
          updated_at = CURRENT_TIMESTAMP
      `, [
        req.user.userId,
        mergedPreferences.notify_eco_created,
        mergedPreferences.notify_eco_approved,
        mergedPreferences.notify_eco_rejected,
        mergedPreferences.notify_eco_pending_approval,
        mergedPreferences.notify_eco_stage_advanced,
      ]);

      await client.query('COMMIT');
    } catch (transactionError) {
      await client.query('ROLLBACK');
      throw transactionError;
    } finally {
      client.release();
    }

    try {
      await pool.query(
        `INSERT INTO user_activity_log (type_name, description, user_id)
         VALUES ('notification_preferences_updated', $1, $2)`,
        [`User ${req.user.username} updated ECO preferences`, req.user.userId],
      );
    } catch (logError) {
      console.error('[error] [Auth] Failed to log notification preferences update:', logError);
    }

    res.json({
      message: 'ECO preferences updated successfully',
      ...mergedPreferences,
      delegation: nextDelegation,
    });
  } catch (error) {
    console.error('[error] [Auth] Update notification preferences error:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
};
