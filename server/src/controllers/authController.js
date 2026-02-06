import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import pool from '../config/database.js';
import { generateToken } from '../middleware/auth.js';
import { sendEmail } from '../services/emailService.js';

const SALT_ROUNDS = 10;

/**
 * Login - Authenticate user and return JWT token
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
      'SELECT id, username, password_hash, role, is_active FROM users WHERE username = $1',
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

    // Return token and user info
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
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
      'SELECT id, username, role, is_active FROM users WHERE id = $1',
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
      },
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
};

/**
 * Logout - Client-side token deletion, log activity
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
        u.created_at, 
        u.last_login, 
        u.is_active,
        creator.username as created_by_username
      FROM users u
      LEFT JOIN users creator ON u.created_by = creator.id
      ORDER BY u.created_at DESC
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

    if (!['read-only', 'read-write', 'approver', 'admin'].includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role. Must be: read-only, read-write, approver, or admin', 
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
       RETURNING id, username, role, display_name, email, created_at, is_active`,
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

    // Send welcome email if email is provided
    if (email) {
      try {
        const loginUrl = process.env.APP_URL || 'http://localhost:3000';
        await sendEmail({
          to: email,
          subject: 'Welcome to IC-Lib - Your Account Has Been Created',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">Welcome to IC-Lib!</h2>
              <p>Hello${display_name ? ` ${display_name}` : ''},</p>
              <p>Your account has been created with the following credentials:</p>
              <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p style="margin: 4px 0;"><strong>Username:</strong> ${username}</p>
                ${passwordWasGenerated ? `<p style="margin: 4px 0;"><strong>Password:</strong> ${userPassword}</p>` : '<p style="margin: 4px 0;"><strong>Password:</strong> (as provided by administrator)</p>'}
                <p style="margin: 4px 0;"><strong>Role:</strong> ${role}</p>
              </div>
              ${passwordWasGenerated ? '<p style="color: #dc2626;"><strong>Important:</strong> Please change your password after your first login.</p>' : ''}
              <p>You can login at: <a href="${loginUrl}">${loginUrl}</a></p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
              <p style="color: #6b7280; font-size: 12px;">This is an automated message from IC-Lib. Please do not reply to this email.</p>
            </div>
          `,
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
      emailSent: !!email,
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
      if (!['read-only', 'read-write', 'approver', 'admin'].includes(role)) {
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
       RETURNING id, username, role, is_active, created_at, last_login`,
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
      `SELECT id, username, role, email, display_name, notification_preferences, 
              created_at, last_login, is_active 
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
    const { email, displayName } = req.body;

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
       SET email = $1, display_name = $2 
       WHERE id = $3 
       RETURNING id, username, email, display_name`,
      [email || null, displayName || null, req.user.userId],
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
      },
    });
  } catch (error) {
    console.error('[error] [Auth] Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

/**
 * Get notification preferences
 */
export const getNotificationPreferences = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT notification_preferences FROM users WHERE id = $1',
      [req.user.userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return default preferences if null
    const preferences = result.rows[0].notification_preferences || {
      eco_submitted: true,
      eco_approved: true,
      eco_rejected: true,
      eco_assigned: true,
      component_updated: false,
      low_stock: false,
    };

    res.json(preferences);
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
    const preferences = req.body;

    // Validate preferences structure
    const validKeys = ['eco_submitted', 'eco_approved', 'eco_rejected', 'eco_assigned', 'component_updated', 'low_stock'];
    const invalidKeys = Object.keys(preferences).filter(key => !validKeys.includes(key));
    
    if (invalidKeys.length > 0) {
      return res.status(400).json({ 
        error: `Invalid preference keys: ${invalidKeys.join(', ')}. Valid keys are: ${validKeys.join(', ')}`, 
      });
    }

    // Ensure all values are booleans
    for (const [key, value] of Object.entries(preferences)) {
      if (typeof value !== 'boolean') {
        return res.status(400).json({ 
          error: `Preference "${key}" must be a boolean value`, 
        });
      }
    }

    // Get current preferences and merge
    const currentResult = await pool.query(
      'SELECT notification_preferences FROM users WHERE id = $1',
      [req.user.userId],
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentPreferences = currentResult.rows[0].notification_preferences || {};
    const mergedPreferences = { ...currentPreferences, ...preferences };

    // Update preferences
    await pool.query(
      'UPDATE users SET notification_preferences = $1 WHERE id = $2',
      [JSON.stringify(mergedPreferences), req.user.userId],
    );

    // Log activity
    try {
      await pool.query(
        `INSERT INTO user_activity_log (type_name, description, user_id)
         VALUES ('notification_preferences_updated', $1, $2)`,
        [`User ${req.user.username} updated notification preferences`, req.user.userId],
      );
    } catch (logError) {
      console.error('[error] [Auth] Failed to log notification preferences update:', logError);
    }

    res.json({
      message: 'Notification preferences updated successfully',
      preferences: mergedPreferences,
    });
  } catch (error) {
    console.error('[error] [Auth] Update notification preferences error:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
};
