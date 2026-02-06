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
    console.log('\x1b[33m[WARN]\x1b[0m \x1b[36m[EmailService]\x1b[0m SMTP not configured or disabled, skipping email');
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
      'eco_stage_advanced': 'notify_eco_stage_advanced',
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
    'eco_stage_advanced': 'ECO Stage Advanced',
  };

  const subtitles = {
    'eco_created': 'A new Engineering Change Order has been submitted for review.',
    'eco_approved': 'An Engineering Change Order has been approved and changes have been applied.',
    'eco_rejected': 'An Engineering Change Order has been rejected.',
    'eco_stage_advanced': 'An Engineering Change Order has advanced to the next approval stage.',
  };

  const statusColors = {
    'eco_created': '#e67e22',
    'eco_approved': '#27ae60',
    'eco_rejected': '#e74c3c',
    'eco_stage_advanced': '#3498db',
  };

  const headerColor = statusColors[actionType] || '#3498db';

  // Build detail rows
  const rows = [];
  rows.push({ label: 'ECO Number', value: eco.eco_number });
  rows.push({ label: 'Component', value: `${eco.part_number} — ${eco.component_description || 'No description'}` });
  rows.push({ label: 'Initiated By', value: eco.initiated_by_name || 'Unknown' });

  if (actionType === 'eco_approved') {
    rows.push({ label: 'Approved By', value: additionalInfo.approved_by_name || 'Unknown' });
  }
  if (actionType === 'eco_rejected') {
    rows.push({ label: 'Rejected By', value: additionalInfo.rejected_by_name || 'Unknown' });
    rows.push({ label: 'Reason', value: eco.rejection_reason || 'No reason provided' });
  }
  if (actionType === 'eco_stage_advanced') {
    rows.push({ label: 'Previous Stage', value: additionalInfo.from_stage || 'Unknown' });
    rows.push({ label: 'Current Stage', value: additionalInfo.to_stage || 'Unknown' });
  }
  if (eco.notes) {
    rows.push({ label: 'Notes', value: eco.notes });
  }

  const detailRowsHTML = rows.map(({ label, value }) => `
    <tr>
      <td style="padding: 10px 16px; font-size: 13px; color: #7f8c8d; white-space: nowrap; vertical-align: top; border-bottom: 1px solid #ecf0f1;">${label}</td>
      <td style="padding: 10px 16px; font-size: 14px; color: #2c3e50; border-bottom: 1px solid #ecf0f1;">${value}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titles[actionType] || 'ECO Notification'}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f5f7;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background-color: ${headerColor}; padding: 28px 32px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 700; color: #ffffff;">${titles[actionType] || 'ECO Notification'}</h1>
              <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.85);">${subtitles[actionType] || ''}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color: #ffffff; padding: 0; border-left: 1px solid #e1e4e8; border-right: 1px solid #e1e4e8;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${detailRowsHTML}
              </table>
            </td>
          </tr>

          <!-- Action Button -->
          <tr>
            <td style="background-color: #ffffff; padding: 24px 32px; border-left: 1px solid #e1e4e8; border-right: 1px solid #e1e4e8; border-bottom: 1px solid #e1e4e8; border-radius: 0 0 8px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color: ${headerColor}; border-radius: 5px;">
                    <a href="${baseUrl}/eco" target="_blank" style="display: inline-block; padding: 12px 28px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none;">View ECO Details</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #95a5a6; line-height: 1.5;">
                This is an automated notification from IC Library.<br>
                You can manage your notification preferences in Settings.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
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
    console.log('\x1b[33m[WARN]\x1b[0m \x1b[36m[EmailService]\x1b[0m SMTP not configured, skipping ECO notification');
    return;
  }

  // Get recipients based on action type
  const recipients = await getECONotificationRecipients(actionType);
  if (recipients.length === 0) {
    console.log('\x1b[33m[WARN]\x1b[0m \x1b[36m[EmailService]\x1b[0m No recipients for ECO notification');
    return;
  }

  // Generate email content
  const subjects = {
    'eco_created': `[ECO-${eco.eco_number}] New Engineering Change Order Created`,
    'eco_approved': `[ECO-${eco.eco_number}] Engineering Change Order Approved`,
    'eco_rejected': `[ECO-${eco.eco_number}] Engineering Change Order Rejected`,
    'eco_stage_advanced': `[ECO-${eco.eco_number}] ECO Advanced to ${additionalInfo.to_stage || 'Next Stage'}`,
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
