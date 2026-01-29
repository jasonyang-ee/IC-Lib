import nodemailer from 'nodemailer';
import crypto from 'crypto';
import pool from '../config/database.js';

// Encryption key for SMTP password (should be set in environment variables)
const ENCRYPTION_KEY = process.env.SMTP_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32);
const IV_LENGTH = 16;

/**
 * Encrypt a string using AES-256-CBC
 */
export function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypt a string encrypted with AES-256-CBC
 */
export function decrypt(text) {
  if (!text) return null;
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[EmailService]\x1b[0m Error decrypting: ${error.message}`);
    return null;
  }
}

/**
 * Get SMTP settings from database
 */
export async function getSMTPSettings() {
  try {
    const result = await pool.query('SELECT * FROM smtp_settings LIMIT 1');
    if (result.rows.length === 0) {
      return null;
    }
    return result.rows[0];
  } catch (error) {
    console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[EmailService]\x1b[0m Error getting SMTP settings: ${error.message}`);
    return null;
  }
}

/**
 * Create nodemailer transporter from SMTP settings
 */
export async function createTransporter() {
  const settings = await getSMTPSettings();
  if (!settings || !settings.enabled) {
    return null;
  }

  const transportConfig = {
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    // Allow self-signed/expired certificates for open relay servers
    tls: {
      rejectUnauthorized: false,
    },
    // Connection timeout settings
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 30000,
  };

  if (!settings.no_auth && settings.auth_user) {
    transportConfig.auth = {
      user: settings.auth_user,
      pass: decrypt(settings.auth_password_encrypted),
    };
  }

  return nodemailer.createTransport(transportConfig);
}

/**
 * Send an email
 */
export async function sendEmail({ to, subject, html, text }) {
  const transporter = await createTransporter();
  if (!transporter) {
    console.log(`\x1b[33m[WARN]\x1b[0m \x1b[36m[EmailService]\x1b[0m SMTP not configured or disabled, skipping email`);
    return { success: false, reason: 'SMTP not configured' };
  }

  const settings = await getSMTPSettings();

  try {
    const info = await transporter.sendMail({
      from: `"${settings.from_name}" <${settings.from_address}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });

    // Log the email
    await pool.query(`
      INSERT INTO email_log (recipient_email, subject, template_name, status)
      VALUES ($1, $2, $3, 'sent')
    `, [to, subject, 'generic']);

    console.log(`\x1b[32m[INFO]\x1b[0m \x1b[36m[EmailService]\x1b[0m Email sent to ${to}: ${subject}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[EmailService]\x1b[0m Failed to send email to ${to}: ${error.message}`);

    // Log the failure
    await pool.query(`
      INSERT INTO email_log (recipient_email, subject, template_name, status, error_message)
      VALUES ($1, $2, $3, 'failed', $4)
    `, [to, subject, 'generic', error.message]);

    return { success: false, error: error.message };
  }
}

/**
 * Test SMTP connection
 */
export async function testSMTPConnection() {
  const transporter = await createTransporter();
  if (!transporter) {
    return { success: false, error: 'SMTP not configured or disabled' };
  }

  try {
    await transporter.verify();
    return { success: true, message: 'SMTP connection verified successfully' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get users who should receive ECO notifications
 */
async function getECONotificationRecipients(notificationType) {
  try {
    // Map notification type to column name
    const columnMap = {
      'eco_created': 'notify_eco_created',
      'eco_approved': 'notify_eco_approved',
      'eco_rejected': 'notify_eco_rejected',
      'eco_pending_approval': 'notify_eco_pending_approval',
    };

    const column = columnMap[notificationType];
    if (!column) return [];

    // For pending approval notifications, only get users who can approve
    let query = `
      SELECT u.id, u.email, u.username, u.role
      FROM users u
      LEFT JOIN email_notification_preferences enp ON u.id = enp.user_id
      WHERE u.email IS NOT NULL
        AND (enp.${column} = true OR enp.${column} IS NULL)
    `;

    if (notificationType === 'eco_pending_approval') {
      query += ' AND u.role IN (\'admin\', \'approver\')';
    }

    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[EmailService]\x1b[0m Error getting ECO notification recipients: ${error.message}`);
    return [];
  }
}

/**
 * Generate ECO notification HTML email
 */
function generateECOEmailHTML(eco, actionType, additionalInfo = {}) {
  const baseUrl = process.env.APP_URL || 'http://localhost:5173';
  
  const titles = {
    'eco_created': 'New ECO Created',
    'eco_approved': 'ECO Approved',
    'eco_rejected': 'ECO Rejected',
  };

  const statusColors = {
    'eco_created': '#FFA500',  // Orange
    'eco_approved': '#28a745', // Green
    'eco_rejected': '#dc3545', // Red
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: ${statusColors[actionType] || '#007bff'}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px; }
    .field { margin-bottom: 10px; }
    .label { font-weight: bold; color: #555; }
    .value { color: #333; }
    .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">${titles[actionType] || 'ECO Notification'}</h2>
    </div>
    <div class="content">
      <div class="field">
        <span class="label">ECO Number:</span>
        <span class="value">${eco.eco_number}</span>
      </div>
      <div class="field">
        <span class="label">Component:</span>
        <span class="value">${eco.part_number} - ${eco.component_description || 'No description'}</span>
      </div>
      <div class="field">
        <span class="label">Initiated By:</span>
        <span class="value">${eco.initiated_by_name || 'Unknown'}</span>
      </div>
      ${actionType === 'eco_approved' ? `
      <div class="field">
        <span class="label">Approved By:</span>
        <span class="value">${additionalInfo.approved_by_name || 'Unknown'}</span>
      </div>
      ` : ''}
      ${actionType === 'eco_rejected' ? `
      <div class="field">
        <span class="label">Rejected By:</span>
        <span class="value">${additionalInfo.rejected_by_name || 'Unknown'}</span>
      </div>
      <div class="field">
        <span class="label">Rejection Reason:</span>
        <span class="value">${eco.rejection_reason || 'No reason provided'}</span>
      </div>
      ` : ''}
      ${eco.notes ? `
      <div class="field">
        <span class="label">Notes:</span>
        <span class="value">${eco.notes}</span>
      </div>
      ` : ''}
      <a href="${baseUrl}/eco" class="button">View ECO Details</a>
    </div>
    <div class="footer">
      <p>This is an automated notification from IC Library. You can manage your notification preferences in your user settings.</p>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Send ECO notification emails
 */
export async function sendECONotification(eco, actionType, additionalInfo = {}) {
  // Check if SMTP is configured
  const settings = await getSMTPSettings();
  if (!settings || !settings.enabled) {
    console.log(`\x1b[33m[WARN]\x1b[0m \x1b[36m[EmailService]\x1b[0m SMTP not configured, skipping ECO notification`);
    return;
  }

  // Get recipients based on action type
  const recipients = await getECONotificationRecipients(actionType);
  if (recipients.length === 0) {
    console.log(`\x1b[33m[WARN]\x1b[0m \x1b[36m[EmailService]\x1b[0m No recipients for ECO notification`);
    return;
  }

  // Generate email content
  const subjects = {
    'eco_created': `[ECO-${eco.eco_number}] New Engineering Change Order Created`,
    'eco_approved': `[ECO-${eco.eco_number}] Engineering Change Order Approved`,
    'eco_rejected': `[ECO-${eco.eco_number}] Engineering Change Order Rejected`,
  };

  const subject = subjects[actionType] || `ECO Notification: ${eco.eco_number}`;
  const html = generateECOEmailHTML(eco, actionType, additionalInfo);

  // Send to all recipients
  const results = await Promise.all(
    recipients.map(recipient => 
      sendEmail({
        to: recipient.email,
        subject,
        html,
      }).then(result => ({
        ...result,
        recipient: recipient.email,
      })),
    ),
  );

  // Log results
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`\x1b[32m[INFO]\x1b[0m \x1b[36m[EmailService]\x1b[0m ECO ${actionType} notifications: ${successful} sent, ${failed} failed`);

  // Log to email_log with ECO reference
  for (const result of results) {
    if (result.success) {
      await pool.query(`
        UPDATE email_log 
        SET eco_id = $1 
        WHERE recipient_email = $2 AND subject = $3 
        ORDER BY created_at DESC LIMIT 1
      `, [eco.id, result.recipient, subject]);
    }
  }

  return results;
}

export default {
  encrypt,
  decrypt,
  getSMTPSettings,
  createTransporter,
  sendEmail,
  testSMTPConnection,
  sendECONotification,
};
