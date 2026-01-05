import pool from '../config/database.js';
import { encrypt, decrypt, testSMTPConnection, sendEmail } from '../services/emailService.js';

/**
 * Get SMTP settings (without password)
 */
export const getSMTPSettings = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM smtp_settings LIMIT 1');
    
    if (result.rows.length === 0) {
      return res.json({ configured: false });
    }

    const settings = result.rows[0];
    // Don't send the encrypted password to the client
    delete settings.auth_password_encrypted;
    
    res.json({ configured: true, ...settings });
  } catch (error) {
    console.error('Error getting SMTP settings:', error);
    res.status(500).json({ error: 'Failed to get SMTP settings' });
  }
};

/**
 * Save/Update SMTP settings
 */
export const saveSMTPSettings = async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      host,
      port,
      secure,
      no_auth,
      auth_user,
      auth_password,
      from_address,
      from_name,
      enabled,
    } = req.body;

    // Validate required fields
    if (!host || !from_address) {
      return res.status(400).json({ error: 'Host and from_address are required' });
    }

    // Check if settings exist
    const existing = await client.query('SELECT id FROM smtp_settings LIMIT 1');

    let encryptedPassword = null;
    if (auth_password) {
      encryptedPassword = encrypt(auth_password);
    }

    if (existing.rows.length > 0) {
      // Update existing settings
      const updateQuery = `
        UPDATE smtp_settings SET
          host = $1,
          port = $2,
          secure = $3,
          no_auth = $4,
          auth_user = $5,
          ${auth_password ? 'auth_password_encrypted = $6,' : ''}
          from_address = $${auth_password ? 7 : 6},
          from_name = $${auth_password ? 8 : 7},
          enabled = $${auth_password ? 9 : 8},
          updated_at = CURRENT_TIMESTAMP,
          updated_by = $${auth_password ? 10 : 9}
        WHERE id = $${auth_password ? 11 : 10}
        RETURNING *
      `;

      const params = auth_password
        ? [host, port || 587, secure || false, no_auth || false, auth_user, encryptedPassword, 
           from_address, from_name || 'IC Library System', enabled || false, req.user.id, existing.rows[0].id]
        : [host, port || 587, secure || false, no_auth || false, auth_user,
           from_address, from_name || 'IC Library System', enabled || false, req.user.id, existing.rows[0].id];

      const result = await client.query(updateQuery, params);
      const settings = result.rows[0];
      delete settings.auth_password_encrypted;
      res.json({ message: 'SMTP settings updated', ...settings });
    } else {
      // Insert new settings
      const insertQuery = `
        INSERT INTO smtp_settings (
          host, port, secure, no_auth, auth_user, auth_password_encrypted,
          from_address, from_name, enabled, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const result = await client.query(insertQuery, [
        host, port || 587, secure || false, no_auth || false, auth_user, encryptedPassword,
        from_address, from_name || 'IC Library System', enabled || false, req.user.id,
      ]);

      const settings = result.rows[0];
      delete settings.auth_password_encrypted;
      res.json({ message: 'SMTP settings created', ...settings });
    }
  } catch (error) {
    console.error('Error saving SMTP settings:', error);
    res.status(500).json({ error: 'Failed to save SMTP settings' });
  } finally {
    client.release();
  }
};

/**
 * Test SMTP connection
 */
export const testSMTP = async (req, res) => {
  try {
    const result = await testSMTPConnection();
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error testing SMTP:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Send a test email to the current user
 */
export const sendTestEmail = async (req, res) => {
  try {
    // Get user email
    const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0 || !userResult.rows[0].email) {
      return res.status(400).json({ error: 'No email address configured for your account' });
    }

    const result = await sendEmail({
      to: userResult.rows[0].email,
      subject: 'IC Library Test Email',
      html: `
        <h2>Test Email from IC Library</h2>
        <p>This is a test email to confirm your SMTP configuration is working correctly.</p>
        <p>If you received this email, your email notifications are properly configured.</p>
        <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
      `,
    });

    if (result.success) {
      res.json({ success: true, message: 'Test email sent successfully' });
    } else {
      res.status(400).json({ success: false, error: result.error || result.reason });
    }
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get notification preferences for current user
 */
export const getNotificationPreferences = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM email_notification_preferences WHERE user_id = $1',
      [req.user.id],
    );

    if (result.rows.length === 0) {
      // Return defaults if no preferences set
      return res.json({
        notify_eco_created: true,
        notify_eco_approved: true,
        notify_eco_rejected: true,
        notify_eco_pending_approval: true,
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    res.status(500).json({ error: 'Failed to get notification preferences' });
  }
};

/**
 * Update notification preferences for current user
 */
export const updateNotificationPreferences = async (req, res) => {
  try {
    const {
      notify_eco_created,
      notify_eco_approved,
      notify_eco_rejected,
      notify_eco_pending_approval,
    } = req.body;

    const result = await pool.query(`
      INSERT INTO email_notification_preferences (
        user_id, notify_eco_created, notify_eco_approved, 
        notify_eco_rejected, notify_eco_pending_approval
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id) DO UPDATE SET
        notify_eco_created = EXCLUDED.notify_eco_created,
        notify_eco_approved = EXCLUDED.notify_eco_approved,
        notify_eco_rejected = EXCLUDED.notify_eco_rejected,
        notify_eco_pending_approval = EXCLUDED.notify_eco_pending_approval,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      req.user.id,
      notify_eco_created ?? true,
      notify_eco_approved ?? true,
      notify_eco_rejected ?? true,
      notify_eco_pending_approval ?? true,
    ]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
};

export default {
  getSMTPSettings,
  saveSMTPSettings,
  testSMTP,
  sendTestEmail,
  getNotificationPreferences,
  updateNotificationPreferences,
};
