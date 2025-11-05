import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import { generateToken } from '../middleware/auth.js';

const SALT_ROUNDS = 10;

/**
 * Login - Authenticate user and return JWT token
 */
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username and password are required' 
      });
    }

    // Find user by username
    const result = await pool.query(
      'SELECT id, username, password_hash, role, is_active FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Invalid username or password' 
      });
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({ 
        error: 'Account is disabled' 
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ 
        error: 'Invalid username or password' 
      });
    }

    // Update last login timestamp
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Log activity
    try {
      await pool.query(
        `INSERT INTO user_activity_log (type_name, description, user_id)
         VALUES ('user_login', $1, $2)`,
        [`User ${username} logged in`, user.id]
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
        role: user.role
      }
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
      [req.user.userId]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(401).json({ 
        error: 'User account not found or disabled' 
      });
    }

    const user = result.rows[0];

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
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
          [`User ${req.user.username} logged out`, req.user.userId]
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
    const { username, password, role } = req.body;

    // Validation
    if (!username || !password || !role) {
      return res.status(400).json({ 
        error: 'Username, password, and role are required' 
      });
    }

    if (!['read-only', 'read-write', 'approver', 'admin'].includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role. Must be: read-only, read-write, approver, or admin' 
      });
    }

    if (username.length < 3 || username.length > 50) {
      return res.status(400).json({ 
        error: 'Username must be between 3 and 50 characters' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters' 
      });
    }

    // Check if username already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Username already exists' 
      });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, role, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, role, created_at, is_active`,
      [username, password_hash, role, req.user.userId]
    );

    const newUser = result.rows[0];

    // Log activity
    try {
      await pool.query(
        `INSERT INTO user_activity_log (type_name, description, user_id)
         VALUES ('user_created', $1, $2)`,
        [`Created user: ${username} with role: ${role}`, req.user.userId]
      );
    } catch (logError) {
      console.error('Failed to log user creation:', logError);
    }

    res.status(201).json(newUser);
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
      [id]
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
          [username, id]
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
          error: 'Password must be at least 6 characters' 
        });
      }
      const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
      updates.push(`password_hash = $${paramCount++}`);
      values.push(password_hash);
    }

    if (role !== undefined) {
      if (!['read-only', 'read-write', 'approver', 'admin'].includes(role)) {
        return res.status(400).json({ 
          error: 'Invalid role' 
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
      values
    );

    // Log activity
    try {
      await pool.query(
        `INSERT INTO user_activity_log (type_name, description, user_id)
         VALUES ('user_updated', $1, $2)`,
        [`Updated user: ${result.rows[0].username}`, req.user.userId]
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
    if (parseInt(id) === req.user.userId) {
      return res.status(400).json({ 
        error: 'Cannot delete your own account' 
      });
    }

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT username FROM users WHERE id = $1',
      [id]
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
        [`Deleted user: ${username}`, req.user.userId]
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
        error: 'Current password and new password are required' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: 'New password must be at least 6 characters' 
      });
    }

    // Get current user's password hash
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(
      currentPassword, 
      result.rows[0].password_hash
    );

    if (!isValidPassword) {
      return res.status(401).json({ 
        error: 'Current password is incorrect' 
      });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, req.user.userId]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
};
